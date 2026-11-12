#!/usr/bin/env python3
"""Fail-fast, cross-OS gate for trusted HOME QA (never builds or releases an APK).

Contract: Python tests that launch Node ALWAYS run on Windows. WSL2 is for
Gradle/Java and explicitly allowlisted pure-Python JDK probes, not generic
'unittest discover'. Run the gate before any expensive test command.
Only Python standard-library dependencies are used.
"""
from __future__ import annotations

import argparse
import os
from pathlib import Path
import platform
import re
import shutil
import subprocess
import sys
import unittest


REPO = "zaplikj30-ui/Zamerovac-android"
OWNER = "zaplikj30-ui"
SHA = re.compile(r"[0-9a-f]{40}\Z")
CHECKOUT = re.compile(r"actions/checkout@[0-9a-f]{40}(?![0-9a-f])")
TEST_COMMAND = re.compile(r"\bpython(?:3(?:\.\d+)?)?\s+-m\s+unittest\b")
ROOT = Path(__file__).resolve().parent.parent


class GateError(RuntimeError):
    """Fail closed instead of silently skipping an invalid environment."""


def demand(condition: bool, explanation: str) -> None:
    if not condition:
        raise GateError("HOME QA STOP: " + explanation)


def confirm_sha(actual: str, expected: str) -> None:
    demand(bool(SHA.fullmatch(expected)), "expected source must be a literal 40-character Git SHA")
    demand(actual == expected, "wrong checkout SOURCE SHA: expected " + expected + ", actual " + actual)


def git_source(root: Path, expected: str) -> str:
    demand(bool(SHA.fullmatch(expected)), "expected source must be a literal 40-character Git SHA")
    demand(root.is_dir() and (root / ".git").exists(), "not a real checked-out Git repository: " + str(root))
    try:
        actual = subprocess.run(
            ["git", "rev-parse", "HEAD"], cwd=root, capture_output=True,
            text=True, check=True, timeout=10,
        ).stdout.strip()
    except (OSError, subprocess.CalledProcessError, subprocess.TimeoutExpired) as failure:
        raise GateError("HOME QA STOP: git HEAD cannot be verified: " + str(failure)) from failure
    confirm_sha(actual, expected)
    return actual


def trusted_owner(environ: dict[str, str]) -> None:
    """Local developer checks are permitted, CI checks require owner+self-hosted."""
    if environ.get("GITHUB_ACTIONS") != "true":
        return
    demand(environ.get("GITHUB_REPOSITORY") == REPO, "untrusted repository; never run HOME on forks")
    demand(environ.get("GITHUB_ACTOR", "").lower() == OWNER, "untrusted workflow actor")
    demand(environ.get("GITHUB_EVENT_NAME") in ("push", "workflow_dispatch"),
           "PR/fork events cannot run HOME QA")
    ref = environ.get("GITHUB_REF", "")
    demand(ref == "refs/heads/main" or ref.startswith("refs/heads/qa/"),
           "HOME is restricted to owner-controlled main or qa/* branches")
    demand(not environ.get("GITHUB_HEAD_REF") and not environ.get("GITHUB_BASE_REF"),
           "pull request head/base is forbidden on the HOME runner")
    runner = environ.get("RUNNER_ENVIRONMENT")
    demand(not runner or runner == "self-hosted", "cloud-hosted runner is forbidden")


def is_wsl(system: str, environ: dict[str, str], release: str) -> bool:
    return (system == "Linux" and
            (bool(environ.get("WSL_DISTRO_NAME")) or "microsoft" in release.lower()))


def require_program(command: str, resolve=shutil.which) -> str:
    executable = resolve(command)
    demand(bool(executable), "required executable " + command + " missing from PATH")
    return str(executable)


def command_ok(argv: list[str], cwd: Path | None = None) -> None:
    try:
        subprocess.run(argv, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                       text=True, check=True, timeout=12)
    except (OSError, subprocess.CalledProcessError, subprocess.TimeoutExpired) as failure:
        raise GateError("HOME QA STOP: dependency not executable " + argv[0] + ": " + str(failure)) from failure


def check_windows(resolve=shutil.which, system: str | None = None) -> None:
    system = system or platform.system()
    demand(system == "Windows" and not os.environ.get("WSL_DISTRO_NAME"),
           "Python tests calling Node must execute on WINDOWS; WSL is not supported")
    require_program("node", resolve)
    demand(bool(resolve("python") or resolve("py")),
           "Windows Python 3 for unittest missing from PATH")
    demand(sys.version_info.major == 3, "Python 3 is required")
    if resolve is shutil.which:
        command_ok(["node", "--version"])


