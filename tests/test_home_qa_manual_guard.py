"""Fail-closed tests for owner-only permanent HOME QA. No runner/cloud needed."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('guard', ROOT / 'tools/home_qa_manual_guard.py')
guard = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(guard)

MAIN_SHA = 'c604860db4fddeefc077e27411bc1941815f7d94'
APPROVED = '3f2779ec9b5c432296f9db2bad8502cc4ff63588'


class ManualGuardTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        (self.root / '.git').mkdir()
        workflow = self.root / '.github' / 'workflows'
        workflow.mkdir(parents=True)
        (workflow / 'home-qa-manual.yml').write_bytes(
            (ROOT / '.github/workflows/home-qa-manual.yml').read_bytes())
        self.env = dict(GITHUB_ACTIONS='true', GITHUB_REPOSITORY=guard.REPO,
                        GITHUB_ACTOR=guard.OWNER, GITHUB_EVENT_NAME='workflow_dispatch',
                        GITHUB_REF='refs/heads/main', RUNNER_ENVIRONMENT='self-hosted',
                        USERNAME='ZamerovacQA', GITHUB_SHA=MAIN_SHA,
                        REQUESTED_SOURCE_SHA=APPROVED)

    @mock.patch.object(guard.subprocess, 'check_output', return_value=MAIN_SHA)
    def test_allowed_only(self, _git):
        self.assertEqual(guard.authorize(self.env, self.root), APPROVED)

    def test_forbidden_contexts(self):
        cases = dict(GITHUB_ACTIONS='false', GITHUB_REPOSITORY='attacker/fork',
                     GITHUB_ACTOR='stranger', GITHUB_EVENT_NAME='pull_request',
                     GITHUB_REF='refs/heads/qa/evil', RUNNER_ENVIRONMENT='github-hosted',
                     USERNAME='Admin', GITHUB_SHA='deadbeef',
                     GITHUB_HEAD_REF='fork', GITHUB_BASE_REF='main',
                     REQUESTED_SOURCE_SHA='f'*40)
        with mock.patch.object(guard.subprocess, 'check_output', return_value=MAIN_SHA):
            for key, value in cases.items():
                with self.subTest(key=key):
                    changed = dict(self.env, **{key: value})
                    with self.assertRaises(ValueError):
                        guard.authorize(changed, self.root)

    @mock.patch.object(guard.subprocess, 'check_output', return_value=MAIN_SHA)
    def test_no_injection_or_unknown_sha(self, _git):
        for source in ('', 'x'*40, '3f2779ec9b5c432296f9db2bad8502cc4ff63588 & echo bad',
                       APPROVED.upper(), 'main', 'refs/pull/105/head', '../source'):
            with self.subTest(source=source), self.assertRaises(ValueError):
                guard.authorize(dict(self.env, REQUESTED_SOURCE_SHA=source), self.root)

    @mock.patch.object(guard.subprocess, 'check_output', return_value=MAIN_SHA)
    def test_trusted_checkout_mismatch(self, _git):
        with self.assertRaisesRegex(ValueError, 'trusted checkout mismatch'):
            guard.authorize(dict(self.env, GITHUB_SHA='a'*40), self.root)

    def test_workflow_modified(self):
        path = self.root / '.github/workflows/home-qa-manual.yml'
        for snippet in ('\n  pull_request:\n', '\n  ubuntu-latest\n', '\n  extra-job:\n',
                        '\n  permissions: write-all\n', '\n  arbitrary: |\n    echo surprise\n'):
            with self.subTest(snippet=snippet):
                path.write_bytes((ROOT / '.github/workflows/home-qa-manual.yml').read_bytes() + snippet.encode())
                with self.assertRaisesRegex(ValueError, 'workflow differs'):
                    guard.verify_workflow(path)

    @mock.patch.object(guard.subprocess, 'check_output', return_value=APPROVED)
    def test_source_exact(self, _git):
        guard.verify_source(self.root, APPROVED)

    @mock.patch.object(guard.subprocess, 'check_output', return_value='b'*40)
    def test_source_mismatch(self, _git):
        with self.assertRaisesRegex(ValueError, 'source SHA mismatch'):
            guard.verify_source(self.root, APPROVED)

    def test_workflow_static_properties(self):
        text = (ROOT / '.github/workflows/home-qa-manual.yml').read_text()
        guard.verify_workflow(ROOT / '.github/workflows/home-qa-manual.yml')
        self.assertNotIn('pull_request:', text)
        self.assertNotIn('ubuntu-latest', text)
        self.assertNotIn('powershell', text.lower())
        self.assertIn('persist-credentials: false', text)
        self.assertEqual(text.count('runs-on:'), 1)
        self.assertIn('runs-on: [self-hosted, Windows, X64, zamerovac-qa]', text)
        self.assertIn('cancel-in-progress: false', text)
        self.assertIn('ref: ${{ env.QA_ALLOWED_SHA }}', text)
        self.assertNotIn('publish_release', text)

    def test_evidence_fresh_after_interrupted_attempt(self):
        temp = self.root / "runner-temp"
        temp.mkdir()
        envfile = self.root / "github-env"
        envfile.write_text("")
        settings = dict(self.env, QA_ALLOWED_SHA=APPROVED, GITHUB_RUN_ID="12345",
                        GITHUB_RUN_ATTEMPT="2", RUNNER_TEMP=str(temp),
                        GITHUB_ENV=str(envfile))
        with mock.patch.object(guard.subprocess, 'check_output', return_value=MAIN_SHA):
            first = guard.prepare_evidence(settings, self.root)
            first_result = first / "Zamerovac-QA/results"
            self.assertEqual(json.loads((first_result / "run.json").read_text()),
                             dict(kind="synthetic-home-qa", source_sha=APPROVED,
                                  trusted_sha=MAIN_SHA, run_id="12345",
                                  run_attempt="2"))
            (first_result / "old-sensitive-synthetic-result.txt").write_text("OLD")
            second = guard.prepare_evidence(settings, self.root)
        self.assertNotEqual(first, second)
        self.assertNotIn("old-sensitive", "\n".join(
            p.name for p in (second / "Zamerovac-QA/results").iterdir()))
        self.assertEqual([p.name for p in (second / "Zamerovac-QA/results").iterdir()],
                         ["run.json"])
        self.assertTrue((first_result / "old-sensitive-synthetic-result.txt").exists())
        lines = envfile.read_text().splitlines()
        self.assertEqual(lines[-2:], ["QA_EVIDENCE_DIR=" + str(second),
                                       "LOCALAPPDATA=" + str(second)])

    def test_unauthorized_sha_and_stale_evidence_never_upload(self):
        temp = self.root / "runner-temp"
        temp.mkdir()
        stale = temp / "old-run" / "Zamerovac-QA" / "results"
        stale.mkdir(parents=True)
        (stale / "old.txt").write_text("stale")
        envfile = self.root / "github-env"
        envfile.write_text("")
        settings = dict(self.env, QA_ALLOWED_SHA=APPROVED, GITHUB_RUN_ID="333",
                        GITHUB_RUN_ATTEMPT="1", RUNNER_TEMP=str(temp),
                        GITHUB_ENV=str(envfile),
                        REQUESTED_SOURCE_SHA="f"*40)
        with mock.patch.object(guard.subprocess, 'check_output', return_value=MAIN_SHA):
            with self.assertRaisesRegex(ValueError, "NOT independently allowed"):
                guard.prepare_evidence(settings, self.root)
        self.assertEqual(envfile.read_text(), "")
        self.assertEqual(list(temp.glob("zamerovac-home-*")), [])
        self.assertEqual((stale / "old.txt").read_text(), "stale")

    def test_evidence_identity_errors_fail_closed(self):
        temp = self.root / "runner-temp"
        temp.mkdir()
        envfile = self.root / "github-env"
        envfile.write_text("")
        settings = dict(self.env, QA_ALLOWED_SHA=APPROVED, GITHUB_RUN_ID="1",
                        GITHUB_RUN_ATTEMPT="1", RUNNER_TEMP=str(temp),
                        GITHUB_ENV=str(envfile))
        with mock.patch.object(guard.subprocess, 'check_output', return_value=MAIN_SHA):
            for change in (dict(GITHUB_RUN_ID="1\nX=1"),
                           dict(GITHUB_RUN_ATTEMPT="x"),
                           dict(QA_ALLOWED_SHA="f"*40),
                           dict(RUNNER_TEMP=str(temp / "missing"))):
                with self.subTest(change=change), self.assertRaises(ValueError):
                    guard.prepare_evidence(dict(settings, **change), self.root)
        self.assertEqual(list(temp.glob("zamerovac-home-*")), [])
        self.assertEqual(envfile.read_text(), "")

    def test_workflow_guards_artifact_upload_and_orders_guard_tests(self):
        text = (ROOT / '.github/workflows/home-qa-manual.yml').read_text()
        tests_step = text.index("Trusted-main fail-closed guard regression tests")
        auth_step = text.index("id: authorize")
        source_checkout = text.index("Read-only checkout of explicitly approved source SHA")
        source_check = text.index("id: source_verified")
        evidence_step = text.index("id: evidence_ready")
        quick_step = text.index("id: quick")
        upload_step = text.index("Upload quick test evidence")
        self.assertTrue(tests_step < auth_step < source_checkout <
                        source_check < evidence_step < quick_step < upload_step)
        tests_chunk = text[tests_step:auth_step]
        self.assertIn("python -m unittest discover -s tests -p test_home_qa_manual_guard.py -v",
                      tests_chunk)
        self.assertIn("if errorlevel 1 exit /b 1", tests_chunk)
        upload = text[upload_step:]
        for gate in ("steps.authorize.outcome == 'success'",
                     "steps.source_verified.outcome == 'success'",
                     "steps.evidence_ready.outcome == 'success'",
                     "env.QA_QUICK_STARTED == 'true'",
                     "steps.quick.outcome == 'success'",
                     "steps.quick.outcome == 'failure'"):
            self.assertIn(gate, upload)
        self.assertIn("path: ${{ env.QA_EVIDENCE_DIR }}", upload)
        self.assertNotIn("path: qa-evidence/", upload)
        self.assertIn("github.run_id", upload)
        self.assertIn("github.run_attempt", upload)
        self.assertIn("echo QA_QUICK_STARTED=true", text[quick_step:upload_step])


if __name__ == '__main__':
    unittest.main()
