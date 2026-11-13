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


def source_guard(source: Path, expected: str) -> None:
    """Reverify inside WSL immediately before touching source-owned Python/Gradle."""
    require(expected == EXPECTED_SHA, "unsupported product SHA")
    require(source.is_dir() and (source / ".git").exists(), "not a checked-out Git repository")
    require(git(source, "rev-parse", "HEAD") == expected, "source HEAD mismatch")
    require(not git(source, "status", "--porcelain"), "source worktree is not clean")
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
    if not fresh:
        problems.append("JUnit files are missing, old, or incomplete")
    if not unchanged:
        problems.append("Source SHA/worktree or diagnostic test bytes changed")
    report["product_acceptance"]["problems"] = problems
    report["product_acceptance"]["status"] = "FAIL" if problems else "PASS"
    return report


def run_linux(source: Path, expected: str, output: Path) -> int:
    require(platform.system() == "Linux", "native JVM requires Linux in trusted WSL")
    require(bool(os.environ.get("WSL_DISTRO_NAME")) or
            "microsoft" in platform.release().lower(), "not WSL2")
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
    module, original = load_product_classifier(source)
    require(not output.exists() or not any(output.iterdir()),
            "refuse to overwrite existing HOME evidence")
    output.mkdir(parents=True, exist_ok=True)

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
                 not git(source, "status", "--porcelain") and
                 module.preserved_tests(source) == original)
    result = strict_classify(module, cases, proc.returncode, len(files), fresh, unchanged)
    result.update({
        "schema": 1, "mode": "sync116-home-jvm", "tested_sha": expected,
        "source_branch": SOURCE_BRANCH, "validator": git(ROOT, "rev-parse", "HEAD"),
        "environment": {"platform": platform.platform(),
                        "python": platform.python_version(),
                        "java": "17", "gradle": "8.10.2",
                        "gradle_workers": 1, "offline": True, "wsl": True},
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


def launch_wsl(source: Path, gate: Path, expected: str, output: Path) -> int:
    require(platform.system() == "Windows", "WSL launch only from owner Windows host")
    require(expected == EXPECTED_SHA, "unsupported product SHA")
    source_guard(source, expected)
    require(git(gate, "rev-parse", "HEAD") ==
            git(ROOT, "rev-parse", "HEAD"), "validator checkout changed")
    require(not output.exists(), "refuse previous report or evidence overwrite")
    # Validate the Windows-side real checkout and gate BEFORE WSL. The generated
    # workflow separately checks both full SHAs and strict-lints its own YAML.
    linux = r'''
set -Eeuo pipefail
source_dir="$(wslpath -u "$1")"
gate_dir="$(wslpath -u "$2")"
output_dir="$(wslpath -u "$3")"
expected="$4"
gate_sha="$5"
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export PATH="$JAVA_HOME/bin:$PATH" CI=1
test "$(git -C "$source_dir" rev-parse HEAD)" = "$expected"
test "$(git -C "$gate_dir" rev-parse HEAD)" = "$gate_sha"
mkdir -p /root/zamerovac-qa-commits
tmp="$(mktemp -d /root/zamerovac-qa-commits/sync116-XXXXXXXX)"
trap 'rc=$?; rm -rf "$tmp"; exit "$rc"' EXIT
cp -a "$source_dir/." "$tmp/"
cd "$tmp"
test "$(git rev-parse HEAD)" = "$expected"
timeout -s TERM -k 15s 2700s python3 "$gate_dir/tools/sync116_home_qa.py" linux-run --source "$tmp" --expected-sha "$expected" --output "$output_dir"
'''
    args = ["wsl.exe", "--distribution", "Zamerovac-Ubuntu-QA", "--user",
            "root", "--exec", "/bin/bash", "-lc", linux, "_", str(source),
            str(gate), str(output), expected, git(gate, "rev-parse", "HEAD")]
    proc = subprocess.run(args, stdin=subprocess.DEVNULL,
                          check=False, timeout=2800)
    require(proc.returncode == 0, "WSL JVM safety/acceptance failed: exit=" +
            str(proc.returncode))
    return 0


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="mode", required=True)
    for mode in ("windows-wsl", "linux-run"):
        arg = sub.add_parser(mode)
        arg.add_argument("--source", type=Path, required=True)
        arg.add_argument("--expected-sha", required=True)
        arg.add_argument("--output", type=Path, required=True)
        if mode == "windows-wsl":
            arg.add_argument("--gate", type=Path, required=True)
    args = parser.parse_args(argv)
    try:
        if args.mode == "windows-wsl":
            return launch_wsl(args.source, args.gate, args.expected_sha, args.output)
        return run_linux(args.source, args.expected_sha, args.output)
    except (Stop, OSError, subprocess.TimeoutExpired, ValueError) as error:
        print("FAIL-CLOSED: " + str(error), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
