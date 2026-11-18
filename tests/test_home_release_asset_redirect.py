"""Retained security regression after HOME retirement (#186).

Test the *active* cloud RELEASE gate's bearer-token isolation. Fully offline:
no GitHub credentials, external requests, APK build or publishing.
"""
import importlib.util
from pathlib import Path
import urllib.error
import urllib.request
import unittest

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("active_apk_gate", ROOT / "tools/release/apk_gate.py")
GATE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(GATE)

TOKEN = "FAKE_LOCAL_TEST_TOKEN"
CDN = "https://release-assets.githubusercontent.com/signed-asset"


class Response:
    def __init__(self, payload=b"synthetic-APK-archive"):
        self.payload = payload
        self.headers = {}
    def __enter__(self):
        return self
    def __exit__(self, *args):
        return False
    def read(self, length):
        return self.payload[:length]


class RedirectingOpener:
    def __init__(self, location, repeated=False):
        self.location = location
        self.repeated = repeated
        self.requests = []
    def open(self, request, timeout):
        self.requests.append(request)
        if (self.repeated or len(self.requests) == 1):
            raise urllib.error.HTTPError(request.full_url, 302, "Found",
                                         {"Location": self.location}, None)
        return Response()


class ReleaseAssetRedirectSecurity(unittest.TestCase):
    def test_default_python_redirect_would_forward_token(self):
        request = urllib.request.Request("https://api.github.com/repos/" + GATE.REPO + "/releases/assets/4",
                                         headers={"Authorization": "Bearer " + TOKEN})
        forwarded = urllib.request.HTTPRedirectHandler().redirect_request(
            request, None, 302, "Found", {}, CDN)
        self.assertIsNotNone(forwarded)
        self.assertIn("Authorization", forwarded.headers)

    def test_active_gate_rejects_automatic_authenticated_redirect(self):
        request = urllib.request.Request("https://api.github.com/repos/" + GATE.REPO + "/releases/assets/4",
                                         headers={"Authorization": "Bearer " + TOKEN})
        self.assertIsNone(GATE.NoRedirect().redirect_request(
            request, None, 302, "Found", {}, CDN))

    def test_valid_binary_api_redirect_uses_tokenless_cdn_request(self):
        opener = RedirectingOpener(CDN)
        data = GATE.GitHubAPI(TOKEN, opener=opener).request("/releases/assets/4", binary=True)
        self.assertEqual(data, b"synthetic-APK-archive")
        self.assertEqual(len(opener.requests), 2)
        self.assertEqual(opener.requests[0].get_header("Authorization"), "Bearer " + TOKEN)
        second = opener.requests[1]
        self.assertEqual(second.full_url, CDN)
        self.assertIsNone(second.get_header("Authorization"))
        self.assertFalse(any(k.lower() in ("authorization", "cookie") for k in second.headers))

    def test_untrusted_redirect_locations_stop_without_second_request(self):
        for address in (
            "http://release-assets.githubusercontent.com/asset",
            "https://release-assets.githubusercontent.com.evil.invalid/asset",
            "https://evil.invalid/asset",
            "https://user:secret@release-assets.githubusercontent.com/asset",
            "https://release-assets.githubusercontent.com/asset#fragment",
        ):
            with self.subTest(address=address):
                opener = RedirectingOpener(address)
                with self.assertRaisesRegex(RuntimeError, "untrusted asset redirect"):
                    GATE.GitHubAPI(TOKEN, opener=opener).request("/releases/assets/4", binary=True)
                self.assertEqual(len(opener.requests), 1)

    def test_repeated_cdn_redirects_stop_after_bounded_attempts(self):
        opener = RedirectingOpener(CDN, repeated=True)
        with self.assertRaisesRegex(RuntimeError, "too many CDN redirects"):
            GATE.GitHubAPI(TOKEN, opener=opener).request("/releases/assets/4", binary=True)
        self.assertEqual(len(opener.requests), 6)

    def test_json_api_redirect_not_allowed(self):
        opener = RedirectingOpener(CDN)
        with self.assertRaisesRegex(RuntimeError, "GitHub API HTTP 302"):
            GATE.GitHubAPI(TOKEN, opener=opener).request("/releases/tags/test-v1.4.1")
        self.assertEqual(len(opener.requests), 1)

    def test_invalid_git_api_path_rejected_without_network(self):
        opener = RedirectingOpener(CDN)
        with self.assertRaisesRegex(RuntimeError, "invalid GitHub API path"):
            GATE.GitHubAPI(TOKEN, opener=opener).request("https://evil.invalid/asset", binary=True)
        self.assertFalse(opener.requests)

    def test_obsolete_home_release_workflow_is_absent(self):
        self.assertFalse((ROOT / ".github/workflows/windows-home-apk-release.yml").exists())


if __name__ == "__main__":
    unittest.main()
