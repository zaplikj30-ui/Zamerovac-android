"""Offline security regression: home QA code must follow published signed APK.

No GitHub token, no network, no APK generation, no releases.
"""
from pathlib import Path
import sys
import unittest
from unittest import mock
import urllib.request

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from tools.release import home_qa_version_preflight as v

BADGING = ("package: name='cz.zamerovac.app.preview' versionCode='1154' "
           "versionName='1.3.0-test'\n")
SIGNATURE = "Verified\nSigner #1 certificate SHA-256 digest: " + v.CERT_SHA256 + "\n"


class HomeQaCodePreflight(unittest.TestCase):
    def test_published_latest_ignores_draft(self):
        entries = [
            {"tag_name": "test-v9.9.9", "published_at": None, "draft": True},
            {"tag_name": "test-v1.2.153", "published_at": "2026-11-05T01:00:00Z", "draft": False},
            {"tag_name": "test-v1.3.0", "published_at": "2026-11-06T01:00:00Z", "draft": False},
            {"tag_name": "draft-something", "published_at": "2026-11-07T01:00:00Z", "draft": False},
        ]
        self.assertEqual(v.latest_published(entries)["tag_name"], "test-v1.3.0")

    def test_missing_release_fails_closed(self):
        with self.assertRaisesRegex(ValueError, "no published"):
            v.latest_published([{"tag_name": "test-v9.9.9", "draft": True}])

    def test_prior_signature_package_and_version_code(self):
        self.assertEqual(v.require_valid_old_apk(BADGING, SIGNATURE), 1154)
        for data, signature in [
            (BADGING.replace("cz.zamerovac.app.preview", "evil.app"), SIGNATURE),
            (BADGING, "Signer certificate different"),
            (BADGING.replace("1154", "2147483646"), SIGNATURE),
            (BADGING.replace("1154", "999"), SIGNATURE),
        ]:
            with self.subTest(data=data, signature=signature):
                with self.assertRaises(ValueError):
                    v.require_valid_old_apk(data, signature)

    def test_current_and_future_release_codes_not_fixed(self):
        actual = v.version_values(1154, "1.3.0", "test-v1.3.0")
        self.assertEqual(actual["QA_PREVIEW_EXPECTED_CODE"], "1155")
        self.assertEqual(actual["QA_PREVIEW_BUILD_OFFSET"], "155")
        self.assertEqual(actual["QA_PREVIEW_EXPECTED_VERSION_NAME"], "1.3.0-test")
        later = v.version_values(1199, "1.3.2", "test-v1.3.1")
        self.assertEqual(later["QA_PREVIEW_EXPECTED_CODE"], "1200")
        self.assertEqual(later["QA_PREVIEW_BUILD_OFFSET"], "200")
        self.assertEqual(later["QA_PREVIEW_EXPECTED_VERSION_NAME"], "1.3.2-test")

    def test_downgrade_overflow_and_bad_semver_stop(self):
        for prior, current, tag in [
            (1154, "1.2.9", "test-v1.3.0"),
            (2147483646, "1.3.2", "test-v1.3.1"),
            (1154, "1.3.2", "test-vbad"),
            (1154, "1.3.2", "test-v1.3.9"),
        ]:
            with self.subTest(prior=prior, current=current, tag=tag):
                with self.assertRaises(ValueError):
                    v.version_values(prior, current, tag)

    def test_authorization_stripped_cross_origin(self):
        original = urllib.request.Request(
            v.API + "/releases/assets/123",
            headers={"Authorization": "Bearer FAKE_TOKEN", "Cookie": "FAKE_COOKIE",
                     "X-GitHub-Api-Version": "2022-11-28"}
        )
        redirect = v.SafeAssetRedirect().redirect_request(
            original, None, 302, "Found", {},
            "https://release-assets.githubusercontent.com/asset"
        )
        self.assertNotIn("Authorization", redirect.headers)
        self.assertFalse(any(k.lower() == "cookie" for k in redirect.headers))
        self.assertFalse(any(k.lower() == "x-github-api-version" for k in redirect.headers))

    def test_https_only_redirect(self):
        original = urllib.request.Request(
            v.API + "/releases/assets/123",
            headers={"Authorization": "Bearer FAKE_TOKEN"})
        with self.assertRaisesRegex(ValueError, "insecure"):
            v.SafeAssetRedirect().redirect_request(
                original, None, 302, "Found", {}, "http://example.invalid/asset")

    def test_api_only_correct_repo(self):
        for url in [
            "https://api.github.com.evil.invalid/repos/zaplikj30-ui/Zamerovac-android/releases",
            "http://api.github.com/repos/zaplikj30-ui/Zamerovac-android/releases",
            "https://api.github.com/repos/other/repo/releases",
            "https://api.github.com:444/repos/zaplikj30-ui/Zamerovac-android/releases",
        ]:
            with self.subTest(url=url):
                with self.assertRaises(ValueError):
                    v.api_read(url, "FAKE_TOKEN")

    def test_workflow_requires_exact_dynamic_preflight(self):
        workflow = (Path(__file__).resolve().parents[1] /
                    ".github/workflows/windows-self-hosted-qa.yml").read_text("utf-8")
        self.assertIn("home_qa_version_preflight import main", workflow)
        self.assertIn('set "GITHUB_RUN_NUMBER=%QA_PREVIEW_BUILD_OFFSET%"', workflow)
        self.assertIn("versionCode='%QA_PREVIEW_EXPECTED_CODE%'", workflow)
        self.assertIn("versionName='%QA_PREVIEW_EXPECTED_VERSION_NAME%'", workflow)
        self.assertNotIn('set "GITHUB_RUN_NUMBER=155"', workflow)
        self.assertNotIn("versionCode='1155'", workflow)
        self.assertIn("if: always()", workflow)
        self.assertIn('del /f /q "app\\build\\outputs\\apk\\preview\\app-preview.apk"', workflow)


if __name__ == "__main__":
    unittest.main()
