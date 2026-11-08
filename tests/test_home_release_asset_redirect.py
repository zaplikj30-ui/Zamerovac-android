"""Offline regression for GitHub bearer credentials during release asset redirects.

No network, no APK and no real token. Parse the exact embedded Python
from the Windows release workflow and run only the redirect handler.
"""
import ast
from pathlib import Path
import sys
import unittest
from unittest import mock
import urllib.error
import urllib.parse
import urllib.request


YAML = (Path(__file__).resolve().parents[1] /
        ".github/workflows/windows-home-apk-release.yml").read_text(encoding="utf-8")


def extract_release_python():
    lines = YAML.splitlines()
    start = lines.index(
        "      - name: Validate real home QA run and previous released APK versionCode and signer"
    )
    run_start = next(i for i in range(start + 1, len(lines))
                     if lines[i] == "        run: |")
    body = []
    for line in lines[run_start + 1:]:
        if line.startswith("          "):
            body.append(line[10:])
        elif not line.strip():
            body.append("")
        else:
            break
    return "\n".join(body) + "\n"


CODE = extract_release_python()
AST = ast.parse(CODE)
HANDLER_NODE = next(n for n in AST.body if isinstance(n, ast.ClassDef)
                    and n.name == "VerifiedReleaseAssetRedirect")
REQUEST_NODE = next(n for n in AST.body if isinstance(n, ast.FunctionDef)
                    and n.name == "request")

CONTEXT = {
    "urllib": urllib, "sys": sys, "token": "FAKE_DO_NOT_USE_REAL_TOKEN"
}
exec(compile(ast.Module(body=[HANDLER_NODE, REQUEST_NODE], type_ignores=[]),
             "<embedded-home-release-python>", "exec"), CONTEXT)


class ReleaseRedirectSecurity(unittest.TestCase):
    def setUp(self):
        self.original = urllib.request.Request(
            "https://api.github.com/repos/zaplikj30-ui/Zamerovac-android/releases/assets/123",
            headers={"Authorization": "Bearer FAKE_DO_NOT_USE_REAL_TOKEN",
                     "X-GitHub-Api-Version": "2022-11-28"}
        )
        self.handler = CONTEXT["VerifiedReleaseAssetRedirect"]()

    def redirect(self, target):
        return self.handler.redirect_request(
            self.original, None, 302, "Found", {}, target
        )

    def test_plain_python_would_forward_fake_token(self):
        standard = urllib.request.HTTPRedirectHandler().redirect_request(
            self.original, None, 302, "Found", {},
            "https://release-assets.githubusercontent.com/signed-asset"
        )
        self.assertIn("Authorization", standard.headers)

    def test_cross_host_signed_asset_never_receives_token(self):
        req = self.redirect("https://release-assets.githubusercontent.com/signed-asset")
        self.assertNotIn("Authorization", req.headers)
        self.assertNotIn("X-github-api-version", req.headers)
        self.assertEqual(req.full_url, "https://release-assets.githubusercontent.com/signed-asset")

    def test_other_https_host_also_never_receives_token(self):
        req = self.redirect("https://untrusted.invalid/path")
        self.assertNotIn("Authorization", req.headers)

    def test_same_origin_github_api_retains_token(self):
        req = self.redirect(
            "https://api.github.com/repos/zaplikj30-ui/Zamerovac-android/releases/assets/124"
        )
        self.assertEqual(req.get_header("Authorization"),
                         "Bearer FAKE_DO_NOT_USE_REAL_TOKEN")

    def test_insecure_http_redirect_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "insecure"):
            self.redirect("http://release-assets.githubusercontent.com/signed-asset")

    def test_request_rejects_non_api_origin_before_network(self):
        with self.assertRaises(SystemExit):
            CONTEXT["request"](
                "https://api.github.com.evil.invalid/repos/zaplikj30-ui/Zamerovac-android/releases/assets/123"
            )

    def test_request_rejects_wrong_repo_before_network(self):
        with self.assertRaises(SystemExit):
            CONTEXT["request"]("https://api.github.com/repos/other/repo/releases/assets/5")

    def test_workflow_stays_owner_only_and_manual(self):
        self.assertIn("  workflow_dispatch:", YAML)
        self.assertNotIn("  pull_request:", YAML)
        self.assertNotIn("  push:", YAML)
        self.assertIn("github.actor == 'zaplikj30-ui'", YAML)
        self.assertIn("inputs.publish_release == true", YAML)
        self.assertIn("with release_asset_opener.open(req, timeout=80)", CODE)
        self.assertIn("VerifiedReleaseAssetRedirect()", CODE)


if __name__ == "__main__":
    unittest.main()
