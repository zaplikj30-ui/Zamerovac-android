#!/usr/bin/env python3
"""Fail-fast, cross-OS gate for trusted HOME QA (never builds or releases an APK).

Contract: Python tests that launch Node ALWAYS run on Windows. WSL2 is for
Gradle/Java and explicitly allowlisted pure-Python JDK probes, not generic
'unittest discover'. Run the gate before any expensive test command.
Only Python standard-library dependencies are used.
"""
from __future__ import annotations

import argparse
import hashlib
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
# Read-only fingerprint observed for headless Chromium on trusted HOME run #43189084331.
# Changing the approved binary requires owner verification and a new security review.
APPROVED_BROWSER_SHA256 = "ce4635cd0e5dc0e21494542a701f347e91c1f1d821970578d97ed8df4ced50ef"
# Single owner-controlled implementation exception approved in #42/6839410352.
# Never allow the entire implement/* family or another commit under this name.
SYNC116_BRANCH = "implement/sync-core-b-20261112"
SYNC116_SHA = "1527e3377609633c554195b0641e02e3cfb5fb5e"


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
# Legacy quick+WSL ONE_SHOT_RECIPE above stays byte-identical.
# Browser mode runs a PINNED validator and only owner-named source branches.
BROWSER_PREFLIGHT = r'''      - name: Check owner branch SHA and separate validator BEFORE running source code
        shell: cmd
        run: |
          cd /d "%GITHUB_WORKSPACE%\source"
          for /f %%H in ('git rev-parse HEAD') do set "ACTUAL_SOURCE=%%H"
          if not defined ACTUAL_SOURCE exit /b 1
          if /I not "%ACTUAL_SOURCE%"=="__SOURCE_SHA__" exit /b 1
          cd /d "%GITHUB_WORKSPACE%\gate"
          for /f %%H in ('git rev-parse HEAD') do set "ACTUAL_GATE=%%H"
          if not defined ACTUAL_GATE exit /b 1
          if /I not "%ACTUAL_GATE%"=="__GATE_SHA__" exit /b 1
          python tools\home_qa_gate.py lint-workflow "..\recipe\.github\workflows\home-qa-one-shot.yml" --strict
          if errorlevel 1 exit /b 1
          echo TRUSTED_OWNER_SOURCE_BRANCH=__SOURCE_BRANCH__ TESTED_SOURCE_SHA=%ACTUAL_SOURCE% GATE_SHA=%ACTUAL_GATE%
'''
BROWSER_STEPS = r'''      - name: Isolated offline package-lock Chromium prerequisites
        shell: cmd
        run: |
          if exist "%GITHUB_WORKSPACE%\qa-browser-deps" exit /b 1
          mkdir "%GITHUB_WORKSPACE%\qa-browser-deps"
          if errorlevel 1 exit /b 1
          copy /y "%GITHUB_WORKSPACE%\gate\tools\qa-browser\package.json" "%GITHUB_WORKSPACE%\qa-browser-deps\package.json" >nul
          if errorlevel 1 exit /b 1
          copy /y "%GITHUB_WORKSPACE%\gate\tools\qa-browser\package-lock.json" "%GITHUB_WORKSPACE%\qa-browser-deps\package-lock.json" >nul
          if errorlevel 1 exit /b 1
          cd /d "%GITHUB_WORKSPACE%\qa-browser-deps"
          set "PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1"
          call npm.cmd ci --offline --ignore-scripts --omit=optional --no-audit --no-fund
          if errorlevel 1 exit /b 1
          python "%GITHUB_WORKSPACE%\gate\tools\home_qa_gate.py" verify-browser --browser-root "C:\actions-runner\tools\ms-playwright" --expected-sha256 __BROWSER_SHA256__
          if errorlevel 1 exit /b 1
          echo NODE_PATH=%GITHUB_WORKSPACE%\qa-browser-deps\node_modules>>"%GITHUB_ENV%"
          echo PLAYWRIGHT_BROWSERS_PATH=C:\actions-runner\tools\ms-playwright>>"%GITHUB_ENV%"
          echo LOCALAPPDATA=%GITHUB_WORKSPACE%\qa-evidence>>"%GITHUB_ENV%"
      - name: Real Chromium and editor pixel QA with durable checkpoints
        shell: cmd
        run: |
          cd /d "%GITHUB_WORKSPACE%\source"
          python tools\home_qa_gate.py windows-quick --expected-sha __SOURCE_SHA__ --root . --check-only
          if errorlevel 1 exit /b 1
          set "ZAMEROVAC_SOURCE_ROOT=%GITHUB_WORKSPACE%\source"
          node "%GITHUB_WORKSPACE%\gate\tools\local-browser-qa.cjs" --self-test
          if errorlevel 1 exit /b 1
          node "%GITHUB_WORKSPACE%\gate\tools\local-browser-qa.cjs" --all
          if errorlevel 1 exit /b 1
'''

