import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("sync_ack_gate", Path(__file__).resolve().parents[1] / "tools/sync-ack-acceptance.py")
gate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)


class SyncAckAcceptanceTest(unittest.TestCase):
    def baseline(self):
        return ([{"id": name, "status": "FAIL", "message": message} for name, message in gate.EXPECTED.items()] +
                [{"id": name, "status": "PASS", "message": ""} for name in gate.REQUIRED] +
                [{"id": "cz.zamerovac.app.SyncReceiptSafetyTest.durable", "status": "PASS", "message": ""}])

    def test_expected_failures_remain_fail_and_only_product_gate_is_pass(self):
        result = gate.classify(self.baseline(), 1)
        self.assertEqual("FAIL", result["gradle"]["status"])
        self.assertEqual(2, result["gradle"]["counts"]["FAIL"])
        self.assertEqual("PASS", result["product_acceptance"]["status"])
        self.assertTrue(all(case["status"] == "FAIL" for case in result["physical_diagnostics"]))

    def test_other_fail_skip_error_or_missing_e2e_always_blocks(self):
        for status in ("FAIL", "SKIP", "ERROR"):
            cases = self.baseline()
            cases[2]["status"] = status
            self.assertEqual("FAIL", gate.classify(cases, 1)["product_acceptance"]["status"])
        self.assertEqual("FAIL", gate.classify(self.baseline()[:2], 1)["product_acceptance"]["status"])

    def test_known_name_cannot_hide_different_failure_or_pass(self):
        for status, message in (("FAIL", "fixture failed before provider"), ("ERROR", "crash"), ("SKIP", ""), ("PASS", "")):
            cases = self.baseline()
            cases[0].update(status=status, message=message)
            self.assertEqual("FAIL", gate.classify(cases, 1)["product_acceptance"]["status"])

    def test_missing_duplicate_or_wrong_gradle_result_blocks(self):
        for cases, code in (([], 1), (self.baseline() + self.baseline(), 1), (self.baseline(), 0), (self.baseline(), 2)):
            self.assertEqual("FAIL", gate.classify(cases, code)["product_acceptance"]["status"])

    def test_original_diagnostics_helpers_and_e2e_are_byte_preserved(self):
        self.assertEqual(gate.TEST_DIGESTS, gate.preserved_tests())


if __name__ == "__main__":
    unittest.main()
