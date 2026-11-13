"""Offline, in-memory/fake-GitHub context tests of run-specific evidence. No HOME start."""
from __future__ import annotations
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[1]
SPEC=importlib.util.spec_from_file_location("qa117_evidence",ROOT/"tools/sync116_evidence.py")
QA=importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(QA)
SHA=QA.SOURCE_SHA
GATE="b"*40

def env(run="43195207268"):
    return dict(GITHUB_ACTIONS="true", GITHUB_REPOSITORY=QA.REPO,
        GITHUB_ACTOR=QA.OWNER, GITHUB_TRIGGERING_ACTOR=QA.OWNER,
        GITHUB_EVENT_NAME="push", GITHUB_REF="refs/heads/qa/accepted",
        GITHUB_RUN_ID=run, GITHUB_RUN_ATTEMPT="1")

def browser():
    return {"schema":4, "kind":"browser","status":"PASS",
            "sourceSha":SHA,"validatorSha":GATE,"runId":"43195207268",
            "runAttempt":1,
            "counts":{"PASS":23,"FAIL":0,"SKIP":0,"NOT RUN":0},
            "coverage":{"status":"PASS","expectedCases":92,"actualCases":92},
            "integrity":{"status":"PASS","sha":SHA,"trackedFiles":23,"digest":"a"*64},
            "records":[{"suite":suite,"status":"PASS",
                        "scenarioTotal":len(names),"scenarioPassed":len(names),
                        "scenarioNames":names.copy()}
                       for suite,names in QA.APPROVED_CASES.items()]}

def jvm():
    required=[{"id":method,"status":"PASS"}
              for methods in QA.JVM_REQUIRED.values() for method in sorted(methods)]
    # Other 462 methods are synthetic placeholders only for negative unit tests.
    cases=required+[{"id":"cz.zamerovac.app.FixtureOtherTest.case"+str(i),
                     "status":"PASS"} for i in range(511-len(required))]
    ids=[
        "cz.zamerovac.app.SafSyncV2Test.driveStagedAckMustNotPublishAfterLocalAuthorityLostInsideProviderCommit",
        "cz.zamerovac.app.SafSyncV2Test.safDirectAckMustNotPublishAfterLocalAuthorityLostInsideProviderWrite"]
    return {"schema":4,"kind":"jvm","status":"PASS","sourceSha":SHA,
            "validatorSha":GATE,"runId":"43195207268","runAttempt":1,
            "counts":{"PASS":511,"FAIL":2,"ERROR":0,"SKIP":0},
            "gradle":{"status":"FAIL","exit_code":1},
            "product_acceptance":{"status":"PASS","problems":[],"cases":cases},
            "physical_diagnostics":[{"id":name,"classification":"EXPECTED FAIL",
                                     "status":"FAIL", "message":QA.ORIGINAL_FAIL_MESSAGES[name]} for name in ids],
            "junit_class_files":64,"junit_methods":513,"fresh_junit":True,
            "original_test_sha256":QA.ORIGINAL_TEST_SHA256.copy()}

