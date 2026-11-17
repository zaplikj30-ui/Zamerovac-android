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
                        GITHUB_WORKSPACE=str(WORKFLOW.parents[2]),
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

    def test_older_product_keeps_current_runner_and_product_sha(self):
        # A real old git checkout with no new QA files; no fetched history or
        # network is needed even in a shallow GitHub Actions checkout.
        repo = WORKFLOW.parents[2]
        origin = self.root / 'origin'
        subprocess.run(['git', 'init', '-q', str(origin)], check=True)
        (origin / 'product.txt').write_text('older product, unchanged by runner')
        subprocess.run(['git', '-C', str(origin), 'add', '.'], check=True)
        subprocess.run(['git', '-C', str(origin), '-c', 'user.name=Fixture',
                        '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'old product'], check=True)
        old_sha = subprocess.check_output(['git', '-C', str(origin), 'rev-parse', 'HEAD'], text=True).strip()
        (origin / 'product.txt').write_text('newer product must not be tested')
        subprocess.run(['git', '-C', str(origin), '-c', 'user.name=Fixture',
                        '-c', 'user.email=fixture@example.invalid', 'commit', '-qam', 'new product'], check=True)
        product = self.root / 'product'
        subprocess.run(['git', 'clone', '-q', '--shared', '--no-checkout',
                        str(origin), str(product)], check=True)
        subprocess.run(['git', '-C', str(product), 'checkout', '-q', old_sha], check=True)
        self.assertFalse((product / 'tests/qa-simple-chromium.test.cjs').exists())
        result = self.run_step('Verify checked-out revision', cwd=product,
                               env=dict(self.env, QA_TARGET_SHA=old_sha))
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        # Run the current runner from the older product working directory.
        # Node mocks Chromium only; real git must identify the older product.
        result = subprocess.run(['node', '--test', str(repo / 'tests/qa-simple-chromium.test.cjs')],
                                cwd=product, text=True, capture_output=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(subprocess.check_output(['git', '-C', str(product),
                         'status', '--porcelain'], text=True), '')
        self.assertEqual((product / 'product.txt').read_text(), 'older product, unchanged by runner')
        workflow = WORKFLOW.read_text()
        checkouts = workflow.split('uses: actions/checkout@v4')[1:]
        self.assertEqual(len(checkouts), 2)
        self.assertIn('ref: ${{ github.sha }}', checkouts[0])
        self.assertNotIn('path:', checkouts[0])
        self.assertIn('path: product', checkouts[1])
        self.assertIn('ref: ${{ env.QA_TARGET_SHA }}', checkouts[1])
        for name in ('Verify checked-out revision', 'QUICK current source JS, Python and regressions',
                     'Chromium - current QUICK 7 and available E2E 21/87',
                     'Android native Java, Drive and PDF checks - no APK'):
            block = workflow.split('      - name: ' + name + '\n')[1].split('      - ')[0]
            self.assertIn('        working-directory: product\n', block)
        browser = step_script('Chromium - current QUICK 7 and available E2E 21/87')
        self.assertIn('"$GITHUB_WORKSPACE"/tools/check-*-browser.cjs', browser)
        self.assertIn('"$GITHUB_WORKSPACE/tools/e2e/$suite.cjs"', browser)
        self.assertIn('--directory app/src/main/assets', browser)


if __name__ == '__main__':
    unittest.main()