def read_version(argv: list[str]) -> str:
    """Check executable output, not existence of a fake java/gradle file."""
    try:
        result = subprocess.run(argv, capture_output=True, text=True, check=True, timeout=25)
    except (OSError, subprocess.CalledProcessError, subprocess.TimeoutExpired) as exc:
        raise GateError("HOME QA STOP: unusable JDK or Gradle executable " +
                        argv[0] + ": " + str(exc)) from exc
    return result.stdout + "\n" + result.stderr


def check_wsl(gradle: Path, resolve=shutil.which, system: str | None = None,
              environ: dict[str, str] | None = None, release: str | None = None) -> None:
    environ = environ if environ is not None else os.environ
    system = system or platform.system()
    release = platform.release() if release is None else release
    demand(is_wsl(system, environ, release),
           "native Gradle must execute in the trusted WSL2 Linux environment")
    demand(sys.version_info.major == 3, "WSL Python 3 is required")
    require_program("git", resolve)
    require_program("python3", resolve)
    java_home = environ.get("JAVA_HOME", "")
    java = Path(java_home) / "bin" / "java" if java_home else None
    javac = Path(java_home) / "bin" / "javac" if java_home else None
    demand(bool(java and java.is_file() and javac and javac.is_file()),
           "JAVA_HOME must point to installed JDK17 with java and javac; no auto-install")
    demand(gradle.is_file() and os.access(gradle, os.X_OK),
           "pinned local Gradle missing or not executable: " + str(gradle))
    demand(os.access(java, os.X_OK) and os.access(javac, os.X_OK),
           "JAVA_HOME must contain executable JDK java and javac")
    java_version = read_version([str(java), "-version"])
    javac_version = read_version([str(javac), "-version"])
    gradle_version = read_version([str(gradle), "--version"])
    demand(bool(re.search(r'(?i)\b(?:openjdk|java) version "17\.', java_version)),
           "JDK 17 runtime required, not a fake or incompatible Java")
    demand(bool(re.search(r'(?m)^javac 17\.', javac_version)),
           "JDK 17 compiler required")
    demand(bool(re.search(r'(?m)^Gradle 8\.10\.2\b', gradle_version)),
           "Gradle 8.10.2 required, not just an existing file")
    # No WSL Node dependency. Generic unittest discovery is Windows-only.


# No generic YAML parsing by global substring: exact canonical allowlist only.
# Any comments, anchors, additional jobs, altered triggers or shell commands STOP.
ONE_SHOT_RECIPE = r'''
name: Zaměřovač - canonical owner-only HOME QA, no APK
on:
  push:
    branches: [__QA_BRANCH__]
    paths: ['.github/workflows/home-qa-one-shot.yml']
permissions:
  contents: read
concurrency:
  group: canonical-home-qa-__QA_BRANCH__
  cancel-in-progress: false
jobs:
  trusted-qa:
    if: ${{ github.repository == 'zaplikj30-ui/Zamerovac-android' && github.actor == 'zaplikj30-ui' && github.ref == 'refs/heads/__QA_BRANCH__' && github.event_name == 'push' }}
    runs-on: [self-hosted, Windows, X64, zamerovac-qa]
    timeout-minutes: 50
    env:
      CI: '1'
      PYTHONUTF8: '1'
      TESTED_SHA: '__SOURCE_SHA__'
    steps:
      - name: Verify owner service and installed tools
        shell: cmd
        run: |
          if /I not "%USERNAME%"=="ZamerovacQA" exit /b 1
          if not exist "C:\actions-runner\tools\MinGit-2.56.0.4\cmd\git.exe" exit /b 1
          if not exist "C:\actions-runner\tools\Python313\python.exe" exit /b 1
          echo C:\actions-runner\tools\MinGit-2.56.0.4\cmd>>"%GITHUB_PATH%"
          echo C:\actions-runner\tools\Python313>>"%GITHUB_PATH%"
      - name: Read-only tested source at literal SHA
        uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4
        with:
          ref: __SOURCE_SHA__
          path: source
          fetch-depth: 1
          persist-credentials: false
          submodules: false
      - name: Read-only triggering workflow for self lint
        uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4
        with:
          path: recipe
          fetch-depth: 1
          persist-credentials: false
          submodules: false
      - name: Exact YAML preflight and adversarial negative tests before QA
        shell: cmd
        run: |
          cd /d "%GITHUB_WORKSPACE%\source"
          python tools\home_qa_gate.py lint-workflow "..\recipe\.github\workflows\home-qa-one-shot.yml" --strict
          if errorlevel 1 exit /b 1
          python -m unittest discover -s tests -p test_home_qa_gate.py -v
          if errorlevel 1 exit /b 1
          python tools\home_qa_gate.py windows-quick --expected-sha __SOURCE_SHA__ --root . --check-only
          if errorlevel 1 exit /b 1
      - name: All quick Windows Node and Python tests
        shell: cmd
        run: |
          cd /d "%GITHUB_WORKSPACE%\source"
          set "LOCALAPPDATA=%GITHUB_WORKSPACE%\qa-evidence"
          python tools\home_qa_gate.py windows-quick --expected-sha __SOURCE_SHA__ --root .
          if errorlevel 1 exit /b 1
      - name: Controlled WSL native JDK Gradle and approved Python probes
        shell: cmd
        run: |
          cd /d "%GITHUB_WORKSPACE%\source"
          python tools\home_qa_gate.py wsl-check-from-windows --expected-sha __SOURCE_SHA__ --root .
          if errorlevel 1 exit /b 1
      - name: Upload synthetic quick results, never APK
        if: always()
        uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4
        with:
          name: canonical-home-qa-__SOURCE_SHA__
          path: qa-evidence/Zamerovac-QA/results/
          retention-days: 7
          if-no-files-found: ignore
'''


