#!/usr/bin/env python3
"""Fail-closed GitHub-native APK build/release checks. No customer data or external services."""
import base64
import hashlib
import io
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request
import zipfile

REPO = "zaplikj30-ui/Zamerovac-android"
OWNER_ID = 351234773
OWNER = "zaplikj30-ui"
SIGNER = "c828c96739e554e8da4f5851913356134f1359a98d5013772ad5587e74a2d229"
PACKAGE = "cz.zamerovac.app.preview"
WORKFLOW = ".github/workflows/build-apk.yml"
MAX_ZIP = 100 * 1024 * 1024
MAX_APK = 100 * 1024 * 1024
HEX40 = re.compile(r"[0-9a-f]{40}")
HEX64 = re.compile(r"[0-9a-f]{64}")
VERSION = re.compile(r"(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)")
ARTIFACT = re.compile(r"Zamerovac-preview-APK-([1-9][0-9]*)-1-([0-9a-f]{40})-(0|[1-9][0-9]*)")
SCRIPT_REPO_PATH = "tools/release/apk_gate.py"
# Highest known existing preview installation reported by the owner (actual APK bytes).
# Every subsequent GitHub BUILD gets a strictly increasing code based on its own
# workflow run_number, even if no previous test build was published as a Release.
KNOWN_PREVIEW_VERSION_CODE = 10008


def stop(message):
    raise RuntimeError("STOP: " + message)


def exact(pattern, value, label):
    if not isinstance(value, str) or not pattern.fullmatch(value):
        stop("invalid " + label)
    return value


def positive_id(value, label):
    if not re.fullmatch(r"[1-9][0-9]{0,18}", str(value)):
        stop("invalid " + label)
    num = int(value)
    if num > (1 << 63) - 1:
        stop("ID exceeds signed 64bit")
    return num


def semver(value):
    exact(VERSION, value, "semantic version")
    return tuple(int(x) for x in value.split("."))


def api_client():
    return GitHubAPI(os.environ["GH_TOKEN"])


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class GitHubAPI:
    def __init__(self, token, opener=None):
        if not token:
            stop("GitHub auth token missing")
        self.token = token
        self.opener = opener or urllib.request.build_opener(NoRedirect)
        self.hosts = {"objects.githubusercontent.com", "release-assets.githubusercontent.com"}

    def artifact_zip(self, artifact_id):
        # Actions archives use GitHub REST JSON media type and Azure blob storage,
        # unlike Release APK assets (octet-stream + GitHub release CDN).
        artifact_id = positive_id(artifact_id, "artifact ID")
        return self.request("/actions/artifacts/" + str(artifact_id) + "/zip",
                            binary=True, artifact=True)

    def request(self, path, binary=False, payload=None, allow_404=False, artifact=False):
        if not isinstance(path, str) or not path.startswith("/"):
            stop("invalid GitHub API path")
        if artifact and (not binary or payload is not None or
                         not re.fullmatch(r"/actions/artifacts/[1-9][0-9]*/zip", path)):
            stop("invalid Actions ZIP request")
        url = "https://api.github.com/repos/" + REPO + path
        data = json.dumps(payload).encode() if payload is not None else None
        headers = {"Authorization": "Bearer " + self.token, "User-Agent": "zamerovac-apk-gate",
                   "Accept": "application/vnd.github+json" if artifact or not binary else "application/octet-stream",
                   "X-GitHub-Api-Version": "2022-11-28"}
        req = urllib.request.Request(url, data=data, headers=headers,
                                     method="POST" if data is not None else "GET")
        try:
            with self.opener.open(req, timeout=30) as response:
                raw = response.read((MAX_ZIP if binary else 4 * 1024 * 1024) + 1)
                if len(raw) > (MAX_ZIP if binary else 4 * 1024 * 1024):
                    stop("API response over size limit")
                if binary and "json" in response.headers.get("Content-Type", "").lower():
                    stop("binary endpoint returned JSON")
                return raw if binary else json.loads(raw)
        except urllib.error.HTTPError as error:
            if allow_404 and error.code == 404 and not binary:
                return None
            if not binary or error.code not in (301, 302, 303, 307, 308):
                stop("GitHub API HTTP " + str(error.code))
            return self.redirect_binary(error.headers.get("Location"), artifact=artifact)
        except (urllib.error.URLError, TimeoutError):
            stop("GitHub API network error")

    def redirect_binary(self, url, artifact=False):
        # Never forward bearer/cookies to a signed CDN URL (including subsequent hops).
        for _ in range(5):
            try:
                parsed = urllib.parse.urlsplit(url or "")
                allowed_port = parsed.port in (None, 443)
            except ValueError:
                stop("untrusted asset redirect")
            host = parsed.hostname or ""
            allowed_host = (re.fullmatch(r"productionresultssa[0-9]{1,3}\.blob\.core\.windows\.net", host)
                            if artifact else host in self.hosts)
            if (parsed.scheme != "https" or not allowed_host or not allowed_port or
                    parsed.username or parsed.password or parsed.fragment):
                stop("untrusted asset redirect")
            req = urllib.request.Request(url, headers={"User-Agent": "zamerovac-apk-gate"})
            try:
                with self.opener.open(req, timeout=60) as response:
                    raw = response.read(MAX_ZIP + 1)
                    if len(raw) > MAX_ZIP:
                        stop("download exceeds size limit")
                    return raw
            except urllib.error.HTTPError as error:
                if error.code not in (301, 302, 303, 307, 308):
                    stop("asset CDN HTTP " + str(error.code))
                url = error.headers.get("Location")
            except (urllib.error.URLError, TimeoutError):
                stop("binary download network error")
        stop("too many CDN redirects")

    def pages(self, path, key, max_pages=30):
        all_items = []
        for page in range(1, max_pages + 1):
            sep = "&" if "?" in path else "?"
            result = self.request(path + sep + "per_page=100&page=" + str(page))
            values = result if isinstance(result, list) else result.get(key)
            if not isinstance(values, list):
                stop("missing API page " + key)
            all_items.extend(values)
            if len(values) < 100:
                if isinstance(result, dict) and "total_count" in result and len(all_items) != result["total_count"]:
                    stop("incomplete paginated API results")
                return all_items
        stop("API pagination exceeds safe limit")


