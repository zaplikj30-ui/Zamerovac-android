#!/usr/bin/env python3
"""Owner-approved product gate. Always runs the FULL JVM suite, including the two visible physical counterexamples.

An exit code of zero belongs ONLY to this product gate. The underlying Gradle
run containing the two expected failures is still FAIL and is reported as such.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import shutil
import subprocess
import threading
import time
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
EXPECTED = {
    "cz.zamerovac.app.SafSyncV2Test.driveStagedAckMustNotPublishAfterLocalAuthorityLostInsideProviderCommit":
        "Provider completed signed ACK after recovery epoch loss: Drive staged expected:<0> but was:<1>",
    "cz.zamerovac.app.SafSyncV2Test.safDirectAckMustNotPublishAfterLocalAuthorityLostInsideProviderWrite":
        "Provider completed signed ACK after recovery epoch loss: SAF direct expected:<0> but was:<1>",
}
REQUIRED = {
    "cz.zamerovac.app.SyncAckReconciliationTest.driveLateDuplicateAckRestartBothAndRetryMustNotFalselyFinish",
    "cz.zamerovac.app.SyncAckReconciliationTest.safLateDuplicateAckRestartBothAndRetryMustNotFalselyFinish",
}
# Immutable exact 513 method IDs from independent #116 JUnit inventory.
# New PASS tests count automatically; no manually maintained total-case gate.
# This content is fingerprinted against the original independently reviewed XML.
# https://github.com/zaplikj30-ui/Zamerovac-android/pull/116#issuecomment-6838698456
EXPECTED_CASE_IDS_SHA256 = "e4897bcee1daec5a1e319ab0a9854fa915d2ee81d7501f3987ac4e89bad8c8a7"
BASELINE_CASES_FILE = ROOT / "tools/qa/jvm-baseline-116.txt"
REQUIRED_LATER_CASE_IDS = frozenset({
    "cz.zamerovac.app.ProtectedRevisionsTest.repeatedDimensionSaveProfile",
    "cz.zamerovac.app.ProtectedRevisionsTest.warmCacheRejectsSameSizeCorruptionAndReplacement",
})


def baseline_case_ids():
    """Validate the archived immutable list, then return its exact method IDs."""
    lines = BASELINE_CASES_FILE.read_text(encoding="ascii").splitlines()
    if not lines or len(lines) != len(set(lines)) or lines != sorted(lines):
        raise ValueError("Historical JVM method manifest missing, duplicated or unsorted")
    digest = hashlib.sha256(
        json.dumps(lines, separators=(",", ":"), ensure_ascii=True).encode("ascii")
    ).hexdigest()
    if digest != EXPECTED_CASE_IDS_SHA256:
        raise ValueError("Historical #116 JVM baseline fingerprint changed")
    return frozenset(lines)


EXPECTED_CASE_COUNT = len(baseline_case_ids())

TEST_DIGESTS = {
    "provider-and-helpers": "69297e7750a3e5e774211ff2406c9dadcbe9694ff525edbaeb1f872e9725b088",
    "original-two-diagnostics": "3770b50aa1b10076015640dcc25832e30a9ba9b8b27fc083ffa3be801e02ba67",
    "unchanged-product-e2e": "e74689baf33d2ea75b8b420b1ef9898a91937eda8101a76ce3125241dfdf0c70",
}


def preserved_tests(root=ROOT):
    home = root / "app/src/test/java/cz/zamerovac/app"
    source = (home / "SafSyncV2Test.java").read_text(encoding="utf-8")
    pieces = {
        "provider-and-helpers": source[:source.index(" void assertLateProviderAckDoesNotDestroySource")].encode(),
        "original-two-diagnostics": source[source.index(" void ackProviderBoundary("):source.index(" @Test public void corruptionAfterAckOutputCreateCannotPublishValidCloudAck")].encode(),
        "unchanged-product-e2e": (home / "SyncAckReconciliationTest.java").read_bytes(),
    }
    actual = {name: hashlib.sha256(data).hexdigest() for name, data in pieces.items()}
    if actual != TEST_DIGESTS:
        raise ValueError("Original diagnostics/helpers or the existing product E2E tests changed")
    return actual


def read_cases(directory):
    cases = []
    for path in sorted(Path(directory).glob("TEST-*.xml")):
        root = ET.parse(path).getroot()
        for case in root.findall("testcase"):
            failure = case.find("failure")
            error = case.find("error")
            status = "ERROR" if error is not None else "FAIL" if failure is not None else "SKIP" if case.find("skipped") is not None else "PASS"
            node = error if error is not None else failure
            cases.append({"id": case.get("classname", root.get("name")) + "." + case.get("name"),
                          "status": status, "message": node.get("message", "") if node is not None else ""})
    return cases


def classify(cases, gradle_exit):
    """Only the exact two reproduced assertion failures are expected; no other failure/skip is excused."""
    counts = {key: sum(case["status"] == key for case in cases) for key in ("PASS", "FAIL", "ERROR", "SKIP")}
    ids = [case["id"] for case in cases]
    problems = []
    if not cases or len(ids) != len(set(ids)):
        problems.append("Missing or duplicate JVM cases")
    diagnostics, product = [], []
    for case in cases:
        if case["id"] in EXPECTED:
            expected = case["status"] == "FAIL" and EXPECTED[case["id"]] in case["message"]
            diagnostics.append(dict(case, classification="EXPECTED FAIL" if expected else "UNEXPECTED"))
            if not expected:
                problems.append("Counterexample did not reproduce its exact unchanged assertion: " + case["id"])
        else:
            product.append(case)
            if case["status"] != "PASS":
                problems.append("Product case is not PASS: " + case["id"])
    if {case["id"] for case in diagnostics} != set(EXPECTED):
        problems.append("Both original diagnostics must be executed visibly")
    if not REQUIRED <= {case["id"] for case in product if case["status"] == "PASS"}:
        problems.append("Both original product E2E acceptance cases must run and PASS")
    if not any(case["id"].startswith("cz.zamerovac.app.SyncReceiptSafetyTest.") for case in product):
        problems.append("Missing negative receipt safety suite")
    if gradle_exit != 1:
        problems.append("Expected raw Gradle FAIL (exit 1), never a cached/failed compilation or reported full PASS")
    return {"gradle": {"status": "PASS" if gradle_exit == 0 else "FAIL", "exit_code": gradle_exit, "counts": counts},
            "physical_diagnostics": diagnostics,
            "product_acceptance": {"status": "FAIL" if problems else "PASS", "cases": product,
                                   "counts": {key: sum(case["status"] == key for case in product) for key in counts},
                                   "problems": problems}}


def inventory_problems(cases):
    """Require every original #116 JVM method; count newer PASS tests automatically.

    This prevents the old 513 -> 515 false-fail: no new count/hash to update.
    The original 513 IDs and two explicitly retained PR #222 tests may never
    disappear or be renamed. All other new tests must be actual PASS (classify).
    """
    ids = [case["id"] for case in cases]
    found = set(ids)
    required = baseline_case_ids() | REQUIRED_LATER_CASE_IDS
    problems = []
    if len(ids) != len(found):
        problems.append("Duplicate JVM method IDs in full test inventory")
    missing = sorted(required - found)
    if missing:
        problems.append(
            f"Missing {len(missing)} protected JVM test methods: " +
            ", ".join(missing[:8]) + (" ..." if len(missing) > 8 else "")
        )
    # New method names are deliberately allowed when all of their tests PASS.
    # This is additive-only: no original test ID may be removed/replaced.
    return problems


def git(*args):
    return subprocess.check_output(["git", *args], cwd=ROOT, text=True).strip()



# The approved GitHub-hosted job already enforces its own 60-minute limit.
# A previous successful FULL JVM run took ~52 minutes end-to-end. Do not add
# a shorter default wall limit that would misclassify a valid run as a failure.
# A caller may supply a timeout for a deliberately targeted diagnostic test.
JVM_WALL_LIMIT_SECONDS = None


def run_gradle_logged(command, logfile, max_seconds=JVM_WALL_LIMIT_SECONDS):
    """Preserve the complete Gradle output privately and emit safe CI heartbeats.

    Previous runs redirected all stdout to a file, leaving the Actions step
    visually silent for tens of minutes. No test data, paths, tokens or saved
    customer records are echoed. The underlying full JVM command is unchanged.
    Do not shorten the approved 60-minute Actions job timeout by default.
    """
    stop = threading.Event()
    began = time.monotonic()
    result = None

    def heartbeat():
        while not stop.wait(60):
            try:
                size = logfile.stat().st_size
            except OSError:
                size = 0
            print(f"JVM progress: elapsed={int(time.monotonic()-began)}s, "
                  f"gradle_log_bytes={size}; full suite still in progress",
                  flush=True)

    with logfile.open("w", encoding="utf-8") as log:
        worker = threading.Thread(target=heartbeat, daemon=True)
        worker.start()
        print("JVM full run starting; progress every 60s; "
              "no additional timeout beyond GitHub's existing job limit "
              "(raw FAIL remains expected for #88)", flush=True)
        try:
            try:
                result = subprocess.run(command, cwd=ROOT, stdout=log,
                                        stderr=subprocess.STDOUT, check=False,
                                        timeout=max_seconds)
            except subprocess.TimeoutExpired:
                log.write(f"\nBLOCKED: JVM full suite exceeded {max_seconds}s "
                          "and was terminated; inspect partial Gradle output.\n")
                log.flush()
                print("BLOCKED: JVM full suite timeout; NOT a product PASS. "
                      "Partial gradle-full.log will be retained as evidence.",
                      flush=True)
                result = subprocess.CompletedProcess(command, 124)
            return result
        finally:
            stop.set()
            worker.join(timeout=0.5)


def run():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "app/build/reports/syncAckAcceptance")
    parser.add_argument("--online-dependencies", action="store_true",
                        help="Allow Gradle dependency downloads on fresh hosted runners; offline remains default")
    args = parser.parse_args()
    if git("status", "--porcelain"):
        raise ValueError("A final SHA gate requires a clean committed worktree")
    digests = preserved_tests()
    sha = git("rev-parse", "HEAD")
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    command = (["cmd.exe", "/d", "/c", "gradle.bat"] if os.name == "nt" else ["gradle"])
    command += ([] if args.online_dependencies else ["--offline"])
    command += ["--no-daemon", "--max-workers=2", ":app:testPreviewUnitTest", "--rerun"]
    started = time.time_ns()
    process = run_gradle_logged(command, output / "gradle-full.log")
    directory = ROOT / "app/build/test-results/testPreviewUnitTest"
    files = list(directory.glob("TEST-*.xml"))
    cases = read_cases(directory)
    result = classify(cases, process.returncode)
    problems = result["product_acceptance"]["problems"]
    problems.extend(inventory_problems(cases))
    if len(files) < 64 or len(cases) < EXPECTED_CASE_COUNT:
        problems.append("Incomplete full JVM suite; a targeted run cannot satisfy the final gate")
    if not files or any(file.stat().st_mtime_ns < started for file in files):
        problems.append("Missing or stale JUnit XML: compilation failure/old reports cannot satisfy the gate")
    if git("rev-parse", "HEAD") != sha or git("status", "--porcelain"):
        problems.append("Source tree changed during verification")
    if preserved_tests() != digests:
        problems.append("Diagnostic or E2E test integrity changed during verification")
    result["product_acceptance"]["status"] = "FAIL" if problems else "PASS"
    result.update({"schema": 1, "tested_sha": sha, "command": command,
                   "environment": {"os": platform.platform(), "python": platform.python_version()},
                   "test_integrity": digests,
                   "not_run": ["HOME Windows", "Physical Android/SAF/radio/reboot", "Live Drive/OAuth/quota", "Real disk-full/power-cut"],
                   "integration_release": "HOLD pending independent Controller 40 and authorized physical QA"})
    xml = output / "junit"
    xml.mkdir(exist_ok=True)
    for old in xml.glob("TEST-*.xml"):
        old.unlink()
    for file in files:
        shutil.copy2(file, xml / file.name)
    (output / "results.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("RAW GRADLE: " + result["gradle"]["status"], result["gradle"]["counts"])
    for case in result["physical_diagnostics"]:
        print(case["classification"] + " (actual FAIL): " + case["id"])
    print("PRODUCT ACCEPTANCE: " + result["product_acceptance"]["status"], result["product_acceptance"]["counts"])
    print("SHA: " + sha + "\nEvidence: " + str(output))
    for problem in problems:
        print("BLOCKER: " + problem)
    return 0 if result["product_acceptance"]["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(run())
