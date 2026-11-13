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
            "records":[{"suite":"suite"+str(i),"status":"PASS",
                        "scenarioTotal":4,"scenarioPassed":4} for i in range(23)]}

def jvm():
    cases=[{"id":"p"+str(i),"status":"PASS"} for i in range(511)]
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
