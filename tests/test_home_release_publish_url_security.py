"""Offline tests of actual embedded home APK publishing Python.

No real GitHub token, no requests, no Android build and no release publishing.
"""
import ast
from pathlib import Path
import re
import unittest
import urllib.parse
import urllib.request

YAML = (Path(__file__).resolve().parents[1] /
        ".github/workflows/windows-home-apk-release.yml").read_text(encoding="utf-8")


def publication_nodes():
    lines = YAML.splitlines()
    start = lines.index("      - name: Publish only explicitly approved RELEASE after passing every gate")
    begin = next(i for i in range(start + 1, len(lines)) if lines[i] == "        run: |")
    body = []
    for line in lines[begin + 1:]:
        if line.startswith("          "):
            body.append(line[10:])
        elif not line.strip():
            body.append("")
        else:
            break
    tree = ast.parse("\n".join(body) + "\n")
    funcs = [node for node in tree.body
             if isinstance(node, (ast.FunctionDef, ast.ClassDef))
             and node.name in ("trusted_publish_url", "RejectAuthenticatedRedirect")]
    if len(funcs) != 2:
        raise ValueError("Missing real publish guards")
    return funcs


sandbox = {
    "repo": "zaplikj30-ui/Zamerovac-android",
    "urllib": urllib,
    "re": re,
}
exec(compile(ast.Module(body=publication_nodes(), type_ignores=[]),
             "<actual-publish-workflow>", "exec"), sandbox)
verify = sandbox["trusted_publish_url"]
base = "https://api.github.com/repos/zaplikj30-ui/Zamerovac-android/releases"
upload = "https://uploads.github.com/repos/zaplikj30-ui/Zamerovac-android/releases/42/assets"


class ReleasePublishingSecurity(unittest.TestCase):
    def test_expected_release_api_calls_allowed(self):
        for address, method in [
            (base, "POST"),
            (base + "/tags/test-v1.3.1", "GET"),
            (base + "/42", "PATCH"),
        ]:
            with self.subTest(address=address):
                self.assertIsNone(verify(address, method))

    def test_exact_upload_endpoint_and_name_allowed(self):
        self.assertIsNone(verify(upload + "?name=Zamerovac-v1.3.1.apk", "POST"))

    def test_wrong_hosts_ports_paths_and_schemes_rejected(self):
        addresses = [
            "http://api.github.com/repos/zaplikj30-ui/Zamerovac-android/releases",
            "https://api.github.com.evil.invalid/repos/zaplikj30-ui/Zamerovac-android/releases",
            "https://other.invalid/repos/zaplikj30-ui/Zamerovac-android/releases",
            "https://api.github.com:444/repos/zaplikj30-ui/Zamerovac-android/releases",
            "https://api.github.com/repos/other/repo/releases",
            "https://api.github.com/repos/zaplikj30-ui/Zamerovac-android/releases-fake",
            "https://username:password@api.github.com/repos/zaplikj30-ui/Zamerovac-android/releases",
            base + "#fragment",
            base + "?redirect=evil.invalid",
        ]
        for address in addresses:
            with self.subTest(address=address):
                with self.assertRaises(ValueError):
                    verify(address, "POST")

    def test_upload_host_cannot_be_used_for_arbitrary_paths(self):
        for address, method in [
            (upload + "?name=Zamerovac-v1.3.1.apk", "GET"),
            (upload.replace("/42/", "/foo/") + "?name=Zamerovac-v1.3.1.apk", "POST"),
            (upload + "?name=../../x.apk", "POST"),
            (upload + "?name=Zamerovac-v1.3.1.apk&evil=1", "POST"),
            (upload + "?name=Zamerovac-v1.3.1.apk&name=other.apk", "POST"),
            (upload + "?name=", "POST"),
        ]:
            with self.subTest(address=address, method=method):
                with self.assertRaises(ValueError):
                    verify(address, method)

    def test_all_authenticated_redirects_refused(self):
        guard = sandbox["RejectAuthenticatedRedirect"]()
        original = urllib.request.Request(
            base, headers={"Authorization": "Bearer FAKE_NOT_A_REAL_TOKEN"})
        for destination in ["https://uploads.github.com/somewhere",
                            "https://evil.invalid/steal",
                            "http://api.github.com/unsafe"]:
            with self.subTest(destination=destination):
                with self.assertRaisesRegex(ValueError, "must not redirect"):
                    guard.redirect_request(original, None, 302, "Found", {}, destination)

    def test_workflow_requires_owner_main_and_approved_release(self):
        self.assertIn("  workflow_dispatch:", YAML)
        self.assertNotIn("\n  pull_request:", YAML)
        self.assertNotIn("\n  push:", YAML)
        self.assertIn("github.actor == 'zaplikj30-ui'", YAML)
        self.assertIn("github.ref == 'refs/heads/main'", YAML)
        self.assertIn("inputs.publish_release == true", YAML)
        self.assertIn("qa_run_id", YAML)

    def test_publish_uses_restrictive_opener_not_default_urlopen(self):
        block = YAML.split("      - name: Publish only explicitly approved RELEASE")[1]
        block = block.split("      - name: Clean only local signed APK")[0]
        self.assertIn("trusted_publish_url(url, method)", block)
        self.assertIn("publish_opener.open(req, timeout=120)", block)
        self.assertNotIn("urllib.request.urlopen(req, timeout=120)", block)


if __name__ == "__main__":
    unittest.main()
