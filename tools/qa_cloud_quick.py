"""Cloud exact named Python QUICK: 216 original registry + approved X1 tests.

Captures test stdout/stderr privately; public logs contain counts only.
No HOME4 runner use or external downloads.
"""
import contextlib
import io
import json
import os
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parent.parent
REGISTRY = ROOT/'tools/qa/home4-quick.json'
EXTRAS = {
    'test_cloud_pdf_validation.CloudPDFOptimizeTests.test_positive_mock_interface_for_one_synthetic_raster',
    'test_cloud_pdf_validation.CloudPDFOptimizeTests.test_invalid_zip_is_blocked_under_python_O',
    'test_cloud_pdf_validation.CloudPDFOptimizeTests.test_no_args_or_symlink_cannot_claim_PASS_under_python_O',
    'test_cloud_pdf_validation.CloudPDFOptimizeTests.test_bound_current_run_sha_and_modified_same_mtime_block',
    'test_cloud_pdf_validation.CloudPDFOptimizeTests.test_missing_or_forged_run_proof_blocks_before_PDF',
}


def demand(value):
    if not value:
        raise RuntimeError('QA CLOUD QUICK registry or result invalid')


def collect():
    loader = unittest.defaultTestLoader
    suite = loader.discover(str(ROOT/'tests'), pattern='test_*.py')
    def flatten(node):
        for child in node:
            if isinstance(child, unittest.TestSuite):
                yield from flatten(child)
            else:
                yield child
    return list(flatten(suite))


class Outcome(unittest.TestResult):
    def __init__(self):
        super().__init__()
        self.cases = []

    def addSuccess(self, case):
        super().addSuccess(case)
        self.cases.append((case.id(), 'PASS'))

    def addFailure(self, case, info):
        super().addFailure(case, info)
        self.cases.append((case.id(), 'FAIL'))

    def addError(self, case, info):
        super().addError(case, info)
        self.cases.append((case.id(), 'ERROR'))

    def addSkip(self, case, reason):
        super().addSkip(case, reason)
        self.cases.append((case.id(), 'SKIP'))

    def addExpectedFailure(self, case, info):
        super().addExpectedFailure(case, info)
        self.cases.append((case.id(), 'FAIL'))

    def addUnexpectedSuccess(self, case):
        super().addUnexpectedSuccess(case)
        self.cases.append((case.id(), 'FAIL'))


def main():
    demand(os.environ.get('ZAMEROVAC_CLOUD_QUICK') == '1' and sys.platform == 'linux')
    manifest = json.loads(REGISTRY.read_text(encoding='utf8'))
    demand(len(manifest['python']['cases']) == 216 and len(EXTRAS) == 5)
    expected = set(manifest['python']['cases']) | EXTRAS
    demand(len(expected) == 221)
    # Test collection is redirected as it may print exception paths/data.
    with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
        tests = collect()
    ids = [case.id() for case in tests]
    demand(len(ids) == len(expected) and set(ids) == expected)
    out = Outcome()
    # Bounded stream, same privacy behavior as existing HOME4 Python utility.
    class Sink:
        size = 0
        def write(self, data):
            self.size += len(data.encode('utf8'))
            if self.size > 16 * 1024 * 1024:
                raise RuntimeError('private QUICK log bound exceeded')
            return len(data)
        def flush(self):
            return None
    sink = Sink()
    with contextlib.redirect_stdout(sink), contextlib.redirect_stderr(sink):
        unittest.TestSuite(tests).run(out)
    demand(len(out.cases) == len(expected) and len({case[0] for case in out.cases}) == len(expected))
    demand(all(status == 'PASS' for _, status in out.cases) and out.wasSuccessful())
    print('PASS Python exact QUICK: 216 reviewed + 5 cloud PDF/X1 synthetic cases, no FAIL/SKIP/ERROR')
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except BaseException:
        print('BLOCKED cloud QUICK Python names/status/exit (redacted)', file=sys.stderr)
        sys.exit(78)
