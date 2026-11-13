#!/usr/bin/env python3
"""QA-only pinned PR116 full JVM acceptance, serial WSL2 and offline.

NOT the product runner: raw Gradle must actually FAIL for both old #88 diagnostics.
Only the separately classified 511/513 product gate can PASS. No APK, merge,
workflow dispatch, install, network, or modification of the tested source branch.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import os
import re
import threading
from pathlib import Path
import platform
import shutil
import subprocess
import sys
import time

REPO = "zaplikj30-ui/Zamerovac-android"
EXPECTED_SHA = "1527e3377609633c554195b0641e02e3cfb5fb5e"
SOURCE_BRANCH = "implement/sync-core-b-20261112"
ACK_WRAPPER_BLOB = "8359a58f6a39f792f1624fd708d66c47a85d51d5"
TEST_CLASSES = 64
TEST_METHODS = 513
GOOD_METHODS = 511
ROOT = Path(__file__).resolve().parents[1]


class Stop(RuntimeError):
    pass


def require(ok: bool, reason: str) -> None:
    if not ok:
        raise Stop("HOME QA STOP: " + reason)


def git(root: Path, *args: str) -> str:
    proc = subprocess.run(["git", "-C", str(root), *args], text=True,
                          capture_output=True, timeout=15, check=False)
    require(proc.returncode == 0, "git failed: " + " ".join(args))
    return proc.stdout.strip()


def copied_worktree_status(source: Path) -> str:
    """Do not confuse copied Windows executable bits with changed content."""
    status = git(source, "status", "--porcelain")
    if status and os.environ.get("ZAMEROVAC_QA_TEMP_WSL_ROOT") == TEMP_WAIVER:
        check = subprocess.run(
            ["git", "-C", str(source), "-c", "core.filemode=false",
             "status", "--porcelain"],
            capture_output=True, text=True, check=False, timeout=20)
        require(check.returncode == 0, "WSL filemode-neutral status failed")
        status = check.stdout.strip()
        if not status:
            print("PASS: copied WSL worktree differs only in file modes")
    return status


def source_guard(source: Path, expected: str) -> None:
    """Reverify inside WSL immediately before touching source-owned Python/Gradle."""
    require(expected == EXPECTED_SHA, "unsupported product SHA")
    require(source.is_dir() and (source / ".git").exists(), "not a checked-out Git repository")
    require(git(source, "rev-parse", "HEAD") == expected, "source HEAD mismatch")
    status = copied_worktree_status(source)
    require(not status, "source worktree is not clean: " + status[:900])
    require(git(source, "hash-object", "tools/sync-ack-acceptance.py") == ACK_WRAPPER_BLOB,
            "product acceptance wrapper differs from approved PR116 bytes")


def load_product_classifier(source: Path):
    """Import only AFTER source_guard: all author integrity hashes stay unchanged."""
    path = source / "tools" / "sync-ack-acceptance.py"
    spec = importlib.util.spec_from_file_location("pinned_ack116", path)
    require(spec is not None and spec.loader is not None, "missing pinned ACK classifier")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    original_hashes = module.preserved_tests(source)
    require(original_hashes == module.TEST_DIGESTS, "original test integrity mismatch")
    return module, original_hashes


def strict_classify(module, cases, gradle_rc: int, xml_count: int,
                    fresh: bool, unchanged: bool) -> dict:
    """Do not rewrite EXPECTED FAIL into Gradle PASS or tolerate any missing case."""
    report = module.classify(cases, gradle_rc)
    problems = list(report["product_acceptance"]["problems"])
    counts = report["gradle"]["counts"]
    ids = [case["id"] for case in cases]
    if len(ids) != len(set(ids)):
        problems.append("Duplicate JVM method IDs are forbidden")
    if gradle_rc != 1:
        problems.append("Raw Gradle must actually FAIL with exit 1 from exactly two assertions")
    if xml_count != TEST_CLASSES:
        problems.append("Expected exactly 64 fresh JUnit class XML files")
    if len(cases) != TEST_METHODS:
        problems.append("Expected exactly 513 executed test methods")
    if counts != {"PASS": GOOD_METHODS, "FAIL": 2, "ERROR": 0, "SKIP": 0}:
        problems.append("Expected exactly 511 PASS, 2 actual FAIL, 0 ERROR/SKIP")
    if len(report["physical_diagnostics"]) != 2:
        problems.append("Both original physical diagnostics must be visible")
    # Independent QA-only check of the JUnit XML identities, not merely
    # product classifier's previous two E2E and one safety-prefix check.
    manifest = ROOT / "tools" / "sync116_case_manifest.json"
    require(manifest.is_file() and not manifest.is_symlink(),
            "pinned JVM case manifest missing")
    approved = json.loads(manifest.read_text(encoding="utf-8"))
    require(approved.get("sourceSha") == EXPECTED_SHA and
            {k: len(v) for k,v in approved.get("jvmRequired", {}).items()} ==
            {"SyncAckReconciliationTest":2, "SyncReceiptSafetyTest":24,
             "DatabaseInstallEvidenceTest":23},
            "untrusted JVM required test list")
    passed = {case["id"] for case in cases if case["status"] == "PASS"}
    for clazz, methods in approved["jvmRequired"].items():
        prefix = "cz.zamerovac.app." + clazz + "."
        required = {prefix + method for method in methods}
        actual = {test for test in passed if test.startswith(prefix)}
        if actual != required:
            problems.append("Missing, renamed or unexpected mandatory JUnit methods in " + clazz)
    if not fresh:
        problems.append("JUnit files are missing, old, or incomplete")
    if not unchanged:
        problems.append("Source SHA/worktree or diagnostic test bytes changed")
    report["product_acceptance"]["problems"] = problems
    report["product_acceptance"]["status"] = "FAIL" if problems else "PASS"
    return report


def pending_evidence(output, expected, validator_sha, run_id, attempt):
    require(run_id.isdecimal() and 0 < len(run_id) <= 20 and run_id[0] != "0",
            "missing/invalid run ID")
    require(attempt == "1", "re-run attempts are forbidden")
    require(re.fullmatch(r"[0-9a-f]{40}", validator_sha or "") is not None,
            "missing trusted validator SHA")
    require(output.name == "jvm" and output.parent.name == run_id + "-" + attempt,
            "JVM evidence not scoped to the current run")
    report = output / "results.json"
    require(report.is_file() and not report.is_symlink(),
            "current-run initial NOT RUN evidence missing")
    data = json.loads(report.read_text(encoding="utf-8"))
    require(data.get("schema") == 4 and data.get("kind") == "jvm" and
            data.get("status") == "NOT RUN" and data.get("sourceSha") == expected and
            data.get("validatorSha") == validator_sha and
            data.get("runId") == run_id and data.get("runAttempt") == 1,
            "JVM initial evidence is stale, forged or incomplete")


# Temporary, exact owner-approved HOME exception; NEVER merge into normal gate.
TEMP_WAIVER = "PR116-ROOT-EXCEPTION-20261113"
TEMP_QA_REF = "refs/heads/qa/sync116-jvm-waiver-20261113"


def owner_root_waiver(env: dict[str, str], expected: str, run_id: str, attempt: str) -> bool:
    return (expected == EXPECTED_SHA and attempt == "1" and
            env.get("GITHUB_REPOSITORY") == "zaplikj30-ui/Zamerovac-android" and
            env.get("GITHUB_REF") == TEMP_QA_REF and
            env.get("GITHUB_ACTOR") == "zaplikj30-ui" and
            env.get("GITHUB_TRIGGERING_ACTOR") == "zaplikj30-ui" and
            env.get("GITHUB_RUN_ATTEMPT") == "1" and
            env.get("GITHUB_RUN_ID") == run_id and
            run_id.isdecimal() and 0 < len(run_id) <= 20 and run_id[0] != "0")


def run_linux(source: Path, expected: str, output: Path,
              validator_sha: str, run_id: str, attempt: str) -> int:
    require(platform.system() == "Linux", "native JVM requires Linux in trusted WSL")
    require(bool(os.environ.get("WSL_DISTRO_NAME")) or
            "microsoft" in platform.release().lower(), "not WSL2")
    waiver = (os.environ.get("ZAMEROVAC_QA_TEMP_WSL_ROOT") == TEMP_WAIVER and
              expected == EXPECTED_SHA and attempt == "1")
    require(hasattr(os, "geteuid") and (os.geteuid() != 0 or waiver),
            "root WSL execution forbidden")
    require(git(ROOT, "rev-parse", "HEAD") == validator_sha,
            "trusted validator checkout changed")
    pending_evidence(output, expected, validator_sha, run_id, attempt)
    source_guard(source, expected)
    # Reuse the pinned existing source-independent preflight; this verifies
    # installed Java 17, javac 17, Gradle 8.10.2 and WSL. Nothing is installed.
    spec = importlib.util.spec_from_file_location("trusted_home_gate",
                                                  ROOT / "tools" / "home_qa_gate.py")
    require(spec is not None and spec.loader is not None, "trusted validator missing")
    home = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(home)
    gradle = Path("/opt/gradle-8.10.2/bin/gradle")
    home.check_wsl(gradle)
    cache = Path.home() / ".gradle" / "caches" / "modules-2"
    require(cache.is_dir() and os.access(cache, os.R_OK),
            "missing existing nonroot offline Gradle cache; no installation")
    require(waiver or not os.access(cache, os.W_OK),
            "writable dependency cache is unverified; require preexisting read-only cache")
    module, original = load_product_classifier(source)
    # Only this explicitly inspected pure-Python file may run under WSL.
    # Never use WSL-wide unittest discovery: other project tests call Node.
    probe = subprocess.run([sys.executable, "-m", "unittest", "discover",
                            "-s", "tests", "-p", "test_sync_ack_acceptance.py", "-v"],
                           cwd=source, stdin=subprocess.DEVNULL, check=False,
                           timeout=120)
    require(probe.returncode == 0, "original ACK classifier negative tests failed")
    pending_evidence(output, expected, validator_sha, run_id, attempt)

    xml_dir = source / "app/build/test-results/testPreviewUnitTest"
    # Only the temporary isolated WSL copy is changed; never the owner branch.
    if xml_dir.exists():
        shutil.rmtree(xml_dir)
    cmd = [str(gradle), "--offline", "--no-daemon", "--max-workers=1",
           "--no-parallel", ":app:testPreviewUnitTest", "--rerun-tasks"]
    started_ns = time.time_ns()
    log_path = output / "gradle-full.log"
    with log_path.open("w", encoding="utf-8") as log:
        proc = subprocess.run(cmd, cwd=source, stdout=log,
                              stderr=subprocess.STDOUT, check=False)
    files = sorted(xml_dir.glob("TEST-*.xml"))
    cases = module.read_cases(xml_dir)
    fresh = bool(files) and all(p.stat().st_mtime_ns >= started_ns for p in files)
    unchanged = (git(source, "rev-parse", "HEAD") == expected and
                 not copied_worktree_status(source) and
                 module.preserved_tests(source) == original)
    result = strict_classify(module, cases, proc.returncode, len(files), fresh, unchanged)
    result.update({
        "schema": 4, "kind": "jvm", "status": result["product_acceptance"]["status"],
        "sourceSha": expected, "validatorSha": validator_sha, "runId": run_id,
        "runAttempt": 1, "counts": result["gradle"]["counts"],
        "mode": "sync116-home-jvm", "tested_sha": expected,
        "source_branch": SOURCE_BRANCH, "validator": git(ROOT, "rev-parse", "HEAD"),
        "environment": {"platform": platform.platform(),
                        "python": platform.python_version(),
                        "java": "17", "gradle": "8.10.2",
                        "gradle_workers": 1, "offline": True, "wsl": True,
                        "wsl_uid": os.geteuid(), "temporary_root_waiver": waiver},
        "command": cmd, "junit_class_files": len(files),
        "junit_methods": len(cases), "fresh_junit": fresh,
        "original_test_sha256": original,
        "native_pdf": "NOT RUN (separate offline toolchain not verified)",
        "physical_device": "NOT RUN", "integration_release": "HOLD",
    })
    # Publish only synthetic summary, not raw potentially sensitive test logs.
    (output / "results.json").write_text(
        json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print("RAW GRADLE: " + result["gradle"]["status"] +
          " exit=" + str(proc.returncode) + " (expected exit1 ONLY for 2 known assertions)")
    print("PRODUCT ACK: " + result["product_acceptance"]["status"] +
          " 511 PASS / 2 actual EXPECTED FAIL required")
    for issue in result["product_acceptance"]["problems"]:
        print("BLOCKER: " + issue)
    print("TESTED_SOURCE_SHA=" + expected)
    return 0 if result["product_acceptance"]["status"] == "PASS" else 1


def launch_wsl(source: Path, gate: Path, expected: str, output: Path,
               validator_sha: str, run_id: str, attempt: str) -> int:
    require(platform.system() == "Windows", "WSL launch only from owner Windows host")
    require(expected == EXPECTED_SHA, "unsupported product SHA")
    require(os.environ.get("GITHUB_RUN_ID") == run_id and
            os.environ.get("GITHUB_RUN_ATTEMPT") == attempt, "run identity mismatch")
    spec = importlib.util.spec_from_file_location("trusted_owner_gate",
                                                  gate / "tools/home_qa_gate.py")
    require(spec is not None and spec.loader is not None, "trusted validator missing")
    home = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(home)
    home.trusted_owner(os.environ)
    pending_evidence(output, expected, validator_sha, run_id, attempt)
    source_guard(source, expected)
    require(git(gate, "rev-parse", "HEAD") == validator_sha and
            not git(gate, "status", "--porcelain"), "validator checkout changed")

    # Temporary owner-approved QA-branch exception; no PC/account changes.
    waiver = owner_root_waiver(os.environ, expected, run_id, attempt)
    # Existing WSL default user remains fail-closed everywhere else.
    # An independent stdin heartbeat watchdog kills the detached WSL process
    # group on lost Windows client, including during a timed-out Gradle.
    linux = r'''
set -Eeuo pipefail
waiver="$8"
if [ "$waiver" = "PR116-ROOT-EXCEPTION-20261113" ]; then
  export ZAMEROVAC_QA_TEMP_WSL_ROOT="$waiver"
elif [ "$(id -u)" -eq 0 ]; then
  echo 'BLOCKED root WSL account forbidden' >&2; exit 77
fi
umask 077
source_dir="$(wslpath -u "$1")"
gate_dir="$(wslpath -u "$2")"
output_dir="$(wslpath -u "$3")"
expected="$4"
gate_sha="$5"
run_id="$6"
attempt="$7"
test "$attempt" = "1"
test -r "$HOME/.gradle/caches/modules-2" && test -d "$HOME/.gradle/caches/modules-2" || {
 echo 'BLOCKED nonroot Gradle offline cache unavailable' >&2; exit 78; }
test -x /opt/gradle-8.10.2/bin/gradle || exit 79
if [ "$waiver" != "PR116-ROOT-EXCEPTION-20261113" ]; then
 test ! -w "$HOME/.gradle/caches/modules-2" || {
  echo 'BLOCKED dependencies must already be read-only' >&2; exit 80; }
fi
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export PATH="$JAVA_HOME/bin:$PATH" CI=1
test "$(git -C "$source_dir" rev-parse HEAD)" = "$expected"
test "$(git -C "$gate_dir" rev-parse HEAD)" = "$gate_sha"
tmp="$(mktemp -d "/tmp/zamerovac-sync116-$run_id-XXXXXXXX")"
child="" 
watch=""
cleanup() {
 rc="$?"
 trap - EXIT HUP INT TERM
 if [ -n "$watch" ]; then kill "$watch" 2>/dev/null || true; fi
 if [ -n "$child" ]; then
  kill -TERM -- "-$child" 2>/dev/null || true
  sleep 2
  kill -KILL -- "-$child" 2>/dev/null || true
  wait "$child" 2>/dev/null || true
 fi
 rm -rf -- "$tmp"
 exit "$rc"
}
trap cleanup EXIT HUP INT TERM
cp -a "$source_dir/." "$tmp/"
cd "$tmp"
test "$(git rev-parse HEAD)" = "$expected"
setsid timeout -s TERM -k 15s 2650s python3 "$gate_dir/tools/sync116_home_qa.py" linux-run \
 --source "$tmp" --expected-sha "$expected" --validator-sha "$gate_sha" \
 --run-id "$run_id" --run-attempt "$attempt" --output "$output_dir" &
child="$!"
# Explicit stdin redirection prevents noninteractive Bash from assigning
# /dev/null to this asynchronous watcher instead of the Windows heartbeat pipe.
(
 while true; do
  if IFS= read -r -t 20 heartbeat; then
   [ "$heartbeat" = "QA117_ALIVE" ] || break
  else
   break
  fi
 done
 kill -TERM -- "-$child" 2>/dev/null || true
 sleep 2
 kill -KILL -- "-$child" 2>/dev/null || true
) <&0 &
watch="$!"
wait "$child"
'''
    args = ["wsl.exe", "--distribution", "Zamerovac-Ubuntu-QA",
            "--exec", "/bin/bash", "-lc", linux, "_", str(source),
            str(gate), str(output), expected, validator_sha, run_id, attempt,
            TEMP_WAIVER if waiver else "STRICT-NONROOT"]
    stop = threading.Event()
    proc = subprocess.Popen(args, stdin=subprocess.PIPE)
    def heartbeat():
        while not stop.is_set():
            try:
                if proc.stdin is None:
                    break
                proc.stdin.write(b"QA117_ALIVE\n")
                proc.stdin.flush()
            except (OSError, ValueError):
                break
            if stop.wait(5):
                break
    sender = threading.Thread(target=heartbeat, name="sync116-wsl-heartbeat",
                              daemon=True)
    sender.start()
    try:
        try:
            rc = proc.wait(timeout=2700)
        except subprocess.TimeoutExpired as error:
            if proc.stdin and not proc.stdin.closed:
                proc.stdin.close()
            try:
                proc.wait(timeout=35)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait(timeout=15)
            raise Stop("WSL timeout: process-tree cleanup requested; QA HOLD") from error
        require(rc == 0, "WSL JVM failed or dependency missing: " + str(rc))
        return 0
    finally:
        stop.set()
        if proc.stdin and not proc.stdin.closed:
            proc.stdin.close()
        sender.join(timeout=2)


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="mode", required=True)
    for mode in ("windows-wsl", "linux-run"):
        arg = sub.add_parser(mode)
        arg.add_argument("--source", type=Path, required=True)
        arg.add_argument("--expected-sha", required=True)
        arg.add_argument("--output", type=Path, required=True)
        arg.add_argument("--validator-sha", required=True)
        arg.add_argument("--run-id", required=True)
        arg.add_argument("--run-attempt", required=True)
        if mode == "windows-wsl":
            arg.add_argument("--gate", type=Path, required=True)
    args = parser.parse_args(argv)
    try:
        if args.mode == "windows-wsl":
            return launch_wsl(args.source, args.gate, args.expected_sha, args.output,
                              args.validator_sha, args.run_id, args.run_attempt)
        return run_linux(args.source, args.expected_sha, args.output,
                         args.validator_sha, args.run_id, args.run_attempt)
    except (Stop, OSError, subprocess.TimeoutExpired, ValueError) as error:
        print("FAIL-CLOSED: " + str(error), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
