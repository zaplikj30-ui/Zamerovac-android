"""F1: offline HTTP fixtures for Actions ZIP and Release APK download isolation.

No actual GitHub request, token, artifact, release, or cloud runner is used.
"""
import importlib.util
import io
from pathlib import Path
import unittest
from unittest import mock
import urllib.error
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("f1_apk_gate", ROOT / "tools/release/apk_gate.py")
gate = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(gate)
TOKEN = "SYNTHETIC_TOKEN_DO_NOT_USE"
API = "https://api.github.com/repos/" + gate.REPO + "/actions/artifacts/123/zip"
AZURE = "https://productionresultssa37.blob.core.windows.net/actions-results/demo/artifact.zip?sig=fake"
RELEASE = "https://release-assets.githubusercontent.com/asset?sig=fake"


def zip_bytes():
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w") as z:
        z.writestr("Zamerovac-v1.4.1.apk", b"ONLY SYNTHETIC DATA")
    return out.getvalue()


class Response:
    def __init__(self, content=b"bytes", content_type="application/zip"):
        self.content = content
        self.headers = {"Content-Type": content_type}

    def __enter__(self):
        return self

    def __exit__(self, *unused):
        return False

    def read(self, limit):
        return self.content[:limit]


class Opener:
    def __init__(self, sequence):
        self.sequence = list(sequence)
        self.calls = []

    def open(self, request, timeout):
        self.calls.append((request, timeout))
        if not self.sequence:
            raise AssertionError("unexpected extra network request")
        outcome = self.sequence.pop(0)
        if isinstance(outcome, Exception):
            raise outcome
        if isinstance(outcome, str):
            raise urllib.error.HTTPError(request.full_url, 302, "Found",
                                         {"Location": outcome}, None)
        return outcome


def error(code):
    return urllib.error.HTTPError(API, code, "fixture", {}, None)


