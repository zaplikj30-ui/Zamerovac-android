"""Exercise Bash revision selection and checkout verification in the hosted workflow.

Local fixtures only: no network, GitHub Actions, browser or product modification.
"""
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

WORKFLOW = Path(__file__).resolve().parents[1] / '.github/workflows/chromium-simple.yml'


def step_script(name):
    lines = WORKFLOW.read_text(encoding='utf-8').splitlines()
    marker = '      - name: ' + name
    try:
        start = lines.index(marker)
    except ValueError as exc:
        raise AssertionError(f'Missing workflow step: {name}') from exc
    block = []
    in_run = False
    for line in lines[start + 1:]:
        if line.startswith('      - ') or line.startswith('      #'):
            break
        if line == '        run: |':
            in_run = True
            continue
        if in_run:
            if line.startswith('          '):
                block.append(line[10:])
            elif line.strip():
                raise AssertionError(f'Unexpected indentation in step {name}: {line}')
    if not block:
        raise AssertionError(f'No shell script in step {name}')
    return '\n'.join(block) + '\n'


class ChromiumRevisionTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='qa-revision-')
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.env = dict(os.environ,
                        GITHUB_EVENT_NAME='workflow_dispatch',
                        DISPATCH_SCOPE='quick',
                        DISPATCH_TARGET_SHA='',
                        EVENT_SHA='a' * 40,
                        GITHUB_ENV=str(self.root / 'env'),
                        GITHUB_STEP_SUMMARY=str(self.root / 'summary'),
                        QA_SCOPE='quick',
                        QA_TARGET_SHA='a' * 40)

    def run_step(self, name, *, env=None, cwd=None):
        return subprocess.run(['bash', '-e', '-o', 'pipefail', '-c', step_script(name)],
                              cwd=str(cwd or self.root), env=env or self.env,
                              text=True, capture_output=True, check=False)

    def test_dispatch_uses_event_sha_by_default(self):
        result = self.run_step('Select requested tests and product commit')
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        self.assertEqual((self.root / 'env').read_text(),
                         'QA_SCOPE=quick\nQA_TARGET_SHA=' + 'a' * 40 + '\n')

    def test_dispatch_can_select_explicit_commit(self):
        env = dict(self.env, DISPATCH_SCOPE='drawing', DISPATCH_TARGET_SHA='b' * 40)
        result = self.run_step('Select requested tests and product commit', env=env)
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        self.assertIn('QA_SCOPE=drawing\nQA_TARGET_SHA=' + 'b' * 40 + '\n',
                      (self.root / 'env').read_text())

    def test_push_takes_product_not_request_event_sha(self):
        request = self.root / 'qa' / 'chromium-request.txt'
        request.parent.mkdir()
        request.write_text('available\n' + 'c' * 40 + '\n')
        env = dict(self.env, GITHUB_EVENT_NAME='push', EVENT_SHA='d' * 40)
        result = self.run_step('Select requested tests and product commit', env=env)
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        selected = (self.root / 'env').read_text()
        self.assertIn('QA_SCOPE=available\nQA_TARGET_SHA=' + 'c' * 40, selected)
        self.assertNotIn('d' * 40, selected)

    def test_malformed_request_and_scope_fail(self):
        request = self.root / 'qa' / 'chromium-request.txt'
        request.parent.mkdir()
        env = dict(self.env, GITHUB_EVENT_NAME='push')
        for content in ('quick\n', 'quick\n' + 'c' * 39 + '\n',
                        'quick\n' + 'c' * 40 + '\nextra\n',
                        'all\n' + 'c' * 40 + '\n',
                        'nonsense\n' + 'c' * 40 + '\n'):
            with self.subTest(content=content[:15]):
                request.write_text(content)
                (self.root / 'env').unlink(missing_ok=True)
                result = self.run_step('Select requested tests and product commit', env=env)
                self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
                self.assertFalse((self.root / 'env').exists(), 'Do not export invalid selection')

    def test_exact_checkout_passes_and_different_commit_fails(self):
        subprocess.run(['git', 'init', '-q', str(self.root)], check=True)
        (self.root / 'file.txt').write_text('fixture, no application data\n')
        subprocess.run(['git', '-C', str(self.root), 'add', 'file.txt'], check=True)
        subprocess.run(['git', '-C', str(self.root), '-c', 'user.name=Fixture',
                        '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'fixture'], check=True)
        actual = subprocess.check_output(['git', '-C', str(self.root), 'rev-parse', 'HEAD'], text=True).strip()
        positive = self.run_step('Verify checked-out revision', env=dict(self.env, QA_TARGET_SHA=actual))
        self.assertEqual(positive.returncode, 0, positive.stderr + positive.stdout)
        negative = self.run_step('Verify checked-out revision', env=dict(self.env, QA_TARGET_SHA='f' * 40))
        self.assertNotEqual(negative.returncode, 0)
        self.assertIn('FAIL: checkout is not the requested product commit', negative.stdout)


if __name__ == '__main__':
    unittest.main()
