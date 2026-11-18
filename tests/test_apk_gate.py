"""Offline, synthetic regression fixtures for the split APK GitHub Actions gate.

No network, no GitHub Actions, no APK build and no customer files.
"""
import ast
import contextlib
import importlib.util
import io
import os
from pathlib import Path
import stat
import tempfile
import unittest
from unittest import mock
import zipfile
import json

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("apk_gate_under_test", ROOT / "tools/release/apk_gate.py")
gate = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(gate)
NAME = "Zamerovac-v1.4.1.apk"
SHA = "a" * 40


def archive(entries, compression=zipfile.ZIP_STORED):
    payload = io.BytesIO()
    with zipfile.ZipFile(payload, "w") as out:
        for filename, content in entries:
            out.writestr(filename, content, compress_type=compression)
    return payload.getvalue()


class FakeAPI:
    def __init__(self, comments=None, refs=None, releases=None):
        self.comments = comments or {}
        self.refs = refs
        self.releases = releases

    def request(self, path, **kwargs):
        if path.startswith("/issues/comments/"):
            return self.comments[int(path.rsplit("/", 1)[1])]
        if path.startswith("/git/ref/tags/"):
            return self.refs
        if path.startswith("/releases/tags/"):
            return self.releases
        raise AssertionError("UNEXPECTED API CALL " + path)


