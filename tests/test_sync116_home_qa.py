"""Fast synthetic negative/positive security checks; never start WSL/Actions/Gradle."""
from __future__ import annotations

import importlib.util
import json
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


MANIFEST=json.loads((ROOT/"tools/sync116_case_manifest.json").read_text(encoding="utf-8"))
def cases():
    required=[{"id":"cz.zamerovac.app."+clazz+"."+method, "status":"PASS"}
              for clazz,methods in MANIFEST["jvmRequired"].items() for method in methods]
    fillers=[{"id": f"cz.zamerovac.app.SyntheticOtherFixture.case{i}", "status":"PASS"}
             for i in range(511-len(required))]
    return required+fillers+[
            {"id": "cz.zamerovac.app.SafSyncV2Test.physicalDrive",
              "status": "FAIL", "message": "expected:<0> but was:<1>"},
            {"id": "cz.zamerovac.app.SafSyncV2Test.physicalSAF",
              "status": "FAIL", "message": "expected:<0> but was:<1>"}]


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

    def test_sec05_missing_any_required_group_fails_without_count_change(self):
        baseline=cases()
        self.assertEqual(513,len(baseline))
        self.assertEqual("PASS",QA.strict_classify(
            Classifier,baseline,1,64,True,True)["product_acceptance"]["status"])
        for clazz,methods in MANIFEST["jvmRequired"].items():
            victim="cz.zamerovac.app."+clazz+"."+methods[0]
            changed=[dict(item) for item in baseline]
            for entry in changed:
                if entry["id"]==victim:
                    entry["id"]="cz.zamerovac.app.SyntheticOtherFixture.missing_"+clazz
                    break
            else:
                raise AssertionError("Approved JUnit test not present: "+victim)
            with self.subTest(clazz=clazz):
                self.assertEqual("FAIL",QA.strict_classify(
                    Classifier,changed,1,64,True,True)["product_acceptance"]["status"])
        fake=[{"id":"p"+str(i),"status":"PASS"} for i in range(511)]+baseline[-2:]
        self.assertEqual("FAIL",QA.strict_classify(
            Classifier,fake,1,64,True,True)["product_acceptance"]["status"])

    def test_partial_stale_changed_sha_or_wrong_gradle_exit_blocked(self):
        for classes, fresh, unchanged in ((63, True, True), (64, False, True),
                                          (64, True, False)):
            self.assertEqual("FAIL", QA.strict_classify(
                Classifier, cases(), 1, classes, fresh, unchanged)
                ["product_acceptance"]["status"])
        self.assertEqual("FAIL", QA.strict_classify(
            Classifier, cases(), 0, 64, True, True)
            ["product_acceptance"]["status"],
            "Even a faulty source classifier must not accept raw Gradle exit0")

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

    def test_temporary_root_waiver_only_for_one_owner_jvm_run(self):
        env = {
            "GITHUB_REPOSITORY": "zaplikj30-ui/Zamerovac-android",
            "GITHUB_REF": QA.TEMP_QA_REF,
            "GITHUB_ACTOR": "zaplikj30-ui",
            "GITHUB_TRIGGERING_ACTOR": "zaplikj30-ui",
            "GITHUB_RUN_ATTEMPT": "1",
            "GITHUB_RUN_ID": "43407410666",
        }
        self.assertTrue(QA.owner_root_waiver(env, QA.EXPECTED_SHA,
                                              "43407410666", "1"))
        changes = [
            ("GITHUB_REF", "refs/heads/qa/other"),
            ("GITHUB_REPOSITORY", "other/repo"),
            ("GITHUB_ACTOR", "attacker"),
            ("GITHUB_TRIGGERING_ACTOR", "attacker"),
            ("GITHUB_RUN_ATTEMPT", "2"),
            ("GITHUB_RUN_ID", "different"),
        ]
        for key, value in changes:
            with self.subTest(key=key):
                self.assertFalse(QA.owner_root_waiver({**env, key: value},
                                                       QA.EXPECTED_SHA, "43407410666", "1"))
        self.assertFalse(QA.owner_root_waiver(env, "0" * 40,
                                              "43407410666", "1"))
        self.assertFalse(QA.owner_root_waiver(env, QA.EXPECTED_SHA,
                                              "43407410666", "2"))

    def test_nonroot_wsl_is_mandatory_before_source_execution(self):
        with mock.patch.object(QA.platform, "system", return_value="Linux"), \
             mock.patch.object(QA.platform, "release", return_value="microsoft-WSL2"), \
             mock.patch.object(QA.os, "geteuid", return_value=0, create=True), \
             mock.patch.dict(QA.os.environ, {"WSL_DISTRO_NAME": "Zamerovac-Ubuntu-QA"}):
            with self.assertRaisesRegex(QA.Stop, "root WSL"):
                QA.run_linux(Path("/fake-src"), QA.EXPECTED_SHA, Path("/fake-out"),
                             "b"*40, "43195207268", "1")

    def test_run_scoped_pending_only_current_jvm_evidence(self):
        import json
        with tempfile.TemporaryDirectory() as tmp:
            out=Path(tmp)/"43195207268-1"/"jvm"
            out.mkdir(parents=True)
            init={"schema":4, "kind":"jvm", "status":"NOT RUN",
                  "sourceSha":QA.EXPECTED_SHA, "validatorSha":"b"*40,
                  "runId":"43195207268", "runAttempt":1}
            (out/"results.json").write_text(json.dumps(init),encoding="utf-8")
            QA.pending_evidence(out, QA.EXPECTED_SHA, "b"*40, "43195207268", "1")
            for name,sha,run,attempt in (
                ("wrong sha","0"*40,"43195207268","1"),
                ("wrong run",QA.EXPECTED_SHA,"43195207269","1"),
                ("re-run",QA.EXPECTED_SHA,"43195207268","2")):
                with self.subTest(name=name), self.assertRaises(QA.Stop):
                    QA.pending_evidence(out,sha,"b"*40,run,attempt)
            (out/"results.json").write_text(json.dumps({**init,"status":"PASS"}),encoding="utf-8")
            with self.assertRaisesRegex(QA.Stop,"stale"):
                QA.pending_evidence(out,QA.EXPECTED_SHA,"b"*40,"43195207268","1")

    def test_wsl_execution_path_requires_existing_user_and_timeout_cleanup(self):
        script=(ROOT/"tools/sync116_home_qa.py").read_text(encoding="utf-8")
        self.assertIn('if [ "$(id -u)" -eq 0 ]',script)
        self.assertNotIn('"--user", "root"',script)
        self.assertNotIn("/root/zamerovac-qa-commits",script)
        self.assertIn("setsid timeout -s TERM -k 15s 2650s",script)
        self.assertIn("kill -TERM --",script)
        self.assertIn("kill -KILL --",script)
        self.assertIn("QA117_ALIVE",script)
        self.assertIn("proc.stdin.close()",script)
        self.assertIn("proc.kill()",script)
        self.assertIn("missing existing nonroot offline Gradle cache",script)
        self.assertIn("require preexisting read-only cache",script)
        self.assertIn("test ! -w",script)

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