class TestActionsArchiveDownload(unittest.TestCase):
    def test_302_to_production_storage_uses_json_accept_and_no_token(self):
        raw = zip_bytes()
        opener = Opener([AZURE, Response(raw)])
        self.assertEqual(gate.GitHubAPI(TOKEN, opener).artifact_zip(123), raw)
        self.assertEqual(len(opener.calls), 2)
        api_req, api_timeout = opener.calls[0]
        self.assertEqual(api_req.full_url, API)
        self.assertEqual(api_req.get_header("Accept"), "application/vnd.github+json")
        self.assertEqual(api_req.get_header("Authorization"), "Bearer " + TOKEN)
        self.assertEqual(api_timeout, 30)
        blob_req, blob_timeout = opener.calls[1]
        self.assertEqual(blob_req.full_url, AZURE)
        self.assertEqual(blob_timeout, 60)
        self.assertFalse(any(key.lower() in ("authorization", "cookie") for key in blob_req.headers))
        self.assertNotIn(TOKEN, str(blob_req.headers))

    def test_valid_documented_azure_storage_ranges_and_200(self):
        for number in (4, 12, 30, 49, 100, 199):
            url = f"https://productionresultssa{number}.blob.core.windows.net/actions-results/a.zip?sig=fake"
            with self.subTest(number=number):
                opener = Opener([url, Response(zip_bytes())])
                self.assertEqual(gate.GitHubAPI(TOKEN, opener).artifact_zip("123"), zip_bytes())
        direct = Opener([Response(zip_bytes())])
        self.assertEqual(gate.GitHubAPI(TOKEN, direct).artifact_zip(123), zip_bytes())
        self.assertEqual(len(direct.calls), 1)

    def test_415_unsupported_media_type_is_safe_stop(self):
        opener = Opener([error(415)])
        with self.assertRaisesRegex(RuntimeError, "HTTP 415"):
            gate.GitHubAPI(TOKEN, opener).artifact_zip(123)
        self.assertEqual(len(opener.calls), 1)
        self.assertEqual(opener.calls[0][0].get_header("Accept"), "application/vnd.github+json")

    def test_release_asset_remains_octet_stream_and_rejects_azure_redirect(self):
        opener = Opener([RELEASE, Response(b"SYNTHETIC APK")])
        self.assertEqual(gate.GitHubAPI(TOKEN, opener).request("/releases/assets/7", binary=True), b"SYNTHETIC APK")
        self.assertEqual(opener.calls[0][0].get_header("Accept"), "application/octet-stream")
        self.assertIsNone(opener.calls[1][0].get_header("Authorization"))
        opener = Opener([AZURE])
        with self.assertRaisesRegex(RuntimeError, "untrusted asset redirect"):
            gate.GitHubAPI(TOKEN, opener).request("/releases/assets/7", binary=True)
        self.assertEqual(len(opener.calls), 1)
        opener = Opener([RELEASE])
        with self.assertRaisesRegex(RuntimeError, "untrusted asset redirect"):
            gate.GitHubAPI(TOKEN, opener).artifact_zip(123)
        self.assertEqual(len(opener.calls), 1)

    def test_external_redirect_hosts_and_unsafe_urls_never_get_a_request(self):
        bad = (
            "http://productionresultssa30.blob.core.windows.net/a.zip",
            "https://productionresultssa30.blob.core.windows.net.evil.invalid/a.zip",
            "https://wrong.blob.core.windows.net/a.zip",
            "https://productionresultssa.blob.core.windows.net/a.zip",
            "https://user:secret@productionresultssa30.blob.core.windows.net/a.zip",
            "https://productionresultssa30.blob.core.windows.net:444/a.zip",
            "https://productionresultssa30.blob.core.windows.net/a.zip#fragment",
            "https://productionresultssa30.blob.core.windows.net:bad/a.zip",
            "https://evil.invalid/steal?token=fake",
        )
        for url in bad:
            with self.subTest(url=url):
                opener = Opener([url])
                with self.assertRaisesRegex(RuntimeError, "untrusted asset redirect"):
                    gate.GitHubAPI(TOKEN, opener).artifact_zip(123)
                self.assertEqual(len(opener.calls), 1)

    def test_second_redirect_never_carries_bearer_or_cookie(self):
        second = "https://productionresultssa100.blob.core.windows.net/actions-results/other?sig=fake"
        opener = Opener([AZURE, second, Response(b"archive")])
        self.assertEqual(gate.GitHubAPI(TOKEN, opener).artifact_zip(123), b"archive")
        for req, timeout in opener.calls[1:]:
            self.assertIsNone(req.get_header("Authorization"))
            self.assertIsNone(req.get_header("Cookie"))
            self.assertEqual(timeout, 60)
        blocked = Opener([AZURE, "https://untrusted.invalid/bad"])
        with self.assertRaisesRegex(RuntimeError, "untrusted asset redirect"):
            gate.GitHubAPI(TOKEN, blocked).artifact_zip(123)
        self.assertEqual(len(blocked.calls), 2)

    def test_timeouts_are_safe_stop_no_retry_or_signed_url_leak(self):
        for first in (urllib.error.URLError("timed out"), TimeoutError("timed out")):
            with self.subTest(first=type(first).__name__):
                opener = Opener([first])
                with self.assertRaisesRegex(RuntimeError, "API network error"):
                    gate.GitHubAPI(TOKEN, opener).artifact_zip(123)
                self.assertEqual(len(opener.calls), 1)
        opener = Opener([AZURE, urllib.error.URLError("timed out " + AZURE)])
        with self.assertRaisesRegex(RuntimeError, "binary download network error") as err:
            gate.GitHubAPI(TOKEN, opener).artifact_zip(123)
        self.assertNotIn("sig=fake", str(err.exception))
        self.assertEqual(len(opener.calls), 2)

    def test_oversize_json_and_bad_http_status_fail_closed(self):
        with mock.patch.object(gate, "MAX_ZIP", 8):
            opener = Opener([AZURE, Response(b"0123456789")])
            with self.assertRaisesRegex(RuntimeError, "size limit"):
                gate.GitHubAPI(TOKEN, opener).artifact_zip(123)
            direct = Opener([Response(b"0123456789")])
            with self.assertRaisesRegex(RuntimeError, "size limit"):
                gate.GitHubAPI(TOKEN, direct).artifact_zip(123)
        opener = Opener([Response(b"{}", "application/vnd.github+json")])
        with self.assertRaisesRegex(RuntimeError, "returned JSON"):
            gate.GitHubAPI(TOKEN, opener).artifact_zip(123)
        opener = Opener([AZURE, error(403)])
        with self.assertRaisesRegex(RuntimeError, "CDN HTTP 403"):
            gate.GitHubAPI(TOKEN, opener).artifact_zip(123)

    def test_invalid_artifact_id_and_too_many_redirects(self):
        for invalid in (0, -1, "01", "x", "123/other", 2**63):
            opener = Opener([])
            with self.subTest(invalid=invalid), self.assertRaises(RuntimeError):
                gate.GitHubAPI(TOKEN, opener).artifact_zip(invalid)
            self.assertEqual(opener.calls, [])
        opener = Opener([AZURE] * 7)
        with self.assertRaisesRegex(RuntimeError, "too many CDN redirects"):
            gate.GitHubAPI(TOKEN, opener).artifact_zip(123)
        self.assertEqual(len(opener.calls), 6)


if __name__ == "__main__":
    unittest.main()