def latest(api):
    info = api.request("/releases/latest")
    tag = info.get("tag_name")
    if not isinstance(tag, str) or not tag.startswith("test-v"):
        stop("latest release is not a preview release")
    version = tag[6:]
    semver(version)
    assets = [x for x in info.get("assets", []) if x.get("name", "").endswith(".apk")]
    if len(assets) != 1 or assets[0].get("name") != "Zamerovac-v" + version + ".apk":
        stop("latest published APK is ambiguous")
    return info, version, assets[0]


def main_sha(api):
    info = api.request("/git/ref/heads/main")
    sha = info.get("object", {}).get("sha")
    return exact(HEX40, sha, "current main SHA")


def repo_id(api):
    return api.request("").get("id")


def current_version(api, source):
    info = api.request("/contents/config/app-version.properties?ref=" + exact(HEX40, source, "source SHA"))
    try:
        content = base64.b64decode(info["content"], validate=False).decode("utf-8")
    except (KeyError, ValueError, UnicodeDecodeError):
        stop("missing trusted version metadata")
    values = [line.strip()[12:] for line in content.splitlines()
              if line.strip().startswith("versionName=")]
    if len(values) != 1:
        stop("ambiguous version metadata")
    return exact(VERSION, values[0], "source version")


def tools():
    sdk = os.getenv("ANDROID_HOME") or os.getenv("ANDROID_SDK_ROOT")
    if not sdk:
        stop("Android SDK missing")
    root = Path(sdk) / "build-tools"
    versions = sorted((p for p in root.iterdir() if p.is_dir()), key=lambda p: tuple(int(x) if x.isdigit() else 0 for x in re.split(r"[.-]", p.name)))
    if not versions:
        stop("no SDK build tools")
    aapt, signer = versions[-1] / "aapt", versions[-1] / "apksigner"
    if not aapt.is_file() or not signer.is_file():
        stop("aapt/apksigner missing")
    return str(aapt), str(signer)


