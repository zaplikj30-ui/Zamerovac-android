"""Read-only preflight for the home technical APK smoke; never publish/upload APK.

The preview build versionCode must follow the last *published* signed APK, not
the counter of this workflow. Fail closed when GitHub or APK verification fails.
"""
import json
import os
from pathlib import Path
import re
import subprocess
import urllib.parse
import urllib.request

REPO = "zaplikj30-ui/Zamerovac-android"
API = "https://api.github.com/repos/" + REPO
PACKAGE = "cz.zamerovac.app.preview"
CERT_SHA256 = "c828c96739e554e8da4f5851913356134f1359a98d5013772ad5587e74a2d229"
SEMVER = re.compile(r"^test-v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$")


class SafeAssetRedirect(urllib.request.HTTPRedirectHandler):
    """Keep the API token off external asset-CDN hosts, including 307/308."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        result = super().redirect_request(req, fp, code, msg, headers, newurl)
        if result is None:
            return None
        old, new = urllib.parse.urlsplit(req.full_url), urllib.parse.urlsplit(result.full_url)
        if new.scheme != "https" or new.username or new.password:
            raise ValueError("STOP: insecure release asset redirect")
        if (old.hostname, old.port) != (new.hostname, new.port):
            for key in tuple(result.headers) + tuple(result.unredirected_hdrs):
                if key.lower() in {"authorization", "proxy-authorization", "cookie", "x-github-api-version"}:
                    result.remove_header(key)
        return result


def api_read(url, token, accept="application/vnd.github+json", opener=None):
    target = urllib.parse.urlsplit(url)
    if (target.scheme != "https" or target.hostname != "api.github.com"
            or target.port not in (None, 443) or target.username or target.password
            or not target.path.startswith("/repos/" + REPO + "/releases")):
        raise ValueError("STOP: unexpected GitHub release API URL")
    request = urllib.request.Request(url, headers={
        "Authorization": "Bearer " + token,
        "Accept": accept,
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "Zamerovac-home-qa-version-check",
    })
    client = opener or urllib.request.build_opener(SafeAssetRedirect())
    with client.open(request, timeout=80) as response:
        return response.read()


def latest_published(releases):
    options = [x for x in releases
               if not x.get("draft") and x.get("published_at")
               and SEMVER.fullmatch(x.get("tag_name", ""))]
    if not options:
        raise ValueError("STOP: no published test release")
    return max(options, key=lambda x: x["published_at"])


def require_valid_old_apk(package_text, cert_text):
    match = re.search(r"^package: name='([^']+)' versionCode='([0-9]+)' versionName='([^']+)'",
                      package_text, flags=re.MULTILINE)
    if not match or match.group(1) != PACKAGE or match.group(3) == "":
        raise ValueError("STOP: previous release APK has wrong package/version")
    if CERT_SHA256 not in cert_text.lower():
        raise ValueError("STOP: previous release APK signing certificate differs")
    code = int(match.group(2))
    if not 1000 < code < 2147483646:
        raise ValueError("STOP: previous Android versionCode out of safe range")
    return code


def version_values(previous_code, current_version, previous_tag):
    old = SEMVER.fullmatch(previous_tag)
    current = re.fullmatch(r"(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)", current_version)
    if not old or not current:
        raise ValueError("STOP: invalid old/new semantic release version")
    if tuple(map(int, current.groups())) < tuple(map(int, old.groups())):
        raise ValueError("STOP: current source version is older than published APK")
    if not 1000 < previous_code < 2147483646:
        raise ValueError("STOP: Android versionCode cannot be incremented safely")
    next_code = previous_code + 1
    return {
        "QA_PREVIEW_BUILD_OFFSET": str(next_code - 1000),
        "QA_PREVIEW_EXPECTED_CODE": str(next_code),
        "QA_PREVIEW_EXPECTED_VERSION_NAME": current_version + "-test",
        "QA_PREVIEW_PREVIOUS_RELEASE_CODE": str(previous_code),
    }


def main():
    token = os.environ["GH_TOKEN"]
    sdk = Path(os.environ["ANDROID_HOME"]) / "build-tools" / "34.0.0"
    aapt, signer = sdk / "aapt.exe", sdk / "apksigner.bat"
    if not aapt.is_file() or not signer.is_file():
        raise ValueError("STOP: pinned Android SDK build tools unavailable")
    version = subprocess.run(["node", "tools/release/versioning.js", "--release"],
                             check=True, capture_output=True, text=True).stdout.strip()
    releases = json.loads(api_read(API + "/releases?per_page=100", token))
    if not isinstance(releases, list) or len(releases) >= 100:
        raise ValueError("STOP: ambiguous release pagination; needs explicit review")
    previous = latest_published(releases)
    assets = [a for a in previous.get("assets", []) if a.get("name", "").endswith(".apk")]
    if len(assets) != 1:
        raise ValueError("STOP: previous release must contain exactly one APK")
    target = Path(os.environ["RUNNER_TEMP"]) / "zamerovac-qa-previous-release.apk"
    try:
        payload = api_read(assets[0]["url"], token, accept="application/octet-stream")
        if not payload.startswith(b"PK\x03\x04"):
            raise ValueError("STOP: previous release asset is not an APK")
        target.write_bytes(payload)
        old_sign = subprocess.run([str(signer), "verify", "--min-sdk-version", "26",
                                   "--print-certs", str(target)], check=True,
                                  capture_output=True, text=True).stdout
        old_package = subprocess.run([str(aapt), "dump", "badging", str(target)],
                                     check=True, capture_output=True, text=True).stdout
        prior = require_valid_old_apk(old_package, old_sign)
        values = version_values(prior, version, previous["tag_name"])
    finally:
        target.unlink(missing_ok=True)
    with open(os.environ["GITHUB_ENV"], "a", encoding="utf-8") as env:
        for key, value in values.items():
            env.write(key + "=" + value + "\n")
    print("PASS: prior published APK signer/package verified; QA technical build code "
          + values["QA_PREVIEW_EXPECTED_CODE"] + " > " + str(prior)
          + ", source version " + values["QA_PREVIEW_EXPECTED_VERSION_NAME"])
    print("No release created, no APK uploaded.")


if __name__ == "__main__":
    main()
