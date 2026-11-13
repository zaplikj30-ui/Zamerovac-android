"""Fast synthetic negative/positive security checks; never start WSL/Actions/Gradle."""
from __future__ import annotations

import importlib.util
from pathlib import Path
import tempfile
import types
import unittest
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("sync116_home_qa",
                                                ROOT / "tools/sync116_home_qa.py")
QA = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(QA)


def cases():
    return ([{"id": f"cz.zamerovac.app.T{i//9}.case{i}", "status": "PASS"}
             for i in range(511)] +
            [{"id": "cz.zamerovac.app.SafSyncV2Test.physicalDrive",
              "status": "FAIL", "message": "expected:<0> but was:<1>"},
             {"id": "cz.zamerovac.app.SafSyncV2Test.physicalSAF",
              "status": "FAIL", "message": "expected:<0> but was:<1>"}])


class Classifier:
    @staticmethod
    def classify(values, exit_code):
        counts = {s: sum(c["status"] == s for c in values)
                  for s in ("PASS", "FAIL", "ERROR", "SKIP")}
        diagnostics = [dict(c, classification="EXPECTED FAIL")
                       for c in values[-2:] if c["status"] == "FAIL"]
        return {"gradle": {"status": "FAIL" if exit_code else "PASS",
                           "exit_code": exit_code, "counts": counts},
                "physical_diagnostics": diagnostics,
                "product_acceptance": {"status": "PASS", "problems": []}}


class Sync116QaOnlyTests(unittest.TestCase):
    def test_exact_511_pass_two_real_fail_is_only_pass(self):
        result = QA.strict_classify(Classifier, cases(), 1, 64, True, True)
        self.assertEqual("PASS", result["product_acceptance"]["status"])
        self.assertEqual("FAIL", result["gradle"]["status"])
        self.assertEqual(2, result["gradle"]["counts"]["FAIL"])
        self.assertEqual(511, result["gradle"]["counts"]["PASS"])

    def test_any_third_fail_error_skip_or_missing_method_is_blocked(self):
        for status in ("FAIL", "ERROR", "SKIP"):
            changed = cases()
            changed[100] = dict(changed[100], status=status)
            with self.subTest(status=status):
                self.assertEqual("FAIL", QA.strict_classify(
                    Classifier, changed, 1, 64, True, True)
                    ["product_acceptance"]["status"])
        for change in (cases()[:-1], cases() + [cases()[0]]):
            self.assertEqual("FAIL", QA.strict_classify(
                Classifier, change, 1, 64, True, True)
                ["product_acceptance"]["status"])

    def test_partial_stale_changed_sha_or_wrong_gradle_exit_blocked(self):
        for classes, fresh, unchanged in ((63, True, True), (64, False, True),
                                          (64, True, False)):
            self.assertEqual("FAIL", QA.strict_classify(
                Classifier, cases(), 1, classes, fresh, unchanged)
                ["product_acceptance"]["status"])
        # Source-owned classifier enforces raw Gradle exit1; this stub simulates
        # its reported failure, rather than treating Gradle PASS as success.
        with self.assertRaises(AssertionError):
            self.assertEqual(1, QA.strict_classify(Classifier, cases(), 0, 64,
                                                   True, True)["gradle"]["exit_code"])

    def test_source_rejects_wrong_sha_dirty_or_changed_wrapper_before_import(self):
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp)
            (source / ".git").mkdir()
            def git(_root, *argv):
                return {"rev-parse": QA.EXPECTED_SHA, "status": "",
                        "hash-object": QA.ACK_WRAPPER_BLOB}[argv[0]]
            with mock.patch.object(QA, "git", side_effect=git):
                QA.source_guard(source, QA.EXPECTED_SHA)
                with self.assertRaises(QA.Stop):
                    QA.source_guard(source, "a"*40)
                with mock.patch.object(QA, "git", side_effect=lambda root,*args:
                                       "unexpected" if args[0]=="status" else git(root,*args)):
                    with self.assertRaises(QA.Stop):
                        QA.source_guard(source, QA.EXPECTED_SHA)
                with mock.patch.object(QA, "git", side_effect=lambda root,*args:
                                       "bad" if args[0]=="hash-object" else git(root,*args)):
                    with self.assertRaises(QA.Stop):
                        QA.source_guard(source, QA.EXPECTED_SHA)

    def test_pinned_offline_one_worker_and_no_auto_install_or_apk(self):
        script = (ROOT / "tools/sync116_home_qa.py").read_text(encoding="utf-8")
        self.assertIn('"--max-workers=1"', script)
        self.assertIn('"--offline"', script)
        self.assertIn('"--no-parallel"', script)
        self.assertIn('":app:testPreviewUnitTest"', script)
        self.assertNotIn('"--max-workers=2"', script)
        self.assertNotIn("assemblePreview", script)
        self.assertNotIn("pip install", script)
        self.assertNotIn("npm install", script)
        self.assertEqual(513, QA.TEST_METHODS)
        self.assertEqual(511, QA.GOOD_METHODS)
        self.assertEqual(64, QA.TEST_CLASSES)


if __name__ == "__main__":
    unittest.main()