# Keep the existing canonical quick + WSL recipe byte-identical. A distinct,
# strictly allowlisted mode runs REAL Chromium pixel tests on the same trusted
# Windows service, without Android builds or full WSL/Gradle repetition.
ONE_SHOT_BROWSER_STEPS = r'''      - name: Serial Windows Chromium pixel and editor regression
        shell: cmd
        run: |
          cd /d "%GITHUB_WORKSPACE%\source"
          set "PLAYWRIGHT_BROWSERS_PATH=C:\actions-runner\tools\ms-playwright"
          set "LOCALAPPDATA=%GITHUB_WORKSPACE%\qa-evidence"
          node tools\local-browser-qa.cjs --self-test
          if errorlevel 1 exit /b 1
          call npm.cmd install --no-save --package-lock=false --ignore-scripts --no-audit --no-fund playwright@1.62.1
          if errorlevel 1 exit /b 1
          call npx.cmd --no-install playwright install chromium
          if errorlevel 1 exit /b 1
          node tools\local-browser-qa.cjs --all
          if errorlevel 1 exit /b 1
'''

def browser_workflow_recipe() -> str:
    """Only an exact canonical Windows-only browser variant is permitted."""
    first = "      - name: All quick Windows Node and Python tests\n"
    last = "      - name: Upload synthetic quick results, never APK\n"
    demand(ONE_SHOT_RECIPE.count(first) == 1 and ONE_SHOT_RECIPE.count(last) == 1,
           "canonical recipe changed: browser mode must not guess step boundaries")
    start = ONE_SHOT_RECIPE.index(first)
    stop = ONE_SHOT_RECIPE.index(last, start)
    base = ONE_SHOT_RECIPE[:start] + ONE_SHOT_BROWSER_STEPS + ONE_SHOT_RECIPE[stop:]
    old_lint = r'python tools\home_qa_gate.py lint-workflow'
    new_lint = r'python ..\recipe\tools\home_qa_gate.py lint-workflow'
    demand(base.count(old_lint) == 1, "canonical lint guard changed")
    base = base.replace(old_lint, new_lint)
    base = base.replace("      - name: Upload synthetic quick results, never APK",
                        "      - name: Upload small browser logs, no APK or source media")
    base = base.replace("name: canonical-home-qa-__SOURCE_SHA__",
                        "name: canonical-home-browser-__SOURCE_SHA__")
    old_path = "          path: qa-evidence/Zamerovac-QA/results/"
    new_path = (
        "          path: |\n"
        "            qa-evidence/Zamerovac-QA/browser/**/results.json\n"
        "            qa-evidence/Zamerovac-QA/browser/**/*.log\n"
        "            qa-evidence/Zamerovac-QA/browser/**/evidence/**/report.json"
    )
    demand(base.count(old_path) == 1, "canonical artifact path changed")
    base = base.replace(old_path, new_path).replace("retention-days: 7", "retention-days: 3")
    return base

