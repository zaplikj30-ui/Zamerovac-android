#!/usr/bin/env python3
"""Trusted, run-scoped HOME QA evidence gate. No network, installation or runner start."""
from __future__ import annotations
import argparse
import json
import os
from pathlib import Path
import re
import sys
from datetime import datetime, timezone

OWNER = "zaplikj30-ui"
REPO = OWNER + "/Zamerovac-android"
SOURCE_SHA = "1527e3377609633c554195b0641e02e3cfb5fb5e"
HEX40 = re.compile(r"[a-f0-9]{40}\Z")
RUN_ID = re.compile(r"[1-9][0-9]{0,19}\Z")
KINDS = ("browser", "jvm")
ORIGINAL_TEST_SHA256 = {
    "provider-and-helpers": "69297e7750a3e5e774211ff2406c9dadcbe9694ff525edbaeb1f872e9725b088",
    "original-two-diagnostics": "3770b50aa1b10076015640dcc25832e30a9ba9b8b27fc083ffa3be801e02ba67",
    "unchanged-product-e2e": "e74689baf33d2ea75b8b420b1ef9898a91937eda8101a76ce3125241dfdf0c70",
}
ORIGINAL_FAIL_MESSAGES = {
    "cz.zamerovac.app.SafSyncV2Test.driveStagedAckMustNotPublishAfterLocalAuthorityLostInsideProviderCommit":
      "Provider completed signed ACK after recovery epoch loss: Drive staged expected:<0> but was:<1>",
    "cz.zamerovac.app.SafSyncV2Test.safDirectAckMustNotPublishAfterLocalAuthorityLostInsideProviderWrite":
      "Provider completed signed ACK after recovery epoch loss: SAF direct expected:<0> but was:<1>",
}

class EvidenceStop(RuntimeError):
    pass

def require(value, message):
    if not value:
        raise EvidenceStop("HOME QA STOP: " + message)

def context(env):
    """GitHub-provided immutable run identity; missing values never imply a local PASS."""
    require(env.get("GITHUB_ACTIONS") == "true", "not a GitHub HOME run")
    require(env.get("GITHUB_REPOSITORY") == REPO, "wrong repo/fork")
    require(env.get("GITHUB_ACTOR") == OWNER, "wrong original actor")
    require(env.get("GITHUB_TRIGGERING_ACTOR") == OWNER, "unauthorized re-run actor")
    require(env.get("GITHUB_EVENT_NAME") == "push", "not an owner push")
    require(re.fullmatch(r"refs/heads/qa/[a-z][a-z0-9._-]{3,65}",
                         env.get("GITHUB_REF", "")) is not None, "not a literal qa branch")
    require(env.get("GITHUB_RUN_ATTEMPT") == "1", "retry attempt is forbidden")
    run_id = env.get("GITHUB_RUN_ID", "")
    require(RUN_ID.fullmatch(run_id) is not None, "missing/invalid GitHub run id")
    return run_id, 1

def scoped_dir(root: Path, kind: str, env) -> Path:
    require(kind in KINDS, "unknown QA kind")
    run_id, attempt = context(env)
    require(not root.is_symlink(), "results root must not be symlinked")
    run_dir = root / (run_id + "-" + str(attempt))
    require(not run_dir.is_symlink(), "run directory must not be a symlink")
    return run_dir / kind

def identity(kind, env, source_sha, validator_sha):
    run_id, attempt = context(env)
    require(source_sha == SOURCE_SHA, "wrong product SHA")
    require(HEX40.fullmatch(validator_sha or "") is not None, "validator SHA missing")
    require(kind in KINDS, "unknown QA kind")
    return dict(kind=kind, sourceSha=source_sha, validatorSha=validator_sha,
                runId=run_id, runAttempt=attempt)

def pending(kind, env, source_sha, validator_sha):
    return {"schema":4, **identity(kind,env,source_sha,validator_sha),
            "status":"NOT RUN", "counts":{"PASS":0,"FAIL":0,"SKIP":0,"NOT RUN":0},
            "createdAt":datetime.now(timezone.utc).isoformat()}

def initialize(root, kind, env, source_sha, validator_sha):
    dest = scoped_dir(root, kind, env)
    require(not dest.exists() and not dest.is_symlink() and
            not dest.parent.exists() and not dest.parent.is_symlink(),
            "run-scoped evidence already exists; refuse stale/overwritten PASS")
    dest.mkdir(parents=True, exist_ok=False)
    target = dest / "results.json"
    with target.open("x", encoding="utf-8") as file:
        json.dump(pending(kind,env,source_sha,validator_sha), file, ensure_ascii=False)
        file.write("\n")
    return target