def inspect_apk(path, version=None):
    aapt, signer = tools()
    signed = subprocess.run([signer, "verify", "--min-sdk-version", "26",
                             "--print-certs", str(path)], capture_output=True, text=True, timeout=90, check=True).stdout.lower()
    if SIGNER not in re.findall(r"[0-9a-f]{64}", signed):
        stop("APK signer certificate mismatch")
    badging = subprocess.run([aapt, "dump", "badging", str(path)],
                             capture_output=True, text=True, timeout=90, check=True).stdout.splitlines()[0]
    pkg = re.search(r"\bname='([^']+)'", badging)
    code = re.search(r"\bversionCode='([0-9]+)'", badging)
    name = re.search(r"\bversionName='([^']+)'", badging)
    if not pkg or pkg.group(1) != PACKAGE or not code or not name:
        stop("APK package/version metadata invalid")
    if version is not None and name.group(1) != version + "-test":
        stop("APK versionName mismatch")
    return {"version_code": int(code.group(1)), "version_name": name.group(1),
            "sha256": hashlib.sha256(Path(path).read_bytes()).hexdigest()}


def previous(ap):
    info, version, asset = latest(ap)
    raw = ap.request("/releases/assets/" + str(positive_id(asset["id"], "latest asset ID")), binary=True)
    declared = asset.get("digest")
    if declared is not None and declared != "sha256:" + hashlib.sha256(raw).hexdigest():
        stop("previous published asset digest mismatch")
    if len(raw) > MAX_APK:
        stop("latest APK too large")
    with tempfile.TemporaryDirectory() as td:
        path = Path(td) / "old.apk"
        path.write_bytes(raw)
        meta = inspect_apk(path, version)
    return info, version, meta


def artifact_name(run_id, source, comment_id):
    return "Zamerovac-preview-APK-" + str(positive_id(run_id, "build run ID")) + "-1-" + exact(HEX40, source, "SHA") + "-" + str(comment_id)


def duplicate_build(api, sha):
    # Native job concurrency serializes successful artifact creation before the next BUILD.
    artifacts = api.pages("/actions/artifacts", "artifacts")
    for artifact in artifacts:
        match = ARTIFACT.fullmatch(artifact.get("name", ""))
        if not match or artifact.get("expired") or match.group(2) != sha:
            continue
        run = api.request("/actions/runs/" + match.group(1))
        if run.get("status") == "completed" and run.get("conclusion") == "success":
            stop("successful usable BUILD for this main SHA already exists")


def emit(**items):
    out = os.environ.get("GITHUB_OUTPUT")
    if not out:
        stop("GITHUB_OUTPUT not available")
    with open(out, "a", encoding="utf8") as dst:
        for k, value in items.items():
            if not re.fullmatch("[a-z_]+", k) or not re.fullmatch("[A-Za-z0-9_.:/-]+", str(value)):
                stop("unsafe output metadata")
            dst.write(k + "=" + str(value) + "\n")


def next_preview_code(published_code, run_number):
    """No downgrade from known test APKs; strictly increasing for each BUILD run."""
    number = positive_id(run_number, "GitHub Actions workflow run number")
    if not isinstance(published_code, int) or not 1001 <= published_code < 2147483646:
        stop("previous Android versionCode invalid")
    code = max(published_code + 1, KNOWN_PREVIEW_VERSION_CODE + number)
    if code >= 2147483647:
        stop("preview versionCode exceeds Android signed int range")
    return code


def build_preflight():
    api = api_client()
    revalidate_current_approval(api, 'build')
    sha = exact(HEX40, os.environ["APPROVED_SHA"], "approved main")
    if main_sha(api) != sha:
        stop("main drift before BUILD")
    duplicate_build(api, sha)
    version = current_version(api, sha)
    old_release, old_version, old = previous(api)
    if semver(version) <= semver(old_version):
        stop("new product version must be higher than existing release")
    new_code = next_preview_code(old["version_code"], os.environ["GITHUB_RUN_NUMBER"])
    emit(version=version, previous_tag=old_release["tag_name"],
         previous_release_id=positive_id(old_release["id"], "previous release"),
         previous_code=old["version_code"], new_code=new_code, offset=new_code - 1000)