def render_workflow(branch: str, source_sha: str, browser: bool = False) -> str:
    demand(bool(re.fullmatch(r"qa/[a-z][a-z0-9._-]{3,65}", branch)),
           "only a literal trusted qa/* branch is allowed")
    demand(bool(SHA.fullmatch(source_sha)), "exact 40-character source SHA required")
    template = browser_workflow_recipe() if browser else ONE_SHOT_RECIPE
    return (template.replace("__QA_BRANCH__", branch)
            .replace("__SOURCE_SHA__", source_sha).lstrip("\n"))



def output_canonical_utf8(payload: bytes, output: Path | None) -> None:
    """Write UTF-8 bytes, independent of Windows console codepage/CP1250.

    Never silently overwrite an existing trusted workflow. The canonical
    filename restriction is part of the one-shot security contract.
    """
    if output is None:
        stream = getattr(sys.stdout, "buffer", None)
        demand(stream is not None,
               "no binary stdout available; use --output for safe UTF-8 workflow creation")
        stream.write(payload)
        stream.flush()
        return

    demand(output.name == "home-qa-one-shot.yml" and
           output.parent.name == "workflows" and
           output.parent.parent.name == ".github",
           "--output must be .github/workflows/home-qa-one-shot.yml")
    demand(output.parent.is_dir() and
           not output.parent.is_symlink() and not output.parent.parent.is_symlink(),
           "workflow directory must already exist and must not be a symlink")
    try:
        with output.open("xb") as handle:
            handle.write(payload)
    except FileExistsError as failure:
        raise GateError("HOME QA STOP: output already exists, refusing to overwrite: " +
                        str(output)) from failure


def check_workflow(content: str, strict: bool = True) -> None:
    """Refuse all YAML outside known-good single-job one-shot template."""
    demand(strict, "permissive legacy YAML scan is no longer allowed")
    normalized = content.replace("\r\n", "\n")
    branch = re.search(r"(?m)^    branches: \[(qa/[a-z][a-z0-9._-]{3,65})\]$", normalized)
    source = re.search(r"(?m)^          ref: ([0-9a-f]{40})$", normalized)
    demand(bool(branch and source), "unknown workflow: render approved HOME recipe")
    allowed = (
        render_workflow(branch.group(1), source.group(1)),
        render_workflow(branch.group(1), source.group(1), browser=True),
    )
    demand(normalized in allowed,
           "unknown YAML, job, trigger, checkout, browser, step order or WSL command: STOP")



def jdk_probes() -> None:
    # These two files do not call Node. Full source unittest discovery is always
    # Windows-only; this Linux JDK proof covers the two Windows-service SKIPs.
    tests = unittest.TestSuite()
    loader = unittest.TestLoader()
    for pattern in ("test_address_map_link.py", "test_bosch_ble.py"):
        tests.addTests(loader.discover(str(ROOT / "tests"), pattern=pattern))
    result = unittest.TextTestRunner(verbosity=2).run(tests)
    print("WSL_JDK_PROBES: run=%s failures=%s errors=%s skipped=%s" %
          (result.testsRun, len(result.failures), len(result.errors), len(result.skipped)),
          flush=True)
    demand(result.testsRun == 5 and not result.failures and not result.errors and not result.skipped,
           "WSL JDK probe incomplete (do not call SKIP a PASS)")


