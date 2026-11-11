"""Fail-closed tests for owner-only permanent HOME QA. No runner/cloud needed."""
import importlib.util
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


if __name__ == '__main__':
    unittest.main()
