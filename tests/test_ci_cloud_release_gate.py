"""Source-only security regression for the approved GitHub-native APK process.

No GitHub token, network, cloud jobs, product build, or release is triggered.
"""
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = (ROOT / '.github/workflows/build-apk.yml').read_text(encoding='utf-8')
GATE = (ROOT / 'tools/release/apk_gate.py').read_text(encoding='utf-8')
DESIGN = (ROOT / 'docs/qa/CHATGPT_APK_DISPATCH_DESIGN.md').read_text(encoding='utf-8')


def job(name):
    start = WORKFLOW.index('  ' + name + ':\n')
    following = WORKFLOW[start + 3:]
    next_job = re.search(r'(?m)^  [a-z][a-z_-]*:', following)
    return WORKFLOW[start:start + 3 + next_job.start() if next_job else None]


class CloudReleaseSafetyGateTest(unittest.TestCase):
    def test_owner_comment_or_manual_only(self):
        self.assertIn('  issue_comment:\n    types: [created]', WORKFLOW)
        self.assertIn('  workflow_dispatch:', WORKFLOW)
        self.assertNotRegex(WORKFLOW, r'(?m)^  (?:push|pull_request|pull_request_target|schedule|workflow_run):')
        self.assertNotIn('cloud_run_approved:', WORKFLOW)
        self.assertNotIn('publish_release:', WORKFLOW)

    def test_owner_issue_main_and_exact_authentication(self):
        for text in ('github.actor == \'zaplikj30-ui\'',
                     'github.triggering_actor == \'zaplikj30-ui\'',
                     "github.ref == 'refs/heads/main'",
                     'github.event.issue.number == 183',
                     'github.event.comment.user.id == 351234773',
                     'github.run_attempt == 1',
                     'GITHUB_EVENT_PATH', 're.fullmatch',
                     "comment.get('created_at')!=comment.get('updated_at')"):
            self.assertIn(text, WORKFLOW)
        for phrase in ('ZAMEROVAC PILOT', 'ZAMEROVAC BUILD ', 'ZAMEROVAC RELEASE '):
            self.assertIn(phrase, WORKFLOW)

    def test_pilot_is_read_only_no_build_or_publish(self):
        pilot = job('authorize')
        self.assertIn('contents: read', pilot)
        self.assertNotIn('contents: write', pilot)
        self.assertNotIn('assemblePreview', pilot)
        self.assertNotIn('gh release create', pilot)
        self.assertNotIn('actions/checkout', pilot)

    def test_build_only_no_write_and_trusted_source(self):
        build = job('build')
        self.assertIn('contents: read', build)
        self.assertNotIn('contents: write', build)
        self.assertIn('persist-credentials: false', build)
        self.assertIn('source_sha', build)
        self.assertIn('build-preflight', build)
        self.assertIn('build-postflight', build)
        self.assertIn('assemblePreview', build)
        self.assertIn('upload-artifact@v4', build)
        self.assertNotIn('gh release create', build)

    def test_previous_published_apk_determines_next_version_code(self):
        for snippet in ('def previous(', 'def inspect_apk(', 'SIGNER =', 'PACKAGE =',
                        'new_code = old["version_code"] + 1',
                        'if semver(version) <= semver(old_version)',
                        'if meta["version_code"] != int(os.environ["NEW_CODE"])'):
            self.assertIn(snippet, GATE)
        self.assertIn('verifyDriveRegistration assemblePreview', WORKFLOW)
        self.assertIn('python3 -m unittest discover', WORKFLOW)

    def test_release_only_separately_authorized_same_bytes(self):
        release = job('release')
        self.assertIn('contents: write', release)
        self.assertIn('actions: read', release)
        self.assertIn('release-preflight', release)
        self.assertIn('release-recheck', release)
        self.assertIn('release-post', release)
        self.assertIn('gh release create', release)
        self.assertNotIn('assemblePreview', release)
        self.assertNotIn('actions/checkout', release)
        for snippet in ('if sha != requested_hash', 'if hashlib.sha256(data).hexdigest() != expected_hash',
                        'run.get("run_attempt") != 1', 'decode_single_apk(',
                        'tag already exists before create', 'revalidate_current_approval('):
            self.assertIn(snippet, GATE)

    def test_no_retry_or_tag_overwrite(self):
        release = job('release')
        self.assertNotIn('--clobber', release)
        self.assertNotIn('--force', release)
        self.assertNotIn('sleep ', release)
        self.assertNotIn('for attempt', release)
        self.assertEqual(WORKFLOW.count('contents: write'), 1)

    def test_synchronized_job_concurrency_and_rerun_guards(self):
        self.assertEqual(WORKFLOW.count('group: zamerovac-apk-owner-commands'), 3)
        self.assertEqual(WORKFLOW.count('queue: max'), 3)
        self.assertEqual(WORKFLOW.count('github.run_attempt == 1'), 3)
        self.assertNotIn('cancel-in-progress: true', WORKFLOW)

    def test_home_workflow_retired_and_no_active_legacy_release_bypass(self):
        # Explicit owner decision #6978003077: both HOME workflows are gone.
        # Historical design discussion is retained; only active YAML may run.
        workflows = ROOT / ".github" / "workflows"
        for path in ('windows-home-apk-release.yml', 'windows-self-hosted-qa.yml'):
            self.assertFalse((workflows / path).exists(), 'retired HOME entrypoint reappeared')
        active = list(workflows.glob('*.yml'))
        self.assertTrue(active, 'no active workflow files found')
        for path in active:
            with self.subTest(path=path.name):
                text = path.read_text(encoding='utf-8')
                self.assertNotIn('runs-on: [self-hosted', text)
                self.assertNotIn('zamerovac-qa]', text)
                if 'gh release create' in text:
                    self.assertEqual(path.name, 'build-apk.yml')
        self.assertIn('HOME RETIRED', DESIGN)


if __name__ == '__main__':
    unittest.main()