def run_wsl_checked(source: Path, expected_sha: str) -> None:
    """Only this fixed WSL script can be invoked by the canonical QA workflow.

    Generic Python discovery (which calls Node) has no WSL entrypoint here.
    Preflight runs before any Gradle/JUnit, no installation or APK tasks.
    """
    demand(platform.system() == "Windows", "WSL launcher must run on trusted Windows")
    linux = r"""
set -Eeuo pipefail
source_dir="$(wslpath -u "$1")"
expected="$2"
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export PATH="$JAVA_HOME/bin:$PATH" CI=1
mkdir -p /root/zamerovac-qa-commits
temp="$(mktemp -d /root/zamerovac-qa-commits/homeguard-XXXXXXXX)"
trap 'rc=$?; rm -rf "$temp"; exit "$rc"' EXIT
cp -a "$source_dir/." "$temp/"
cd "$temp"
echo "WSL_TESTED_SOURCE_SHA=$(git rev-parse HEAD)"
python3 tools/home_qa_gate.py wsl-native --expected-sha "$expected" --root . --gradle /opt/gradle-8.10.2/bin/gradle
python3 tools/home_qa_gate.py wsl-jdk-probes --expected-sha "$expected" --root . --gradle /opt/gradle-8.10.2/bin/gradle
set +e
python3 tools/home_qa_gate.py wsl-python-node > "$temp/denied.log" 2>&1
rejected=$?
set -e
test "$rejected" -eq 2
grep -q 'Node-dependent Python unittest is WINDOWS-only' "$temp/denied.log"
echo "PASS live WSL rejected unsupported Node dependent Python before Gradle"
"""
    try:
        result = subprocess.run(
            ["wsl.exe", "--distribution", "Zamerovac-Ubuntu-QA", "--user", "root",
             "--exec", "/bin/bash", "-lc", linux, "_", str(source), expected_sha],
            stdin=subprocess.DEVNULL, check=False, timeout=240,
        )
    except (OSError, subprocess.TimeoutExpired) as failure:
        raise GateError("HOME QA STOP: trusted WSL launcher could not start: " + str(failure)) from failure
    demand(result.returncode == 0, "native WSL preflight/JDK probes FAILED, exit=" + str(result.returncode))



def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Trusted HOME QA fail-fast Windows/WSL gate")
    modes = ap.add_subparsers(dest="mode", required=True)
    for mode in ("windows-quick", "wsl-native", "wsl-jdk-probes"):
        parser = modes.add_parser(mode)
        parser.add_argument("--expected-sha", required=True)
        parser.add_argument("--root", default=str(ROOT))
        if mode != "windows-quick":
            parser.add_argument("--gradle", default="/opt/gradle-8.10.2/bin/gradle")
        if mode == "windows-quick":
            parser.add_argument("--check-only", action="store_true")
    render = modes.add_parser("render-workflow")
    render.add_argument("--branch", required=True)
    render.add_argument("--expected-sha", required=True)
    render.add_argument("--browser", action="store_true",
                        help="single-job Windows Chromium QA, no APK or WSL")
    render.add_argument("--output", type=Path)
    wsl = modes.add_parser("wsl-check-from-windows")
    wsl.add_argument("--expected-sha", required=True)
    wsl.add_argument("--root", default=str(ROOT))
    lint = modes.add_parser("lint-workflow")
    lint.add_argument("path", type=Path)
    lint.add_argument("--strict", action="store_true")
    modes.add_parser("wsl-python-node")
    args = ap.parse_args(argv)
    try:
        if args.mode == "render-workflow":
            payload = render_workflow(args.branch, args.expected_sha,
                                      browser=args.browser).encode("utf-8")
            output_canonical_utf8(payload, args.output)
            return 0
        if args.mode == "wsl-check-from-windows":
            trusted_owner(os.environ)
            check_windows()
            root = Path(args.root).resolve()
            actual = git_source(root, args.expected_sha)
            print("TESTED_WINDOWS_SOURCE_SHA=" + actual, flush=True)
            run_wsl_checked(root, actual)
            return 0
        if args.mode == "lint-workflow":
            demand(args.path.is_file(), "workflow YAML does not exist: " + str(args.path))
            check_workflow(args.path.read_text(encoding="utf-8"), strict=args.strict)
            print("PASS HOME WORKFLOW LINT " + str(args.path))
            return 0
        if args.mode == "wsl-python-node":
            raise GateError("HOME QA STOP: Node-dependent Python unittest is WINDOWS-only; "
                            "run windows-quick, not a WSL Python discovery step")
        trusted_owner(os.environ)
        checkout = Path(args.root).resolve()
        if args.mode == "windows-quick":
            check_windows()
        else:
            check_wsl(Path(args.gradle))
        actual = git_source(checkout, args.expected_sha)
        print("HOME PREFLIGHT PASS mode=%s TESTED_SOURCE_SHA=%s" % (args.mode, actual), flush=True)
        if args.mode == "windows-quick" and not args.check_only:
            return subprocess.run(["node", "tools/local-qa.cjs", "--quick"],
                                  cwd=checkout, check=False).returncode
        if args.mode == "wsl-jdk-probes":
            jdk_probes()
        return 0
    except (GateError, OSError) as failure:
        print(str(failure), file=sys.stderr, flush=True)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