class TestApkGateOffline(unittest.TestCase):
    def test_version_and_positive_run_id_reject_bad_inputs(self):
        self.assertEqual(gate.semver("1.4.1"), (1, 4, 1))
        for value in ("1.4", "01.4.0", "1.4.0\n", "../../1.4", "1.4.0-test"):
            with self.subTest(value=value), self.assertRaises(RuntimeError):
                gate.semver(value)
        for value in ("0", "-1", "01", "1\n", "99999999999999999999999"):
            with self.subTest(value=value), self.assertRaises(RuntimeError):
                gate.positive_id(value, "run id")
        self.assertEqual(gate.positive_id("123456", "run id"), 123456)

    def test_valid_zip_contains_exactly_one_byte_identical_apk(self):
        data = b"SYNTHETIC-NOT-A-REAL-APK" * 32
        raw = archive([(NAME, data)])
        self.assertEqual(gate.decode_single_apk(raw, NAME), data)

    def test_zip_rejects_path_traversal_absolute_extra_and_wrong_name(self):
        bads = [
            [("../" + NAME, b"attack")],
            [("/" + NAME, b"attack")],
            [("x\\" + NAME, b"attack")],
            [(NAME, b"ok"), ("secret.sh", b"bad")],
            [(NAME, b"ok"), (NAME, b"duplicate")],
            [("other.apk", b"wrong")],
        ]
        for files in bads:
            with self.subTest(files=files), self.assertRaises(RuntimeError):
                gate.decode_single_apk(archive(files), NAME)

    def test_zip_rejects_symlinks_and_empty_or_bomb_content(self):
        symlink = io.BytesIO()
        link = zipfile.ZipInfo(NAME)
        link.create_system = 3
        link.external_attr = (stat.S_IFLNK | 0o777) << 16
        with zipfile.ZipFile(symlink, "w") as z:
            z.writestr(link, "target")
        with self.assertRaises(RuntimeError):
            gate.decode_single_apk(symlink.getvalue(), NAME)
        with self.assertRaises(RuntimeError):
            gate.decode_single_apk(archive([(NAME, b"")]), NAME)
        with self.assertRaises(RuntimeError):
            gate.decode_single_apk(archive([(NAME, b"\0" * 100_000)], zipfile.ZIP_DEFLATED), NAME)

    def test_zip_rejects_corrupted_crc_and_truncated_zip(self):
        raw = archive([(NAME, b"X" * 400)])
        mutated = bytearray(raw)
        pos = mutated.index(b"X" * 10)
        mutated[pos] ^= 1
        with self.assertRaises(RuntimeError):
            gate.decode_single_apk(bytes(mutated), NAME)
        with self.assertRaises(RuntimeError):
            gate.decode_single_apk(raw[:30], NAME)

    def test_owner_origin_comment_must_remain_unchanged(self):
        data = {"id": 16, "user": {"id": gate.OWNER_ID, "login": gate.OWNER},
                "issue_url": "https://api.github.com/repos/" + gate.REPO + "/issues/183",
                "created_at": "T", "updated_at": "T",
                "body": "ZAMEROVAC BUILD " + SHA}
        gate.owner_comment(FakeAPI(comments={16: data}), 16, SHA)
        for k, wrong in [("body", "ZAMEROVAC BUILD " + "b" * 40),
                         ("updated_at", "T2"),
                         ("issue_url", "https://api.github.com/repos/" + gate.REPO + "/issues/184")]:
            altered = dict(data, **{k: wrong})
            with self.subTest(k=k), self.assertRaises(RuntimeError):
                gate.owner_comment(FakeAPI(comments={16: altered}), 16, SHA)
        altered = dict(data, user={"id": 42, "login": gate.OWNER})
        with self.assertRaises(RuntimeError):
            gate.owner_comment(FakeAPI(comments={16: altered}), 16, SHA)

    def test_prevent_duplicate_successful_build_for_same_sha(self):
        art = {"name": gate.artifact_name(123, SHA, 777), "expired": False}
        class DupApi:
            def pages(self, *_): return [art]
            def request(self, *_): return {"status": "completed", "conclusion": "success"}
        with self.assertRaisesRegex(RuntimeError, "already exists"):
            gate.duplicate_build(DupApi(), SHA)
        art["expired"] = True
        gate.duplicate_build(DupApi(), SHA)

    def test_authorization_recheck_manual_and_edited_owner_comment(self):
        with tempfile.TemporaryDirectory() as td:
            event_file = Path(td) / "event.json"
            event_file.write_text(json.dumps({"inputs": {
                "operation": "build", "target_sha": SHA, "build_run_id": "", "apk_sha256": ""}}))
            env = {"GITHUB_EVENT_NAME": "workflow_dispatch", "GITHUB_RUN_ATTEMPT": "1",
                   "GITHUB_EVENT_PATH": str(event_file), "APPROVAL_COMMENT_ID": "0",
                   "APPROVED_SHA": SHA}
            with mock.patch.dict(os.environ, env):
                gate.revalidate_current_approval(FakeAPI(), "build")
                os.environ["GITHUB_RUN_ATTEMPT"] = "2"
                with self.assertRaisesRegex(RuntimeError, "replayed"):
                    gate.revalidate_current_approval(FakeAPI(), "build")
            comment = {"id": 77, "user": {"id": gate.OWNER_ID}, "body": "ZAMEROVAC BUILD " + SHA,
                       "created_at": "T", "updated_at": "T",
                       "issue_url": "https://api.github.com/repos/" + gate.REPO + "/issues/183"}
            event_file.write_text(json.dumps({"comment": {"body": "ZAMEROVAC BUILD " + SHA}}))
            env.update({"GITHUB_EVENT_NAME": "issue_comment", "GITHUB_RUN_ATTEMPT": "1",
                        "APPROVAL_COMMENT_ID": "77"})
            with mock.patch.dict(os.environ, env):
                gate.revalidate_current_approval(FakeAPI(comments={77: comment}), "build")
                changed = dict(comment, updated_at="later")
                with self.assertRaises(RuntimeError):
                    gate.revalidate_current_approval(FakeAPI(comments={77: changed}), "build")

    def test_release_target_tag_or_release_collision_is_fail_closed(self):
        class API:
            def request(self, path, **kwargs):
                if path == "/git/ref/heads/main":
                    return {"object": {"sha": SHA}}
                if path == "/releases/latest":
                    return {"id": 4, "tag_name": "test-v1.4.0",
                            "assets": [{"name": "Zamerovac-v1.4.0.apk", "id": 5}]}
                if path.startswith("/git/ref/tags/") or path.startswith("/releases/tags/"):
                    return {"exists": True}
                raise AssertionError(path)
        with tempfile.TemporaryDirectory() as td:
            file = Path(td) / "approved.apk"
            file.write_bytes(b"APPROVED")
            event_file = Path(td) / "event.json"
            digest = gate.hashlib.sha256(file.read_bytes()).hexdigest()
            event_file.write_text(json.dumps({"inputs": {
                "operation": "release", "target_sha": "", "build_run_id": "123", "apk_sha256": digest}}))
            env = {"GITHUB_EVENT_NAME": "workflow_dispatch", "GITHUB_RUN_ATTEMPT": "1",
                   "GITHUB_EVENT_PATH": str(event_file), "APPROVAL_COMMENT_ID": "0",
                   "APPROVED_OPERATION": "release", "BUILD_RUN_ID": "123", "APPROVED_APK_HASH": digest,
                   "SOURCE_SHA": SHA, "RELEASE_VERSION": "1.4.1",
                   "PREVIOUS_RELEASE_ID": "4", "APPROVED_FILE": str(file), "EXPECTED_HASH": digest}
            with mock.patch.dict(os.environ, env), mock.patch.object(gate, "api_client", return_value=API()):
                with self.assertRaisesRegex(RuntimeError, "already exists"):
                    gate.release_recheck()

    def test_workflow_embedded_python_syntax_and_isolated_permissions(self):
        workflow = (ROOT / ".github/workflows/build-apk.yml").read_text()
        self.assertIn("issue_comment:", workflow)
        self.assertIn("queue: max", workflow)
        self.assertEqual(workflow.count("group: zamerovac-apk-owner-commands"), 3)
        self.assertNotIn("publish_release:", workflow)
        self.assertNotIn("cloud_run_approved:", workflow)
        self.assertEqual(workflow.count("contents: write"), 1)
        self.assertIn("name: build-only", workflow)
        self.assertIn("name: release-only", workflow)
        self.assertNotIn("workflow_run:", workflow)
        self.assertNotIn("--clobber", workflow)
        self.assertIn("github.event.issue.number == 183", workflow)
        self.assertIn("github.event.comment.user.id == 351234773", workflow)
        self.assertIn("github.run_attempt == 1", workflow)
        # Parse both embedded Python heredocs directly from the actual YAML, without requiring PyYAML.
        for index, part in enumerate(workflow.split("python3 - <<'PY'")[1:]):
            code = part.split("\n          PY")[0].replace("\n          ", "\n")
            ast.parse(code, filename="workflow-inline-python-" + str(index))


    def test_real_binary_metadata_gate_with_synthetic_apksigner_aapt_outputs(self):
        from types import SimpleNamespace
        def fake(cmd, **kwargs):
            if cmd[0] == "apksigner":
                return SimpleNamespace(stdout="Signer #1 certificate SHA-256 digest: " + gate.SIGNER)
            return SimpleNamespace(stdout="package: name='" + gate.PACKAGE +
                                   "' versionCode='1156' versionName='1.4.1-test'\n")
        with tempfile.TemporaryDirectory() as td:
            file = Path(td) / "synthetic.apk"
            file.write_bytes(b"FAKE")
            with mock.patch.object(gate, "tools", return_value=("aapt", "apksigner")), \
                    mock.patch.object(gate.subprocess, "run", side_effect=fake):
                meta = gate.inspect_apk(file, "1.4.1")
                self.assertEqual(meta["version_code"], 1156)
            wrong_signer = lambda cmd, **kw: type("R", (), {"stdout":
                ("Signer SHA-256 digest: " + "f"*64) if cmd[0]=="apksigner" else
                "package: name='" + gate.PACKAGE + "' versionCode='1156' versionName='1.4.1-test'"})()
            with mock.patch.object(gate, "tools", return_value=("aapt", "apksigner")), \
                    mock.patch.object(gate.subprocess, "run", side_effect=wrong_signer):
                with self.assertRaisesRegex(RuntimeError, "signer"):
                    gate.inspect_apk(file, "1.4.1")
            wrong_pkg = lambda cmd, **kw: type("R", (), {"stdout":
                ("Signer SHA-256 digest: " + gate.SIGNER) if cmd[0]=="apksigner" else
                "package: name='evil.other' versionCode='1156' versionName='1.4.1-test'"})()
            with mock.patch.object(gate, "tools", return_value=("aapt", "apksigner")), \
                    mock.patch.object(gate.subprocess, "run", side_effect=wrong_pkg):
                with self.assertRaisesRegex(RuntimeError, "package"):
                    gate.inspect_apk(file, "1.4.1")
            with mock.patch.object(gate, "tools", return_value=("aapt", "apksigner")), \
                    mock.patch.object(gate.subprocess, "run", side_effect=fake):
                with self.assertRaisesRegex(RuntimeError, "versionName"):
                    gate.inspect_apk(file, "1.4.2")

    def test_404_is_only_allowed_absence_for_exact_release_and_tag_checks(self):
        import urllib.error
        class NotFound:
            def __init__(self, code): self.code = code
            def open(self, request, timeout):
                raise urllib.error.HTTPError(request.full_url, self.code, "synthetic", {}, None)
        api = gate.GitHubAPI("synthetic-token", opener=NotFound(404))
        self.assertIsNone(api.request("/git/ref/tags/test-v1.4.1", allow_404=True))
        with self.assertRaisesRegex(RuntimeError, "HTTP 404"):
            api.request("/git/ref/tags/test-v1.4.1")
        unavailable = gate.GitHubAPI("synthetic-token", opener=NotFound(500))
        with self.assertRaisesRegex(RuntimeError, "HTTP 500"):
            unavailable.request("/git/ref/tags/test-v1.4.1", allow_404=True)

    def test_release_provenance_and_apk_hash_synthetic_api_fixtures(self):
        from unittest.mock import patch
        run_id = 43210
        artifact_id = 9876
        approved_data = b"FAKE APK ONLY FOR SYNTHETIC UNIT TESTS"
        digest = gate.hashlib.sha256(approved_data).hexdigest()
        workflow_id, repo_id = 777, 888
        archive_data = archive([(NAME, approved_data)])
        run = {
            "id": run_id, "workflow_id": workflow_id, "path": gate.WORKFLOW,
            "run_attempt": 1, "status": "completed", "conclusion": "success",
            "head_sha": SHA, "head_branch": "main", "event": "workflow_dispatch",
            "actor": {"id": gate.OWNER_ID}, "triggering_actor": {"id": gate.OWNER_ID},
            "repository": {"id": repo_id}, "head_repository": {"id": repo_id}
        }
        artifact = {
            "id": artifact_id, "name": gate.artifact_name(run_id, SHA, 0),
            "expired": False, "workflow_run": {"id": run_id, "head_sha": SHA}
        }
        class FakeReleaseAPI:
            def artifact_zip(self, identifier):
                if identifier == artifact_id: return archive_data
                raise AssertionError("UNEXPECTED ARTIFACT " + str(identifier))

            def request(self, path, **kwargs):
                if path == "/actions/runs/" + str(run_id): return run
                if path == "/actions/workflows/build-apk.yml": return {"id": workflow_id}
                if path == "": return {"id": repo_id}
                if path == "/releases/latest":
                    return {"id": 9, "tag_name": "test-v1.4.0",
                            "assets": [{"id": 10, "name": "Zamerovac-v1.4.0.apk"}]}
                if path.startswith("/git/ref/tags/") or path.startswith("/releases/tags/"):
                    return None
                raise AssertionError("UNEXPECTED " + path)
            def pages(self, path, key):
                if path.endswith("/jobs"): return [{"name": "build-only",
                                                      "run_attempt": 1, "conclusion": "success"}]
                if path.endswith("/artifacts"): return [artifact]
                raise AssertionError("UNEXPECTED " + path)
        with tempfile.TemporaryDirectory() as td:
            out = Path(td) / "outputs"
            approved = Path(td) / "zamerovac-approved.apk"
            env = {
                "BUILD_RUN_ID": str(run_id), "APPROVED_APK_HASH": digest,
                "RUNNER_TEMP": td, "GITHUB_OUTPUT": str(out)
            }
            mocks = (
                patch.object(gate, "api_client", return_value=FakeReleaseAPI()),
                patch.object(gate, "revalidate_current_approval"),
                patch.object(gate, "main_sha", return_value=SHA),
                patch.object(gate, "current_version", return_value="1.4.1"),
                patch.object(gate, "previous", return_value=(
                    {"id": 9, "tag_name": "test-v1.4.0"}, "1.4.0",
                    {"version_code": 1155})),
                patch.object(gate, "inspect_apk", return_value={
                    "version_code": 1156, "sha256": digest}),
            )
            with mock.patch.dict(os.environ, env), contextlib.ExitStack() as stack:
                for m in mocks: stack.enter_context(m)
                gate.release_preflight()
                self.assertEqual(approved.read_bytes(), approved_data)
                self.assertIn("expected_hash=" + digest, out.read_text())
                approved.unlink()
                os.environ["APPROVED_APK_HASH"] = "f" * 64
                with self.assertRaisesRegex(RuntimeError, "SHA256 mismatch"):
                    gate.release_preflight()
                os.environ["APPROVED_APK_HASH"] = digest
                run["actor"] = {"id": 12}
                with self.assertRaisesRegex(RuntimeError, "identity"):
                    gate.release_preflight()
                run["actor"] = {"id": gate.OWNER_ID}
                artifact["expired"] = True
                with self.assertRaisesRegex(RuntimeError, "artifact"):
                    gate.release_preflight()


if __name__ == "__main__":
    unittest.main()
