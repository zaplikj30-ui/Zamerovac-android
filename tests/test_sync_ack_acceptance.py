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

    def test_online_option_only_changes_gradle_dependency_resolution(self):
        import sys
        import tempfile
        from unittest.mock import patch

        def fake_git(*args):
            return "a" * 40 if args[0] == "rev-parse" else ""

        for online in (False, True):
            with self.subTest(online=online), tempfile.TemporaryDirectory() as output:
                argv = ["sync-ack-acceptance.py", "--output", output]
                if online:
                    argv.append("--online-dependencies")
                with (patch.object(sys, "argv", argv),
                      patch.object(gate, "git", side_effect=fake_git),
                      patch.object(gate, "preserved_tests", return_value=gate.TEST_DIGESTS),
                      patch.object(gate.subprocess, "run", side_effect=RuntimeError("captured")) as runner):
                    with self.assertRaisesRegex(RuntimeError, "captured"):
                        gate.run()
                    command = runner.call_args.args[0]
                self.assertEqual("--offline" in command, not online)
                self.assertIn(":app:testPreviewUnitTest", command)
                self.assertIn("--rerun", command)
                self.assertIn("--no-daemon", command)

    def test_historical_methods_cannot_disappear_but_new_pass_tests_autocount(self):
        # Use the exact 513 independently preserved historical IDs, not mocks.
        cases = [dict(id=name, status="FAIL" if name in gate.EXPECTED else "PASS",
                      message=gate.EXPECTED.get(name, ""))
                 for name in sorted(gate.baseline_case_ids())]
        cases += [dict(id=name, status="PASS", message="")
                  for name in sorted(gate.REQUIRED_LATER_CASE_IDS)]
        self.assertEqual(gate.EXPECTED_CASE_COUNT + 2, len(cases))
        self.assertEqual([], gate.inventory_problems(cases))
        self.assertEqual("PASS", gate.classify(cases, 1)["product_acceptance"]["status"])

        # Future additions are automatic, with no 515 -> 516 constant update.
        extra = dict(id="cz.zamerovac.app.AddedSafetyTest.newMethod", status="PASS", message="")
        self.assertEqual([], gate.inventory_problems(cases + [extra]))
        self.assertEqual("PASS", gate.classify(cases + [extra], 1)["product_acceptance"]["status"])

        # Still require the old test identities even if count stays equal.
        replaced = [dict(c) for c in cases]
        replaced[0]["id"] = extra["id"]
        self.assertTrue(gate.inventory_problems(replaced))
        self.assertTrue(gate.inventory_problems(cases[1:]))
        # The two recent valuable cache/data tests must remain present too.
        self.assertTrue(gate.inventory_problems(cases[:-1]))
        self.assertTrue(gate.inventory_problems(cases + [dict(cases[-1])]))
        # A newly added failing/ignored test is NEVER an acceptable extra.
        for status in ("FAIL", "ERROR", "SKIP"):
            with self.subTest(status=status):
                wrong = dict(extra, status=status)
                self.assertEqual("FAIL", gate.classify(cases + [wrong], 1)["product_acceptance"]["status"])

    def test_historical_manifest_tampering_is_rejected(self):
        import tempfile
        from unittest.mock import patch
        with tempfile.TemporaryDirectory() as tmp:
            file = Path(tmp) / "jvm-baseline.txt"
            valid = gate.BASELINE_CASES_FILE.read_text(encoding="ascii")
            file.write_text(valid, encoding="ascii")
            with patch.object(gate, "BASELINE_CASES_FILE", file):
                self.assertEqual(gate.EXPECTED_CASE_COUNT, len(gate.baseline_case_ids()))
                file.write_text(valid.replace("cz.zamerovac.app.", "cz.corrupted.app.", 1), encoding="ascii")
                with self.assertRaisesRegex(ValueError, "fingerprint changed"):
                    gate.baseline_case_ids()

    def test_original_diagnostics_helpers_and_e2e_are_byte_preserved(self):
        self.assertEqual(gate.TEST_DIGESTS, gate.preserved_tests())


if __name__ == "__main__":
    unittest.main()