def browser_workflow_recipe() -> str:
    """Exact browser allowlist derived from unchanged quick template."""
    first = "      - name: All quick Windows Node and Python tests\n"
    last = "      - name: Upload synthetic quick results, never APK\n"
    guard = "      - name: Exact YAML preflight and adversarial negative tests before QA\n"
    demand(all(ONE_SHOT_RECIPE.count(x) == 1 for x in (first, last, guard)),
           "canonical recipe changed")
    recipe = ONE_SHOT_RECIPE.replace(
        "          ref: __SOURCE_SHA__\n          path: source",
        "          repository: zaplikj30-ui/Zamerovac-android\n"
        "          ref: __SOURCE_BRANCH__\n          path: source")
    fixed_gate = r'''      - name: Read-only trusted validator pinned to reviewed OWNER SHA
        uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4
        with:
          repository: zaplikj30-ui/Zamerovac-android
          ref: __GATE_BRANCH__
          path: gate
          fetch-depth: 1
          persist-credentials: false
          submodules: false
'''
    first_at = recipe.index(guard)
    last_at = recipe.index(first, first_at)
    recipe = recipe[:first_at] + fixed_gate + BROWSER_PREFLIGHT + recipe[last_at:]
    first_at = recipe.index(first)
    last_at = recipe.index(last, first_at)
    recipe = recipe[:first_at] + BROWSER_STEPS + recipe[last_at:]
    recipe = recipe.replace("      - name: Upload synthetic quick results, never APK",
                            "      - name: Upload checkpointed synthetic Chromium reports, no APK")
    recipe = recipe.replace("name: canonical-home-qa-__SOURCE_SHA__",
                            "name: canonical-home-browser-__SOURCE_SHA__")
    old_path = "          path: qa-evidence/Zamerovac-QA/results/"
    new_path = ("          path: |\n"
                "            qa-evidence/Zamerovac-QA/browser/**/results.json\n"
                "            qa-evidence/Zamerovac-QA/browser/**/*.log\n"
                "            qa-evidence/Zamerovac-QA/browser/**/evidence/**/report.json")
    demand(recipe.count(old_path) == 1, "unknown canonical artifact path")
    return recipe.replace(old_path, new_path).replace("retention-days: 7", "retention-days: 3")



# A separate serial WSL/JVM QA plan for PR #116. Never run this on the
# generic browser recipe and never reuse the production two-worker runner.
SYNC116_JVM_STEPS = r'''      - name: Offline WSL full JVM and ACK evidence; one Gradle worker, no APK
        shell: cmd
        run: |
          cd /d "%GITHUB_WORKSPACE%\gate"
          python tools\sync116_home_qa.py windows-wsl --source "%GITHUB_WORKSPACE%\source" --gate "%GITHUB_WORKSPACE%\gate" --expected-sha __SOURCE_SHA__ --output "%GITHUB_WORKSPACE%\qa-evidence\Zamerovac-QA\sync116"
          if errorlevel 1 exit /b 1
'''


def sync116_jvm_workflow_recipe() -> str:
    """A second exact YAML allowlist, never added to main HOME 4/4."""
    browser = browser_workflow_recipe()
    demand(browser.count(BROWSER_STEPS) == 1, "reviewed browser template changed")
    browser = browser.replace(BROWSER_STEPS, SYNC116_JVM_STEPS)
    browser = browser.replace("Upload checkpointed synthetic Chromium reports, no APK",
                              "Upload synthetic PR116 JVM result only; raw Gradle remains FAIL")
    browser = browser.replace("canonical-home-browser-", "canonical-home-sync116-jvm-")
    original_paths = ("          path: |\n"
                      "            qa-evidence/Zamerovac-QA/browser/**/results.json\n"
                      "            qa-evidence/Zamerovac-QA/browser/**/*.log\n"
                      "            qa-evidence/Zamerovac-QA/browser/**/evidence/**/report.json")
    demand(browser.count(original_paths) == 1, "reviewed browser paths changed")
    return browser.replace(original_paths,
                           "          path: qa-evidence/Zamerovac-QA/sync116/results.json")