def build_postflight():
    api = api_client()
    revalidate_current_approval(api, 'build')
    sha = exact(HEX40, os.environ["APPROVED_SHA"], "approved SHA")
    if main_sha(api) != sha:
        stop("main drift before artifact")
    old, old_version, asset = latest(api)
    if str(old.get("id")) != os.environ["PREVIOUS_RELEASE_ID"]:
        stop("latest release drift during BUILD")
    version = exact(VERSION, os.environ["APP_VERSION"], "build version")
    name = "Zamerovac-v" + version + ".apk"
    path = Path("app/build/outputs/apk/preview/app-preview.apk")
    if not path.is_file() or path.stat().st_size > MAX_APK:
        stop("missing/oversize build APK")
    meta = inspect_apk(path, version)
    expected = next_preview_code(int(os.environ["PREVIOUS_CODE"]), os.environ["GITHUB_RUN_NUMBER"])
    if meta["version_code"] != int(os.environ["NEW_CODE"]) or meta["version_code"] != expected:
        stop("versionCode not correct/monotonic")
    dest = Path("dist")
    dest.mkdir(exist_ok=True)
    (dest / name).write_bytes(path.read_bytes())
    if hashlib.sha256((dest / name).read_bytes()).hexdigest() != meta["sha256"]:
        stop("dist APK changed")
    emit(apk_hash=meta["sha256"])
    print("PASS BUILD APK sha256=" + meta["sha256"] + " source=" + sha)


def decode_single_apk(blob, expected_name):
    if len(blob) > MAX_ZIP:
        stop("ZIP exceeds max bytes")
    try:
        with zipfile.ZipFile(io.BytesIO(blob)) as archive:
            entries = archive.infolist()
            if len(entries) != 1:
                stop("ZIP must contain exactly one APK")
            entry = entries[0]
            if (entry.filename != expected_name or entry.is_dir() or
                    entry.flag_bits & 0x1 or entry.compress_type not in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED)):
                stop("unexpected ZIP entry")
            unix_type = stat.S_IFMT(entry.external_attr >> 16)
            if unix_type not in (0, stat.S_IFREG):
                stop("symlink/special ZIP entry")
            if (entry.file_size < 1 or entry.file_size > MAX_APK or entry.compress_size < 1 or
                    entry.file_size > entry.compress_size * 100):
                stop("ZIP entry size/ratio invalid")
            with archive.open(entry) as src:
                data = src.read(MAX_APK + 1)
            if len(data) != entry.file_size:
                stop("ZIP size or CRC mismatch")
            return data
    except (zipfile.BadZipFile, RuntimeError, OSError, EOFError) as error:
        if isinstance(error, RuntimeError) and str(error).startswith("STOP:"):
            raise
        stop("invalid ZIP structure/CRC")


def revalidate_current_approval(api, operation):
    if os.environ.get("GITHUB_RUN_ATTEMPT") != "1":
        stop("replayed workflow attempt")
    comment_id = os.environ.get("APPROVAL_COMMENT_ID", "")
    with open(os.environ["GITHUB_EVENT_PATH"], encoding="utf8") as f:
        event = json.load(f)
    if os.environ["GITHUB_EVENT_NAME"] == "issue_comment":
        positive_id(comment_id, "approval comment")
        live = api.request("/issues/comments/" + comment_id)
        original_body = event.get("comment", {}).get("body")
        if (live.get("id") != int(comment_id) or
                live.get("issue_url") != "https://api.github.com/repos/" + REPO + "/issues/183" or
                live.get("user", {}).get("id") != OWNER_ID or
                live.get("created_at") != live.get("updated_at") or
                live.get("body") != original_body):
            stop("current approval edited/deleted")
        if operation == "build":
            approved = "ZAMEROVAC BUILD " + os.environ["APPROVED_SHA"]
        elif operation == "release":
            approved = "ZAMEROVAC RELEASE " + os.environ["BUILD_RUN_ID"] + " " + os.environ["APPROVED_APK_HASH"]
        else:
            stop("unknown approval operation")
        if original_body != approved:
            stop("current approval no longer matches intended operation")
    elif os.environ["GITHUB_EVENT_NAME"] == "workflow_dispatch":
        if comment_id != "0":
            stop("manual approval comment ID mismatch")
        inputs = event.get("inputs") or {}
        if inputs.get("operation") != operation:
            stop("manual operation mismatch")
        if operation == "build":
            if (inputs.get("target_sha") != os.environ["APPROVED_SHA"] or
                    inputs.get("build_run_id") or inputs.get("apk_sha256")):
                stop("manual build inputs mismatch")
        elif operation == "release":
            if (inputs.get("target_sha") or
                    inputs.get("build_run_id") != os.environ["BUILD_RUN_ID"] or
                    inputs.get("apk_sha256") != os.environ["APPROVED_APK_HASH"]):
                stop("manual release inputs mismatch")
        else:
            stop("unknown manual operation")
    else:
        stop("unauthorized event")