def validate_report(report, kind, env, source_sha, validator_sha):
    expected = identity(kind, env, source_sha, validator_sha)
    require(report.get("schema") == 4, "unknown evidence schema")
    for key, value in expected.items():
        require(report.get(key) == value, "mismatch or missing evidence " + key)
    require(report.get("status") == "PASS", "unverified/failed/unfinished QA result")
    counts = report.get("counts")
    require(isinstance(counts,dict), "counts missing")
    if kind == "browser":
        require(counts == {"PASS":23,"FAIL":0,"SKIP":0,"NOT RUN":0},
                "browser must have exactly 23 PASS suites")
        coverage = report.get("coverage",{})
        require(coverage.get("status") == "PASS" and
                coverage.get("expectedCases") == 92 and
                coverage.get("actualCases") == 92,
                "browser must prove exactly 92 PASS cases")
        rows = report.get("records", [])
        require(len(rows) == 23 and len({x.get("suite") for x in rows}) == 23 and
                all(x.get("status") == "PASS" and
                    isinstance(x.get("scenarioTotal"), int) and x["scenarioTotal"]>0 and
                    x.get("scenarioPassed")==x["scenarioTotal"] for x in rows) and
                sum(x["scenarioTotal"] for x in rows) == 92,
                "browser case evidence incomplete")
        integrity = report.get("integrity", {})
        require(integrity.get("status") == "PASS" and
                integrity.get("sha") == source_sha and
                isinstance(integrity.get("trackedFiles"),int) and
                integrity["trackedFiles"] >= 20 and
                re.fullmatch(r"[0-9a-f]{64}",integrity.get("digest","")) is not None,
                "source bytes/clean worktree were not verified")
    else:
        require(counts == {"PASS":511,"FAIL":2,"ERROR":0,"SKIP":0},
                "JVM must have 511 PASS, two real FAIL and 0 ERROR/SKIP")
        require(report.get("gradle",{}).get("status") == "FAIL" and
                report.get("gradle",{}).get("exit_code") == 1,
                "raw Gradle must still FAIL, exit1")
        require(report.get("product_acceptance",{}).get("status") == "PASS" and
                not report["product_acceptance"].get("problems"),
                "product acceptance is not independently PASS")
        require(report.get("junit_class_files")==64 and
                report.get("junit_methods")==513 and
                report.get("fresh_junit") is True,
                "fresh JVM 64/513 proof missing")
        physical = report.get("physical_diagnostics", [])
        expected_ids = {
            "cz.zamerovac.app.SafSyncV2Test.driveStagedAckMustNotPublishAfterLocalAuthorityLostInsideProviderCommit",
            "cz.zamerovac.app.SafSyncV2Test.safDirectAckMustNotPublishAfterLocalAuthorityLostInsideProviderWrite",
        }
        require(len(physical)==2 and {p.get("id") for p in physical} == expected_ids and
                all(p.get("classification")=="EXPECTED FAIL" and
                    p.get("status")=="FAIL" and
                    ORIGINAL_FAIL_MESSAGES.get(p.get("id"),"") in p.get("message","")
                    for p in physical),
                "the two physical counterexamples must remain actual unchanged FAIL")
        cases = report["product_acceptance"].get("cases", [])
        require(len(cases)==511 and len({p.get("id") for p in cases})==511 and
                all(p.get("status")=="PASS" for p in cases),
                "missing/duplicate/non-PASS product methods")
        digests = report.get("original_test_sha256", {})
        require(digests == ORIGINAL_TEST_SHA256,
                "original diagnostic SHA256 identity changed or proof missing")
    return True

def verify(root, kind, env, source_sha, validator_sha):
    dest = scoped_dir(root, kind, env)
    report_file = dest/"results.json"
    require(dest.is_dir() and not dest.is_symlink() and
            report_file.is_file() and not report_file.is_symlink(),
            "missing mandatory current-run evidence")
    require(report_file.stat().st_size < 512*1024,
            "oversized/unexpected results report")
    report = json.loads(report_file.read_text(encoding="utf-8"))
    validate_report(report,kind,env,source_sha,validator_sha)
    return report_file

def inspect(root,kind,env,source_sha,validator_sha):
    """Before upload, accept only this run's FAIL/NOT RUN or independently PASS."""
    dest = scoped_dir(root,kind,env)
    target=dest/"results.json"
    require(target.is_file() and not target.is_symlink(),
            "current-run evidence missing; must not upload anything")
    require(target.stat().st_size < 512*1024, "oversized current-run evidence")
    report=json.loads(target.read_text(encoding="utf-8"))
    for key,value in identity(kind,env,source_sha,validator_sha).items():
        require(report.get(key)==value,"stale/mismatched artifact: "+key)
    require(report.get("schema")==4 and report.get("status") in ("PASS","FAIL","NOT RUN"),
            "invalid artifact status/schema")
    if report["status"]=="PASS":
        validate_report(report,kind,env,source_sha,validator_sha)
    return target


def main(argv=None):
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action",choices=("init","verify","inspect"))
    parser.add_argument("--kind",choices=KINDS,required=True)
    parser.add_argument("--root",type=Path,required=True)
    parser.add_argument("--source-sha",required=True)
    parser.add_argument("--validator-sha",required=True)
    args=parser.parse_args(argv)
    try:
        if args.action=="init":
            target=initialize(args.root,args.kind,os.environ,
                              args.source_sha,args.validator_sha)
            print("PENDING CURRENT RUN: "+str(target))
        elif args.action=="verify":
            target=verify(args.root,args.kind,os.environ,
                          args.source_sha,args.validator_sha)
            print("PASS CURRENT RUN EVIDENCE: "+str(target))
        else:
            target=inspect(args.root,args.kind,os.environ,
                           args.source_sha,args.validator_sha)
            print("SAFE CURRENT RUN UPLOAD: "+str(target))
        return 0
    except (EvidenceStop,ValueError,TypeError,OSError,KeyError,json.JSONDecodeError) as exc:
        print("HOME QA STOP: "+str(exc),file=sys.stderr)
        return 2

if __name__=="__main__":
    raise SystemExit(main())