def safe_owner_branch(branch: str) -> bool:
    """Reject PR refs, shell characters and ambiguous Git revision syntax."""
    return (bool(re.fullmatch(r"(?:fix|infra|feature|test|chore|docs|codex|bugfix|p1)/[a-z][a-z0-9._/-]{2,75}", branch))
            and not any(x in branch for x in ("..", "//", "/.", ".lock", "@{"))
            and not branch.endswith(("/", ".")))


def browser_candidates(root: Path) -> list[Path]:
    allowed = {"chrome.exe", "headless_shell.exe", "chrome-headless-shell.exe"}
    if not root.is_dir() or root.is_symlink():
        return []
    found = []
    for candidate in root.glob("chromium*/**/*.exe"):
        if candidate.name.lower() not in allowed or candidate.is_symlink():
            continue
        if not candidate.resolve().is_relative_to(root.resolve()):
            continue
        if any(part.is_symlink() for part in candidate.parents if part != root.parent):
            continue
        found.append(candidate)
    return sorted(found)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def verify_browser(root: Path, expected: str, environ: dict[str, str] | None = None) -> Path:
    """Only preinstalled read-only browser with explicit owner-approved SHA256."""
    env = os.environ if environ is None else environ
    demand(bool(re.fullmatch(r"[0-9a-f]{64}", expected)), "pin literal browser SHA256")
    demand(expected == APPROVED_BROWSER_SHA256, "unapproved Chromium binary SHA256")
    if platform.system() == "Windows":
        demand(root.resolve() == Path(r"C:\actions-runner\tools\ms-playwright").resolve(),
               "untrusted browser install directory")
    hits = [p for p in browser_candidates(root) if sha256_file(p) == expected]
    demand(len(hits) == 1, "missing/ambiguous/wrong-hash Chromium binary; STOP")
    if env.get("GITHUB_ACTIONS") == "true":
        target = env.get("GITHUB_ENV", "")
        demand(bool(target), "GITHUB_ENV missing")
        with Path(target).open("a", encoding="utf-8") as stream:
            stream.write("CHROMIUM_PATH=" + str(hits[0].resolve()) + "\n")
    return hits[0]


def report_browser_fingerprints() -> None:
    """Read-only SHA256 inventory; printing a hash never means it was approved."""
    if platform.system() != "Windows":
        return
    for candidate in browser_candidates(Path(r"C:\actions-runner\tools\ms-playwright")):
        print("BROWSER_CANDIDATE_SHA256=" + sha256_file(candidate) +
              " PATH=" + str(candidate), flush=True)