def owner_comment(api, comment_id, source_sha):
    comment = api.request("/issues/comments/" + str(positive_id(comment_id, "comment ID")))
    if (comment.get("user", {}).get("id") != OWNER_ID or
            comment.get("user", {}).get("login") != OWNER or
            comment.get("issue_url") != "https://api.github.com/repos/" + REPO + "/issues/183" or
            comment.get("created_at") != comment.get("updated_at") or
            comment.get("body") != "ZAMEROVAC BUILD " + source_sha):
        stop("original build approval invalid/edited")
    return comment


def release_preflight():
    api = api_client()
    revalidate_current_approval(api, 'release')
    requested_run = positive_id(os.environ["BUILD_RUN_ID"], "build run ID")
    requested_hash = exact(HEX64, os.environ["APPROVED_APK_HASH"], "owner APK SHA256")
    run = api.request("/actions/runs/" + str(requested_run))
    source = exact(HEX40, run.get("head_sha"), "origin source SHA")
    workflow = api.request("/actions/workflows/build-apk.yml")
    if (run.get("id") != requested_run or run.get("workflow_id") != workflow.get("id") or
            run.get("path", "").split("@")[0] != WORKFLOW or
            run.get("run_attempt") != 1 or run.get("status") != "completed" or
            run.get("conclusion") != "success" or run.get("head_branch") != "main" or
            run.get("event") not in ("issue_comment", "workflow_dispatch") or
            run.get("actor", {}).get("id") != OWNER_ID or
            run.get("triggering_actor", {}).get("id") != OWNER_ID):
        stop("origin run identity/workflow/attempt/result invalid")
    repository = api.request("")
    if (run.get("repository", {}).get("id") != repository.get("id") or
            run.get("head_repository", {}).get("id") != repository.get("id")):
        stop("origin repository mismatch")
    if main_sha(api) != source:
        stop("source SHA is no longer current main")
    jobs = api.pages("/actions/runs/" + str(requested_run) + "/jobs", "jobs")
    matches = [j for j in jobs if j.get("name") == "build-only" and j.get("run_attempt") == 1]
    if len(matches) != 1 or matches[0].get("conclusion") != "success":
        stop("successful origin BUILD job missing/ambiguous")
    artifacts = api.pages("/actions/runs/" + str(requested_run) + "/artifacts", "artifacts")
    if len(artifacts) != 1:
        stop("expected exactly one build artifact")
    a = artifacts[0]
    name = a.get("name", "")
    match = ARTIFACT.fullmatch(name)
    if (not match or int(match.group(1)) != requested_run or match.group(2) != source or
            a.get("expired") or a.get("workflow_run", {}).get("id") != requested_run or
            a.get("workflow_run", {}).get("head_sha") != source):
        stop("artifact identity/expiry mismatch")
    comment_id = int(match.group(3))
    if run.get("event") == "issue_comment":
        if not comment_id:
            stop("origin owner comment ID absent")
        owner_comment(api, comment_id, source)
    elif comment_id != 0:
        stop("manual build provenance mismatch")
    version = current_version(api, source)
    info, previous_version, old = previous(api)
    if semver(version) <= semver(previous_version):
        stop("target release version is not newer")
    if old["version_code"] >= 2147483646:
        stop("previous versionCode too high")
    expected_name = "Zamerovac-v" + version + ".apk"
    archive = api.artifact_zip(a["id"])
    data = decode_single_apk(archive, expected_name)
    sha = hashlib.sha256(data).hexdigest()
    if sha != requested_hash:
        stop("owner-approved APK SHA256 mismatch")
    with tempfile.TemporaryDirectory() as td:
        test_file = Path(td) / expected_name
        test_file.write_bytes(data)
        meta = inspect_apk(test_file, version)
    expected_code = next_preview_code(old["version_code"], run.get("run_number"))
    if meta["version_code"] != expected_code or meta["sha256"] != sha:
        stop("versionCode/digest differs from original build contract")
    if main_sha(api) != source:
        stop("main moved during release preflight")
    check_latest, _, _ = latest(api)
    if check_latest["id"] != info["id"]:
        stop("latest release changed")
    tag = "test-v" + version
    # Exact API lookups. 404 is the sole accepted absence; other HTTP errors STOP.
    if api.request("/git/ref/tags/" + tag, allow_404=True) is not None:
        stop("target tag already exists")
    if api.request("/releases/tags/" + tag, allow_404=True) is not None:
        stop("target release already exists")
    final_path = Path(os.environ["RUNNER_TEMP"]) / "zamerovac-approved.apk"
    # Never use a symlink/cached filename for the bytes. Recreate in this ephemeral job.
    with open(final_path, "xb") as dest:
        dest.write(data)
    if hashlib.sha256(final_path.read_bytes()).hexdigest() != requested_hash:
        stop("release temp APK changed")
    emit(tag=tag, version=version, source_sha=source, approved_file=str(final_path),
         expected_hash=requested_hash, previous_release_id=info["id"],
         build_run_id=requested_run, artifact_id=a["id"])
    print("PASS RELEASE PREFLIGHT source=" + source + " APK hash=" + requested_hash)