class CurrentRunEvidenceTests(unittest.TestCase):
    def test_first_attempt_owner_passes_and_missing_reruns_stop(self):
        QA.context(env())
        for key, value in (("GITHUB_RUN_ATTEMPT","2"),
                           ("GITHUB_RUN_ATTEMPT",""),
                           ("GITHUB_RUN_ID",""),
                           ("GITHUB_RUN_ID","0"),
                           ("GITHUB_TRIGGERING_ACTOR","other"),
                           ("GITHUB_TRIGGERING_ACTOR",""),
                           ("GITHUB_ACTOR","other"),
                           ("GITHUB_REPOSITORY","fork/Zamerovac-android"),
                           ("GITHUB_EVENT_NAME","pull_request")):
            with self.subTest(key=key,value=value),self.assertRaises(QA.EvidenceStop):
                QA.context({**env(),key:value})

    def test_browser_current_run_proof_and_missing_output(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d)
            item=QA.initialize(root,"browser",env(),SHA,GATE)
            self.assertTrue(item.exists())
            with self.assertRaises(QA.EvidenceStop):
                QA.verify(root,"browser",env(),SHA,GATE)
            self.assertEqual(item,QA.inspect(root,"browser",env(),SHA,GATE),
                             "fresh NOT RUN report is safe to upload after a failed test")
            item.write_text(json.dumps(browser()),encoding="utf-8")
            self.assertEqual(item,QA.verify(root,"browser",env(),SHA,GATE))
            with self.assertRaises(QA.EvidenceStop):
                QA.initialize(root,"browser",env(),SHA,GATE)
            with self.assertRaises(QA.EvidenceStop):
                QA.verify(root,"browser",env("43195207269"),SHA,GATE)
            item.unlink()
            with self.assertRaises(QA.EvidenceStop):
                QA.verify(root,"browser",env(),SHA,GATE)
            with self.assertRaises(QA.EvidenceStop):
                QA.inspect(root,"browser",env(),SHA,GATE)

    def test_browser_bad_counts_dirty_or_wrong_validation_identity_blocked(self):
        baseline=browser()
        for field,value in (
            ("status","NOT RUN"),("status","FAIL"),
            ("sourceSha","c"*40),("validatorSha","d"*40),
            ("runAttempt",2),("runId","9"),
            ("coverage",{"status":"PASS","expectedCases":92,"actualCases":91}),
            ("counts",{"PASS":22,"FAIL":1,"SKIP":0,"NOT RUN":0}),
            ("integrity",{"status":"FAIL","sha":SHA,"trackedFiles":23,"digest":"a"*64}),
            ("records",baseline["records"][:-1]),
            ("records",baseline["records"][:-1]+[baseline["records"][0]]),
        ):
            with self.subTest(field=field,value=str(value)[:50]),self.assertRaises(QA.EvidenceStop):
                QA.validate_report({**baseline,field:value},"browser",env(),SHA,GATE)
        altered=browser()
        altered["records"][0]["scenarioPassed"]=3
        with self.assertRaises(QA.EvidenceStop):
            QA.validate_report(altered,"browser",env(),SHA,GATE)

    def test_sec05_rejects_fake_suite0_to_suite22_and_renamed_case_at_92(self):
        good=browser()
        self.assertEqual(list(QA.APPROVED_CASES),
                         [row["suite"] for row in good["records"]])
        self.assertEqual(92,sum(len(row["scenarioNames"]) for row in good["records"]))
        self.assertTrue(QA.validate_report(good,"browser",env(),SHA,GATE))
        fake=browser()
        for i,row in enumerate(fake["records"]):
            row["suite"]="suite"+str(i)
        with self.assertRaises(QA.EvidenceStop):
            QA.validate_report(fake,"browser",env(),SHA,GATE)
        for mode in ("missing", "renamed", "reordered"):
            altered=browser()
            titles=next(row["scenarioNames"] for row in altered["records"]
                        if row["suite"]=="pending-audio")
            if mode=="missing":
                titles[0]="fabricated-replacement-with-same-92-count"
            elif mode=="renamed":
                titles[0]="clockless-test-fabricated"
            else:
                titles.reverse()
                self.assertNotEqual(titles,QA.APPROVED_CASES["pending-audio"])
            with self.subTest(mode=mode), self.assertRaises(QA.EvidenceStop):
                QA.validate_report(altered,"browser",env(),SHA,GATE)
        no_audio=browser()
        for row in no_audio["records"]:
            if row["suite"]=="pending-audio":
                row["suite"]="made-up-audio"
        with self.assertRaises(QA.EvidenceStop):
            QA.validate_report(no_audio,"browser",env(),SHA,GATE)

    def test_sec05_all_49_named_jvm_ids_and_any_missing_required_are_blocked(self):
        good=jvm()
        self.assertTrue(QA.validate_report(good,"jvm",env(),SHA,GATE))
        self.assertEqual({key:len(value) for key,value in QA.JVM_REQUIRED.items()},
                         {"SyncAckReconciliationTest":2,
                          "SyncReceiptSafetyTest":24,
                          "DatabaseInstallEvidenceTest":23})
        fabricated=jvm()
        fabricated["product_acceptance"]["cases"]=[
            {"id":"p"+str(i),"status":"PASS"} for i in range(511)]
        with self.assertRaises(QA.EvidenceStop):
            QA.validate_report(fabricated,"jvm",env(),SHA,GATE)
        for clazz, required in QA.JVM_REQUIRED.items():
            altered=jvm()
            victim=sorted(required)[0]
            for row in altered["product_acceptance"]["cases"]:
                if row["id"]==victim:
                    row["id"]="cz.zamerovac.app.OtherFixtureTest.missing_"+clazz
                    break
            else:
                raise AssertionError("approved JVM case was not in fixture: "+victim)
            with self.subTest(class_name=clazz), self.assertRaises(QA.EvidenceStop):
                QA.validate_report(altered,"jvm",env(),SHA,GATE)

    def test_jvm_511_two_real_fail_and_negative_fail_skip_stale(self):
        good=jvm()
        self.assertTrue(QA.validate_report(good,"jvm",env(),SHA,GATE))
        for change in (
            {"status":"NOT RUN"},
            {"gradle":{"status":"PASS","exit_code":0}},
            {"counts":{"PASS":510,"FAIL":3,"ERROR":0,"SKIP":0}},
            {"counts":{"PASS":510,"FAIL":2,"ERROR":0,"SKIP":1}},
            {"fresh_junit":False},
            {"junit_class_files":63},
            {"junit_methods":512},
            {"product_acceptance":{"status":"PASS","problems":[],"cases":good["product_acceptance"]["cases"][:-1]}},
            {"physical_diagnostics":[]},
            {"original_test_sha256":{"provider-and-helpers":"0"*64}},
            {"runId":"999"},
        ):
            with self.subTest(change=change),self.assertRaises(QA.EvidenceStop):
                QA.validate_report({**good,**change},"jvm",env(),SHA,GATE)

if __name__=="__main__":
    unittest.main()