def render_workflow(branch: str, source_sha: str, browser: bool = False,
                    source_branch: str | None = None, validator_sha: str | None = None,
                    validator_branch: str | None = None,
                    browser_sha256: str | None = None, sync_jvm: bool = False) -> str:
    demand(bool(re.fullmatch(r"qa/[a-z][a-z0-9._-]{3,65}", branch)),
           "only a literal trusted qa/* branch is allowed")
    demand(bool(SHA.fullmatch(source_sha)), "exact 40-character source SHA required")
    demand(not (browser and sync_jvm), "choose browser OR sync JVM, never both")
    if browser or sync_jvm:
        demand(bool(source_branch and (safe_owner_branch(source_branch) or
                        (source_branch == SYNC116_BRANCH and source_sha == SYNC116_SHA))),
               "browser requires a literal approved owner branch/SHA pair, never PR/fork")
        demand(bool(validator_sha and SHA.fullmatch(validator_sha)),
               "browser requires an independently reviewed gate SHA")
        demand(bool(validator_branch and (validator_branch == "main" or
                        safe_owner_branch(validator_branch))),
               "validator must be an owner branch, never PR/fork ref")
        if browser:
            demand(bool(browser_sha256 and re.fullmatch(r"[0-9a-f]{64}", browser_sha256)),
                   "browser requires SHA256 of preverified Chromium")
            demand(browser_sha256 == APPROVED_BROWSER_SHA256,
                   "browser SHA256 must match separately approved immutable fingerprint")
        else:
            demand(source_branch == SYNC116_BRANCH and source_sha == SYNC116_SHA,
                   "JVM gate is bound only to the exact approved PR116 owner branch/SHA")
            demand(browser_sha256 is None, "JVM mode may not take browser settings")
    else:
        demand(source_branch is None and validator_sha is None and validator_branch is None
               and browser_sha256 is None,
               "quick may not silently receive browser-only arguments")
    template = (sync116_jvm_workflow_recipe() if sync_jvm else
                browser_workflow_recipe() if browser else ONE_SHOT_RECIPE)
    return (template.replace("__QA_BRANCH__", branch)
            .replace("__SOURCE_SHA__", source_sha)
            .replace("__SOURCE_BRANCH__", source_branch or "")
            .replace("__GATE_SHA__", validator_sha or "")
            .replace("__GATE_BRANCH__", validator_branch or "")
            .replace("__BROWSER_SHA256__", browser_sha256 or "").lstrip("\n"))



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
    """Exact allowlist: no injected steps, jobs, triggers, or unreviewed scripts."""
    demand(strict, "permissive YAML scan is forbidden")
    normalized = content.replace("\r\n", "\n")
    branch = re.search(r"(?m)^    branches: \[(qa/[a-z][a-z0-9._-]{3,65})\]$", normalized)
    demand(bool(branch), "unknown owner-only QA branch")
    if "          path: gate\n" in normalized:
        source = re.search(r"(?m)^      TESTED_SHA: '([0-9a-f]{40})'$", normalized)
        source_branch = re.search(r"(?m)^          ref: ([a-z0-9_./-]+)\n          path: source$", normalized)
        validator = re.search(r'(?m)^          if /I not "%ACTUAL_GATE%"=="([0-9a-f]{40})" exit /b 1$', normalized)
        validator_branch = re.search(r"(?m)^          ref: ([a-z0-9_./-]+)\n          path: gate$", normalized)
        is_jvm = "      - name: Offline WSL full JVM and ACK evidence; one Gradle worker, no APK\n" in normalized
        binary = re.search(r"(?m)verify-browser --browser-root [^\n]* --expected-sha256 ([0-9a-f]{64})$", normalized)
        demand(bool(source and source_branch and validator and validator_branch and
                    (is_jvm or binary)), "missing source provenance/validator/binary pin")
        allowed = render_workflow(branch.group(1), source.group(1),
                                  browser=not is_jvm, sync_jvm=is_jvm,
                                  source_branch=source_branch.group(1),
                                  validator_sha=validator.group(1),
                                  validator_branch=validator_branch.group(1),
                                  browser_sha256=binary.group(1) if binary else None)
    else:
        source = re.search(r"(?m)^          ref: ([0-9a-f]{40})$", normalized)
        demand(bool(source), "quick source SHA missing")
        allowed = render_workflow(branch.group(1), source.group(1))
    demand(normalized == allowed, "unknown YAML, PR/cloud job, checkout, steps or browser commands: STOP")


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
    render.add_argument("--sync-jvm", action="store_true",
                        help="serial WSL full JVM/ACK for pinned PR116 only; no APK")
    render.add_argument("--source-branch")
    render.add_argument("--validator-sha")
    render.add_argument("--validator-branch")
    render.add_argument("--browser-sha256")
    render.add_argument("--output", type=Path)
    wsl = modes.add_parser("wsl-check-from-windows")
    wsl.add_argument("--expected-sha", required=True)
    wsl.add_argument("--root", default=str(ROOT))
    lint = modes.add_parser("lint-workflow")
    lint.add_argument("path", type=Path)
    lint.add_argument("--strict", action="store_true")
    browser_check = modes.add_parser("verify-browser")
    browser_check.add_argument("--browser-root", required=True, type=Path)
    browser_check.add_argument("--expected-sha256", required=True)
    modes.add_parser("wsl-python-node")
    args = ap.parse_args(argv)
    try:
        if args.mode == "render-workflow":
            payload = render_workflow(args.branch, args.expected_sha,
                                      browser=args.browser, source_branch=args.source_branch,
                                      validator_sha=args.validator_sha,
                                      validator_branch=args.validator_branch,
                                      browser_sha256=args.browser_sha256,
                                      sync_jvm=args.sync_jvm).encode("utf-8")
            output_canonical_utf8(payload, args.output)
            return 0
        if args.mode == "verify-browser":
            trusted_owner(os.environ)
            selected = verify_browser(args.browser_root, args.expected_sha256)
            print("PASS CHROMIUM_SHA256=" + args.expected_sha256 +
                  " FILE=" + str(selected), flush=True)
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
            report_browser_fingerprints()
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
