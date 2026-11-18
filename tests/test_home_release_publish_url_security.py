"""Retained publish safety tests after removing legacy HOME release workflow.

All cases test the active GitHub-hosted RELEASE-only source/metadata contract.
No HTTP, live tokens, GitHub Actions, APK publishing or external hosts.
"""
import hashlib
import importlib.util
import os
from pathlib import Path
import tempfile
import unittest
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("apk_release_gate_under_test", ROOT / "tools/release/apk_gate.py")
GATE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(GATE)
WORKFLOW = (ROOT / ".github/workflows/build-apk.yml").read_text(encoding="utf-8")
SOURCE = (ROOT / "tools/release/apk_gate.py").read_text(encoding="utf-8")
SHA = "a" * 40


class FakeReleaseAPI:
    def __init__(self, tag_exists=False, release_exists=False, error=False, payload=b"APPROVED"):
        self.tag_exists = tag_exists
        self.release_exists = release_exists
        self.error = error
        self.payload = payload
        self.visited = []

    def request(self, path, **kwargs):
        self.visited.append((path, kwargs))
        if self.error:
            raise RuntimeError("STOP: synthetic API unavailable")
        if path == "/releases/latest":
            return {"id": 98, "tag_name": "test-v1.4.0",
                    "assets": [{"id": 120, "name": "Zamerovac-v1.4.0.apk"}]}
        if path == "/git/ref/tags/test-v1.4.1":
            return {"ref": path} if self.tag_exists else None
        if path == "/releases/tags/test-v1.4.1":
            return {"tag_name": "test-v1.4.1", "id": 99, "assets": [
                {"id": 200, "name": "Zamerovac-v1.4.1.apk"}]} if self.release_exists else None
        if path == "/releases/assets/200":
            return self.payload
        raise AssertionError("Unexpected API request " + path)


class ActiveReleasePublishingSecurity(unittest.TestCase):
    def setUp(self):
        self.saved = tempfile.TemporaryDirectory()
        self.addCleanup(self.saved.cleanup)
        self.file = Path(self.saved.name) / "approved.apk"
        self.file.write_bytes(b"APPROVED")
        self.digest = hashlib.sha256(self.file.read_bytes()).hexdigest()
        self.vars = {
            "SOURCE_SHA": SHA, "RELEASE_TAG": "test-v1.4.1",
            "RELEASE_VERSION": "1.4.1", "PREVIOUS_RELEASE_ID": "98",
            "APPROVED_FILE": str(self.file), "EXPECTED_HASH": self.digest,
        }

    def recheck(self, client):
        with mock.patch.dict(os.environ, self.vars), \
                mock.patch.object(GATE, "api_client", return_value=client), \
                mock.patch.object(GATE, "revalidate_current_approval"), \
                mock.patch.object(GATE, "main_sha", return_value=SHA):
            GATE.release_recheck()

    def test_existing_tag_fails_before_any_publication(self):
        client = FakeReleaseAPI(tag_exists=True)
        with self.assertRaisesRegex(RuntimeError, "tag already exists"):
            self.recheck(client)
        self.assertFalse(any(x[0] == "/releases/assets/200" for x in client.visited))

    def test_existing_release_fails_even_when_ref_missing(self):
        client = FakeReleaseAPI(release_exists=True)
        with self.assertRaisesRegex(RuntimeError, "release already exists"):
            self.recheck(client)

    def test_unknown_api_result_fails_closed_without_retry(self):
        client = FakeReleaseAPI(error=True)
        with self.assertRaisesRegex(RuntimeError, "synthetic API unavailable"):
            self.recheck(client)
        self.assertEqual(len(client.visited), 1)

    def test_modified_approved_apk_stops_before_gh_release(self):
        self.file.write_bytes(b"TAMPERED")
        with self.assertRaisesRegex(RuntimeError, "mutated"):
            self.recheck(FakeReleaseAPI())

    def test_safe_fully_verified_recheck_is_read_only(self):
        client = FakeReleaseAPI()
        self.recheck(client)
        self.assertEqual([p for p, _ in client.visited], [
            "/releases/latest", "/git/ref/tags/test-v1.4.1", "/releases/tags/test-v1.4.1"
        ])

    def test_published_asset_hash_is_checked_against_approved_bytes(self):
        client = FakeReleaseAPI(release_exists=True, payload=b"APPROVED")
        with mock.patch.dict(os.environ, self.vars), \
                mock.patch.object(GATE, "api_client", return_value=client):
            GATE.release_post()
        client.payload = b"CHANGED"
        with mock.patch.dict(os.environ, self.vars), \
                mock.patch.object(GATE, "api_client", return_value=client):
            with self.assertRaisesRegex(RuntimeError, "SHA256 mismatch"):
                GATE.release_post()

    def test_cloud_release_only_one_create_no_clobber_and_owner_gate(self):
        self.assertFalse((ROOT / ".github/workflows/windows-home-apk-release.yml").exists())
        release = WORKFLOW.split("\n  release:", 1)[1]
        self.assertEqual(release.count("gh release create"), 1)
        self.assertNotIn("--clobber", release)
        self.assertNotIn("--force", release)
        self.assertNotIn("actions/checkout", release)
        self.assertNotIn("assemblePreview", release)
        self.assertIn("--repo \"$GITHUB_REPOSITORY\" --target \"$SOURCE_SHA\"", release)
        self.assertIn("release-recheck", release)
        self.assertIn("release-post", release)
        self.assertEqual(WORKFLOW.count("contents: write"), 1)

    def test_bearer_only_used_with_pinned_github_api_host(self):
        self.assertIn('"https://api.github.com/repos/" + REPO + path', SOURCE)
        self.assertIn('class NoRedirect(urllib.request.HTTPRedirectHandler)', SOURCE)
        self.assertIn('"objects.githubusercontent.com"', SOURCE)
        self.assertIn('"release-assets.githubusercontent.com"', SOURCE)
        self.assertNotIn("uploads.github.com", SOURCE)


if __name__ == "__main__":
    unittest.main()
