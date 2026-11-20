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

    def test_inventory_protects_513_baseline_and_exact_approved_additions(self):
        import hashlib
        import json
        from unittest.mock import patch

        baseline = self.baseline() + [
            {"id": f"cz.zamerovac.app.SyntheticTest.method{i:03d}",
             "status": "PASS", "message": ""}
            for i in range(gate.EXPECTED_CASE_COUNT - len(self.baseline()))
        ]
        additions = [
            {"id": name, "status": "PASS", "message": ""}
            for name in sorted(gate.ADDITIONAL_CASE_IDS)
        ]
        cases = baseline + additions
        digest = hashlib.sha256(
            json.dumps(sorted(case["id"] for case in baseline),
                       separators=(",", ":"), ensure_ascii=True).encode("ascii")
        ).hexdigest()

        with patch.object(gate, "EXPECTED_CASE_IDS_SHA256", digest):
            self.assertEqual([], gate.inventory_problems(cases))
            self.assertEqual("FAIL", gate.classify(cases, 1)["gradle"]["status"])
            self.assertEqual("PASS", gate.classify(cases, 1)["product_acceptance"]["status"])

            # Unknown additional PASS must NOT quietly change the inventory.
            unknown = dict(id="cz.zamerovac.app.SyntheticTest.unreviewedNewTest",
                           status="PASS", message="")
            self.assertTrue(gate.inventory_problems(cases + [unknown]))

            # Replacing one of the historical methods is still a failure even
            # when the total number of test cases stays the same.
            replaced = [dict(case) for case in cases]
            replaced[len(baseline) - 1]["id"] = unknown["id"]
            self.assertTrue(gate.inventory_problems(replaced))

            # Newly approved methods are required, not ignored test-count slack.
            self.assertTrue(gate.inventory_problems(cases[:-1]))
            swapped = [dict(case) for case in cases]
            swapped[-1]["id"] = unknown["id"]
            self.assertTrue(gate.inventory_problems(swapped))

            # Duplicate methods cannot masquerade as new coverage.
            self.assertTrue(gate.inventory_problems(cases + [dict(cases[-1])]))
            # Failure or SKIP in an added test is never excused by its allowlist.
            for status in ("FAIL", "SKIP", "ERROR"):
                with self.subTest(status=status):
                    faulty = [dict(case) for case in cases]
                    faulty[-1]["status"] = status
                    self.assertEqual(
                        "FAIL", gate.classify(faulty, 1)["product_acceptance"]["status"]
                    )

    def test_original_diagnostics_helpers_and_e2e_are_byte_preserved(self):
        self.assertEqual(gate.TEST_DIGESTS, gate.preserved_tests())


if __name__ == "__main__":
    unittest.main()