def release_recheck():
    api = api_client()
    revalidate_current_approval(api, 'release')
    expected_sha = exact(HEX40, os.environ["SOURCE_SHA"], "source")
    version = exact(VERSION, os.environ["RELEASE_VERSION"], "release version")
    tag = "test-v" + version
    if main_sha(api) != expected_sha:
        stop("main drift before create")
    info, _, _ = latest(api)
    if str(info["id"]) != os.environ["PREVIOUS_RELEASE_ID"]:
        stop("latest release changed before create")
    if api.request("/git/ref/tags/" + tag, allow_404=True) is not None:
        stop("tag already exists before create")
    if api.request("/releases/tags/" + tag, allow_404=True) is not None:
        stop("release already exists before create")
    file = Path(os.environ["APPROVED_FILE"])
    if not file.is_file() or hashlib.sha256(file.read_bytes()).hexdigest() != os.environ["EXPECTED_HASH"]:
        stop("approved APK mutated before create")


def release_post():
    api = api_client()
    tag = os.environ["RELEASE_TAG"]
    expected_hash = exact(HEX64, os.environ["EXPECTED_HASH"], "expected hash")
    release = api.request("/releases/tags/" + urllib.parse.quote(tag, safe=""))
    expected_name = "Zamerovac-v" + os.environ["RELEASE_VERSION"] + ".apk"
    assets = release.get("assets", [])
    if release.get("tag_name") != tag or len(assets) != 1 or assets[0].get("name") != expected_name:
        stop("release post-publish metadata mismatch/UNKNOWN")
    data = api.request("/releases/assets/" + str(positive_id(assets[0]["id"], "published asset ID")), binary=True)
    if hashlib.sha256(data).hexdigest() != expected_hash:
        stop("published APK SHA256 mismatch/UNKNOWN")
    print("PASS release verified asset sha256=" + expected_hash + " release=" + str(release["id"]))


if __name__ == "__main__":
    try:
        action = sys.argv[1] if len(sys.argv) == 2 else ""
        commands = {"build-preflight": build_preflight, "build-postflight": build_postflight,
                    "release-preflight": release_preflight, "release-recheck": release_recheck,
                    "release-post": release_post}
        if action not in commands:
            stop("unknown script operation")
        commands[action]()
    except (OSError, KeyError, ValueError, subprocess.CalledProcessError, subprocess.TimeoutExpired,
            urllib.error.URLError, json.JSONDecodeError, RuntimeError) as error:
        print("FAIL " + str(error), file=sys.stderr)
        sys.exit(1)
