"""Fast positive/negative tests of HOME QA preflight; no Android, cloud or APK."""
from __future__ import annotations

import importlib.util
from pathlib import Path
import tempfile
import unittest
import io
import os
import subprocess
import sys
from unittest import mock


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("home_qa_gate", ROOT / "tools/home_qa_gate.py")
GATE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(GATE)
SHA = "5411eb04e174c54c6c649084872f31f0d1b421a0"
CHECKOUT = "11d5960a326750d5838078e36cf38b85af677262"


def valid_workflow():
    return GATE.render_workflow("qa/example", SHA)

def browser_workflow():
    return GATE.render_workflow("qa/example", SHA, browser=True,
                                source_branch="fix/approved-owner-branch",
                                validator_sha="b" * 40, validator_branch="infra/approved-gate", browser_sha256=GATE.APPROVED_BROWSER_SHA256)


class GateUnitTest(unittest.TestCase):
    def test_source_sha_exact_accept(self):
        GATE.confirm_sha(SHA, SHA)

    def test_wrong_or_nonliteral_source_rejected(self):
        for target in ("main", "0" * 40, SHA[:30], "a" * 39 + "g"):
            with self.subTest(target=target), self.assertRaises(GATE.GateError):
                GATE.confirm_sha(SHA, target)

    def test_windows_python_and_node_positive(self):
        paths = {"node": "C:/tools/node.exe", "python": "C:/tools/python.exe"}
        GATE.check_windows(system="Windows", resolve=paths.get)

    def test_windows_node_missing_is_fail_fast(self):
        with self.assertRaisesRegex(GATE.GateError, "node.*missing"):
            GATE.check_windows(system="Windows", resolve={"python": "C:/python.exe"}.get)

    def test_windows_python_missing_is_fail_fast(self):
        with self.assertRaisesRegex(GATE.GateError, "Windows Python"):
            GATE.check_windows(system="Windows", resolve={"node": "C:/node.exe"}.get)

    def test_wsl_must_not_run_windows_python_node(self):
        with self.assertRaisesRegex(GATE.GateError, "WINDOWS"):
            GATE.check_windows(system="Linux", resolve={"node": "/usr/bin/node", "python": "/usr/bin/python"}.get)
        self.assertEqual(2, GATE.main(["wsl-python-node"]))

    def test_wsl_native_valid_even_without_node(self):
        with tempfile.TemporaryDirectory() as t:
            home = Path(t) / "jdk"
            (home / "bin").mkdir(parents=True)
            for name in ("java", "javac"):
                exe = home / "bin" / name
                exe.write_text("#!/bin/sh\nexit 0\n", encoding="utf-8")
                exe.chmod(0o755)
            gradle = Path(t) / "gradle"
            gradle.write_text("#!/bin/sh\nexit 0\n", encoding="utf-8")
            gradle.chmod(0o755)
            env = {"JAVA_HOME": str(home), "WSL_DISTRO_NAME": "Zamerovac-Ubuntu-QA"}
            tools = {"git": "/usr/bin/git", "python3": "/usr/bin/python3"}
            with mock.patch.object(GATE, "read_version", side_effect=[
                'openjdk version "17.0.17"', 'javac 17.0.17', 'Gradle 8.10.2',
            ]):
                GATE.check_wsl(gradle, tools.get, "Linux", env, "microsoft-standard-WSL2")

    def test_wsl_native_missing_java_rejected_before_junit(self):
        with tempfile.TemporaryDirectory() as t:
            gradle = Path(t) / "gradle"
            gradle.write_text("", encoding="utf-8")
            env = {"JAVA_HOME": str(Path(t) / "missing-jdk"), "WSL_DISTRO_NAME": "Ubuntu"}
            with self.assertRaisesRegex(GATE.GateError, "JAVA_HOME"):
                GATE.check_wsl(gradle, {"git": "git", "python3": "python3"}.get,
                               "Linux", env, "microsoft-WSL2")

    def test_wsl_on_plain_linux_is_rejected(self):
        with self.assertRaisesRegex(GATE.GateError, "trusted WSL2"):
            GATE.check_wsl(Path("/does/not/matter"), lambda v: "/bin/" + v,
                           "Linux", {}, "regular-Linux")

    def test_owner_controlled_ci_positive(self):
        e = {
            "GITHUB_ACTIONS": "true", "GITHUB_REPOSITORY": "zaplikj30-ui/Zamerovac-android",
            "GITHUB_ACTOR": "zaplikj30-ui", "GITHUB_TRIGGERING_ACTOR": "zaplikj30-ui",
            "GITHUB_RUN_ATTEMPT": "1", "GITHUB_RUN_ID": "43195207268",
            "GITHUB_EVENT_NAME": "push",
            "GITHUB_REF": "refs/heads/qa/preflight", "RUNNER_ENVIRONMENT": "self-hosted",
        }
        GATE.trusted_owner(e)
        for patch in ({"GITHUB_REPOSITORY": "fork/Zamerovac-android"},
                      {"GITHUB_EVENT_NAME": "pull_request"},
                      {"RUNNER_ENVIRONMENT": "github-hosted"},
                      {"GITHUB_REF": "refs/pull/7/merge"},
                      {"GITHUB_ACTOR": "other"},
                      {"GITHUB_TRIGGERING_ACTOR": "other"},
                      {"GITHUB_TRIGGERING_ACTOR": ""},
                      {"GITHUB_RUN_ATTEMPT": "2"},
                      {"GITHUB_RUN_ATTEMPT": ""},
                      {"GITHUB_RUN_ID": ""},
                      {"GITHUB_RUN_ID": "fake"},
                      {"GITHUB_HEAD_REF": "evil"}):
            with self.subTest(patch=patch), self.assertRaises(GATE.GateError):
                GATE.trusted_owner({**e, **patch})
        for absent in ("GITHUB_TRIGGERING_ACTOR", "GITHUB_RUN_ATTEMPT", "GITHUB_RUN_ID"):
            with self.subTest(missing=absent), self.assertRaises(GATE.GateError):
                broken = dict(e)
                broken.pop(absent)
                GATE.trusted_owner(broken)

    def test_rerun_trigger_actor_and_attempt_protected_in_every_recipe(self):
        browser = browser_workflow()
        jvm = GATE.render_workflow(
            "qa/example", GATE.SYNC116_SHA, sync_jvm=True,
            source_branch=GATE.SYNC116_BRANCH, validator_sha="b"*40,
            validator_branch="infra/approved-gate")
        for good in (browser, jvm):
            GATE.check_workflow(good, strict=True)
            self.assertIn("github.triggering_actor == 'zaplikj30-ui'", good)
            self.assertIn("github.run_attempt == 1", good)
            self.assertIn("if-no-files-found: error", good)
            self.assertIn("steps.source_gate.outcome == 'success'", good)
            self.assertIn("steps.evidence_checked.outcome == 'success'", good)
            self.assertIn("sync116_evidence.py inspect", good)
            self.assertIn("runs/${{ github.run_id }}-${{ github.run_attempt }}", good)
            self.assertNotIn("browser/**/results.json", good)
            self.assertNotIn("if-no-files-found: ignore", good)
            for old, new in (
                ("github.triggering_actor == 'zaplikj30-ui'", "github.triggering_actor == 'other'"),
                ("github.triggering_actor == 'zaplikj30-ui'", "true"),
                ("github.run_attempt == 1", "github.run_attempt >= 1"),
                ("github.run_attempt == 1", "true"),
                ("if-no-files-found: error", "if-no-files-found: ignore"),
                ("steps.source_gate.outcome == 'success'", "true"),
                ("steps.evidence_checked.outcome == 'success'", "true"),
                ("sync116_evidence.py inspect", "echo stale evidence accepted"),
                ("runs/${{ github.run_id }}-${{ github.run_attempt }}", "runs/last-success"),
            ):
                with self.subTest(old=old, new=new), self.assertRaises(GATE.GateError):
                    GATE.check_workflow(good.replace(old, new), strict=True)

    def test_canonical_browser_workflow_is_exact_and_windows_only(self):
        browser = browser_workflow()
        GATE.check_workflow(browser, strict=True)
        self.assertIn("[self-hosted, Windows, X64, zamerovac-qa]", browser)
        self.assertIn("node \"%GITHUB_WORKSPACE%\\gate\\tools\\local-browser-qa.cjs\" --all", browser)
        self.assertIn("npm.cmd ci --offline --ignore-scripts", browser)
        self.assertNotIn("npm.cmd install --no-save", browser)
        self.assertNotIn("playwright install chromium", browser)
        self.assertIn("ref: fix/approved-owner-branch", browser)
        self.assertIn("ref: infra/approved-gate", browser)
        self.assertIn('set "ZAMEROVAC_SOURCE_ROOT=%GITHUB_WORKSPACE%\\source"', browser)
        self.assertIn('node "%GITHUB_WORKSPACE%\\gate\\tools\\local-browser-qa.cjs" --self-test', browser)
        self.assertNotIn('node tools\\local-browser-qa.cjs --all', browser)
        self.assertIn("expected-sha256 " + GATE.APPROVED_BROWSER_SHA256, browser)
        self.assertIn("python tools\\home_qa_gate.py windows-quick --expected-sha " + SHA +
                      " --root . --check-only", browser)
        self.assertIn("python tools\\home_qa_gate.py lint-workflow", browser)
        self.assertLess(browser.index("ACTUAL_SOURCE"), browser.index("python tools\\home_qa_gate.py lint-workflow"))
        self.assertLess(browser.index("python tools\\home_qa_gate.py lint-workflow"), browser.index("npm.cmd ci --offline"))
        self.assertIn("python -m unittest discover -s tests -p test_home_qa_gate.py", browser)
        self.assertNotIn("wsl.exe --exec python3 -m unittest discover", browser)
        self.assertNotIn("wsl-check-from-windows", browser)
        self.assertNotIn("assembleDebug", browser)
        self.assertNotIn("pull_request:", browser)
        self.assertNotIn("ubuntu-latest", browser)
        self.assertNotEqual(browser, valid_workflow(),
                            "Browser mode must not weaken the existing quick recipe")

    def test_canonical_browser_tampering_fails_closed(self):
        good = browser_workflow()
        substitutions = (
            ("github.actor == 'zaplikj30-ui'", "github.actor == 'other'"),
            ("[self-hosted, Windows, X64, zamerovac-qa]", "ubuntu-latest"),
            ("persist-credentials: false", "persist-credentials: true"),
            ("npm.cmd ci --offline", "npm.cmd install playwright@latest"),
            ("python tools\\home_qa_gate.py windows-quick --expected-sha",
             "echo missing_SHA_check"),
            ("node \"%GITHUB_WORKSPACE%\\gate\\tools\\local-browser-qa.cjs\" --all", "echo browser skipped"),
            ("python tools\\home_qa_gate.py lint-workflow", "echo lint skipped"),
            ("ref: fix/approved-owner-branch", "ref: refs/pull/3/merge"),
            ("ref: infra/approved-gate", "ref: refs/pull/7/merge"),
            ("ACTUAL_GATE%\"==\"" + "b" * 40, "ACTUAL_GATE%\"==\"main"),
            ("expected-sha256 " + GATE.APPROVED_BROWSER_SHA256, "expected-sha256 " + "d" * 64),
            ("branches: [qa/example]", "branches: [main]"),
            ("TESTED_SHA: '" + SHA + "'", "TESTED_SHA: '" + ("f" * 40) + "'"),
        )
        for original, modified in substitutions:
            with self.subTest(modified=modified):
                self.assertIn(original, good)
                with self.assertRaises(GATE.GateError):
                    GATE.check_workflow(good.replace(original, modified), strict=True)
        with self.assertRaises(GATE.GateError):
            GATE.check_workflow(good + "\n  unguarded:\n    runs-on: ubuntu-latest\n", strict=True)

    def test_canonical_browser_cli_utf8_and_no_overwrite(self):
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp) / ".github" / "workflows"
            folder.mkdir(parents=True)
            output = folder / "home-qa-one-shot.yml"
            self.assertEqual(0, GATE.main([
                "render-workflow", "--browser", "--branch", "qa/example",
                "--expected-sha", SHA,
                "--source-branch", "fix/approved-owner-branch",
                "--validator-sha", "b" * 40,
                "--validator-branch", "infra/approved-gate", "--browser-sha256", GATE.APPROVED_BROWSER_SHA256,
                "--output", str(output),
            ]))
            raw = output.read_bytes()
            expected = browser_workflow().encode("utf-8")
            self.assertEqual(expected, raw)
            self.assertEqual(0, GATE.main(["lint-workflow", str(output), "--strict"]))
            self.assertEqual(2, GATE.main([
                "render-workflow", "--browser", "--branch", "qa/example",
                "--expected-sha", SHA,
                "--source-branch", "fix/approved-owner-branch",
                "--validator-sha", "b" * 40,
                "--validator-branch", "infra/approved-gate", "--browser-sha256", GATE.APPROVED_BROWSER_SHA256,
                "--output", str(output),
            ]), "Must not overwrite existing trusted YAML")
            self.assertEqual(expected, output.read_bytes())

    def test_browser_bad_trust_arguments_stop_before_execution(self):
        for name in ("refs/pull/3/merge", "fix/../../evil", "qa/demo &&whoami",
                     "origin/fork@{1}", "fork:bad", "", "fix/.hidden", "fix/foo.lock"):
            with self.subTest(name=name), self.assertRaises(GATE.GateError):
                GATE.render_workflow("qa/example", SHA, browser=True,
                                     source_branch=name, validator_sha="b" * 40, validator_branch="infra/approved-gate",
                                     browser_sha256=GATE.APPROVED_BROWSER_SHA256)
        with self.assertRaises(GATE.GateError):
            GATE.render_workflow("qa/example", SHA, browser=True)
        with self.assertRaises(GATE.GateError):
            GATE.render_workflow("qa/example", SHA, browser=True,
                                 source_branch="fix/approved-owner-branch",
                                 validator_branch="refs/pull/7/merge",
                                 validator_sha="b" * 40,
                                 browser_sha256=GATE.APPROVED_BROWSER_SHA256)
        for values in ({"validator_sha": "main"}, {"browser_sha256": "0" * 40}):
            with self.subTest(values=values), self.assertRaises(GATE.GateError):
                GATE.render_workflow("qa/example", SHA, browser=True,
                                     **{**{"source_branch": "fix/approved-owner-branch",
                                          "validator_sha": "b" * 40,
                                          "validator_branch": "infra/approved-gate", "browser_sha256": GATE.APPROVED_BROWSER_SHA256},
                                        **values})

    def test_sync116_exact_owner_branch_and_commit_only(self):
        approved = "1527e3377609633c554195b0641e02e3cfb5fb5e"
        branch = "implement/sync-core-b-20261112"
        args = dict(browser=True, source_branch=branch, validator_sha="b" * 40,
                    validator_branch="infra/approved-gate",
                    browser_sha256=GATE.APPROVED_BROWSER_SHA256)
        rendered = GATE.render_workflow("qa/example", approved, **args)
        GATE.check_workflow(rendered, strict=True)
        self.assertIn("ref: " + branch, rendered)
        self.assertIn("TESTED_SHA: '" + approved + "'", rendered)
        self.assertFalse(GATE.safe_owner_branch(branch),
                         "implement/* must not become a generic allowed family")
        for name, sha in ((branch, "a" * 40),
                          ("implement/sync-core-b-20261113", approved),
                          ("implement/other", approved),
                          ("implement/sync-core-b-20261112/evil", approved),
                          ("refs/pull/116/merge", approved),
                          ("fork/implement/sync-core-b-20261112", approved)):
            with self.subTest(name=name, sha=sha), self.assertRaises(GATE.GateError):
                GATE.render_workflow("qa/example", sha, **{**args, "source_branch": name})
        with self.assertRaises(GATE.GateError):
            GATE.check_workflow(rendered.replace(approved, "a" * 40), strict=True)

    def test_browser_workspace_is_unique_per_run_and_strict(self):
        rendered = browser_workflow()
        scoped = r"qa-browser-deps-%GITHUB_RUN_ID%-%GITHUB_RUN_ATTEMPT%"
        self.assertEqual(6, rendered.count(scoped))
        self.assertNotIn(r'qa-browser-deps"', rendered)
        self.assertNotIn("rmdir /s", rendered.lower())
        GATE.check_workflow(rendered, strict=True)
        with self.assertRaises(GATE.GateError):
            GATE.check_workflow(rendered.replace(scoped, "qa-browser-deps"),
                                strict=True)

    def test_sync116_jvm_recipe_strict_pinned_one_worker_and_no_browser(self):
        approved = GATE.SYNC116_SHA
        args = dict(sync_jvm=True, source_branch=GATE.SYNC116_BRANCH,
                    validator_sha="b" * 40, validator_branch="infra/approved-gate")
        yaml = GATE.render_workflow("qa/example", approved, **args)
        GATE.check_workflow(yaml, strict=True)
        self.assertIn("tools\\sync116_home_qa.py", yaml)
        self.assertIn("one Gradle worker", yaml)
        self.assertNotIn("npm.cmd ci", yaml)
        self.assertNotIn("playwright install", yaml)
        self.assertNotIn("assemblePreview", yaml)
        self.assertNotIn("pull_request:", yaml)
        self.assertNotIn("ubuntu-latest", yaml)
        self.assertIn("if /I not \"%ACTUAL_SOURCE%\"==\"" + approved + "\" exit /b 1", yaml)
        for broken in (yaml.replace("one Gradle worker", "two Gradle workers"),
                       yaml.replace("self-hosted, Windows", "ubuntu-latest"),
                       yaml.replace("if errorlevel 1 exit /b 1", "echo bypass", 1),
                       yaml.replace("python tools\\home_qa_gate.py lint-workflow",
                                    "echo lint bypass"),
                       yaml.replace("persist-credentials: false", "persist-credentials: true"),
                       yaml.replace("branches: [qa/example]", "branches: [main]"),
                       yaml + "\n  unguarded:\n    runs-on: ubuntu-latest\n"):
            with self.subTest(fragment=broken[-75:]), self.assertRaises(GATE.GateError):
                GATE.check_workflow(broken, strict=True)
        for name, sha in ((GATE.SYNC116_BRANCH, "a" * 40),
                          ("implement/other", approved),
                          ("refs/pull/116/merge", approved)):
            with self.subTest(name=name, sha=sha), self.assertRaises(GATE.GateError):
                GATE.render_workflow("qa/example", sha,
                                     **{**args, "source_branch": name})
        with self.assertRaises(GATE.GateError):
            GATE.render_workflow("qa/example", approved, browser=True, **args)
        with self.assertRaises(GATE.GateError):
            GATE.render_workflow("qa/example", approved,
                                 **{**args, "browser_sha256": "0" * 64})

    def test_sync116_jvm_cli_utf8_and_no_overwrite(self):
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp) / ".github" / "workflows"
            folder.mkdir(parents=True)
            dest = folder / "home-qa-one-shot.yml"
            args = ["render-workflow", "--sync-jvm", "--branch", "qa/example",
                    "--expected-sha", GATE.SYNC116_SHA,
                    "--source-branch", GATE.SYNC116_BRANCH,
                    "--validator-sha", "b" * 40,
                    "--validator-branch", "infra/approved-gate",
                    "--output", str(dest)]
            self.assertEqual(0, GATE.main(args))
            payload = dest.read_bytes()
            self.assertEqual(GATE.render_workflow(
                "qa/example", GATE.SYNC116_SHA, sync_jvm=True,
                source_branch=GATE.SYNC116_BRANCH, validator_sha="b"*40,
                validator_branch="infra/approved-gate").encode("utf-8"), payload)
            self.assertEqual(0, GATE.main(["lint-workflow", str(dest), "--strict"]))
            self.assertEqual(2, GATE.main(args))
            self.assertEqual(payload, dest.read_bytes())

    def test_browser_binary_hash_is_fail_closed_and_read_only(self):
        import hashlib
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp) / "ms-playwright"
            binary = folder / "chromium-123" / "chrome-win" / "chrome.exe"
            binary.parent.mkdir(parents=True)
            binary.write_bytes(b"known-synthetic-executable")
            fingerprint = hashlib.sha256(binary.read_bytes()).hexdigest()
            with mock.patch.object(GATE.platform, "system", return_value="Linux"):
                with mock.patch.object(GATE, "APPROVED_BROWSER_SHA256", fingerprint):
                    self.assertEqual(binary, GATE.verify_browser(folder, fingerprint, {}))
                    with self.assertRaisesRegex(GATE.GateError, "unapproved Chromium"):
                        GATE.verify_browser(folder, "0" * 64, {})
                    binary.write_bytes(b"tampered-synthetic-executable")
                    with self.assertRaisesRegex(GATE.GateError, "wrong-hash"):
                        GATE.verify_browser(folder, fingerprint, {})
            self.assertEqual(binary.read_bytes(), b"tampered-synthetic-executable")

    def test_browser_first_execution_preceded_by_owner_sha_gate(self):
        browser = browser_workflow()
        self.assertIn("repository: zaplikj30-ui/Zamerovac-android", browser)
        self.assertIn('if /I not "%ACTUAL_SOURCE%"=="' + SHA + '" exit /b 1', browser)
        self.assertIn('if /I not "%ACTUAL_GATE%"=="' + "b" * 40 + '" exit /b 1', browser)
        self.assertLess(browser.index("ACTUAL_SOURCE"), browser.index("python tools\\home_qa_gate.py lint-workflow"))
        self.assertLess(browser.index("python tools\\home_qa_gate.py lint-workflow"), browser.index("npm.cmd ci --offline"))
        self.assertIn("python -m unittest discover -s tests -p test_home_qa_gate.py", browser)
        self.assertNotIn("wsl.exe --exec python3 -m unittest discover", browser)
        self.assertNotIn("npx.cmd --no-install playwright install", browser)

    def test_workflow_valid_windows_wsl_split(self):
        GATE.check_workflow(valid_workflow(), strict=True)

    def test_workflow_rejects_missing_wsl_node_before_gradle(self):
        good = valid_workflow()
        bad = good.replace(
            "python tools\\home_qa_gate.py wsl-check-from-windows",
            "wsl.exe --exec python3 -m unittest discover -s tests\n"
            "          python tools\\home_qa_gate.py wsl-check-from-windows",
        )
        self.assertNotEqual(bad, good)
        with self.assertRaises(GATE.GateError):
            GATE.check_workflow(bad, strict=True)

    def test_workflow_rejects_wsl_direct_unittest(self):
        good = valid_workflow()
        bad = good.replace(
            "python tools\\home_qa_gate.py wsl-check-from-windows",
            'wsl.exe --exec bash -lc "python3 -m unittest discover -s tests"\n'
            "          python tools\\home_qa_gate.py wsl-check-from-windows",
        )
        self.assertNotEqual(bad, good)
        with self.assertRaises(GATE.GateError):
            GATE.check_workflow(bad, strict=True)

    def test_workflow_rejects_unpinned_actions_cloud_and_credentials(self):
        for old, new in (
            ("actions/checkout@" + CHECKOUT, "actions/checkout@v4"),
            ("[self-hosted, Windows, X64, zamerovac-qa]", "ubuntu-latest"),
            ("persist-credentials: false", "persist-credentials: true"),
            ("github.actor == 'zaplikj30-ui'", "github.actor == 'someone'"),
            ("on:\n  push:", "on:\n  pull_request:\n  push:"),
        ):
            with self.subTest(change=new), self.assertRaises(GATE.GateError):
                GATE.check_workflow(valid_workflow().replace(old, new), strict=True)

    def test_strict_rejects_missing_preflight_before_junit(self):
        good = valid_workflow()
        bad = good.replace(
            "python tools\\home_qa_gate.py lint-workflow",
            "echo skipped_required_preflight",
        )
        self.assertNotEqual(bad, good)
        with self.assertRaises(GATE.GateError):
            GATE.check_workflow(bad, strict=True)

    def test_strict_rejects_untrusted_checkout_ref(self):
        for replacement in ("main", "refs/heads/qa/old", "0" * 40):
            with self.subTest(replacement=replacement), self.assertRaises(GATE.GateError):
                GATE.check_workflow(valid_workflow().replace("ref: " + SHA, "ref: " + replacement), strict=True)

    def test_strict_rejects_disagreement_of_source_and_expected(self):
        bad = valid_workflow().replace("--expected-sha " + SHA, "--expected-sha " + ("f" * 40))
        with self.assertRaisesRegex(GATE.GateError, "unknown YAML"):
            GATE.check_workflow(bad, strict=True)

    # Chat32 adversarial RED reproductions: these are VALID YAML changes and
    # must be REJECTED by strict, not merely discovered in comments.
    def test_adversarial_extra_cloud_job_must_fail_closed(self):
        bad = valid_workflow() + """
  unguarded_cloud:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v4
        with:
          persist-credentials: true
      - run: echo paid cloud started
"""
        with self.assertRaises(GATE.GateError):
            GATE.check_workflow(bad, strict=True)

    def test_adversarial_inline_pr_trigger_and_unguarded_job_rejected(self):
        bad = valid_workflow().replace(
            "on:\n  push:\n    branches: [qa/example]",
            "on: [push, pull_request]",
        ) + """
  unguarded:
    runs-on: [self-hosted, Windows, X64, zamerovac-qa]
    steps:
      - run: echo PR untrusted
"""
        with self.assertRaises(GATE.GateError):
            GATE.check_workflow(bad, strict=True)

    def test_adversarial_powershell_wsl_python_alias_rejected(self):
        bad = valid_workflow() + '''
      - name: hidden WSL through pwsh variable
        shell: pwsh
        run: |
          $cmd = "python3 -m unittest discover -s tests"
          wsl.exe --exec bash -lc $cmd
'''
        with self.assertRaises(GATE.GateError):
            GATE.check_workflow(bad, strict=True)

    def test_adversarial_python_script_triplequote_wsl_discovery_rejected(self):
        bad = valid_workflow() + '''
      - name: Python WSL shell proxy
        shell: python
        run: |
          script = r"""python3 -m unittest discover -s tests"""
          subprocess.run(["wsl.exe", "--exec", "bash", "-lc", script])
'''
        with self.assertRaises(GATE.GateError):
            GATE.check_workflow(bad, strict=True)

    def test_adversarial_comment_only_preflight_before_gradle_rejected(self):
        good = valid_workflow()
        bad = good.replace(
            "python tools\\home_qa_gate.py lint-workflow",
            "echo skipped_lint # lint-workflow wsl-native",
        ).replace(
            "python tools\\home_qa_gate.py wsl-check-from-windows",
            "echo :app:testPreviewUnitTest BEFORE checks\n"
            "          python tools\\home_qa_gate.py wsl-check-from-windows",
        )
        self.assertNotEqual(bad, good)
        with self.assertRaises(GATE.GateError):
            GATE.check_workflow(bad, strict=True)

    def test_adversarial_fake_jdk_and_gradle_files_are_not_valid_versions(self):
        with tempfile.TemporaryDirectory() as temp:
            home = Path(temp) / "fake-jdk"
            (home / "bin").mkdir(parents=True)
            for tool in ("java", "javac"):
                (home / "bin" / tool).write_text("not an executable JDK", encoding="utf-8")
            gradle = Path(temp) / "gradle"
            gradle.write_text("fake gradle", encoding="utf-8")
            with self.assertRaises(GATE.GateError):
                GATE.check_wsl(
                    gradle,
                    {"git": "/usr/bin/git", "python3": "/usr/bin/python3"}.get,
                    "Linux",
                    {"JAVA_HOME": str(home), "WSL_DISTRO_NAME": "Ubuntu"},
                    "microsoft-standard-WSL2",
                )

    def test_render_stdout_redirect_cp1250_must_be_utf8_bytes(self):
        # The old CLI wrote Unicode through sys.stdout, which Windows may
        # encode as CP1250 when PYTHONUTF8 is disabled. Model that real stream.
        raw = io.BytesIO()
        localized_stdout = io.TextIOWrapper(raw, encoding="cp1250", newline="\n")
        with mock.patch.object(GATE.sys, "stdout", localized_stdout):
            with mock.patch.dict(os.environ, {"PYTHONUTF8": "0"}):
                self.assertEqual(0, GATE.main([
                    "render-workflow", "--branch", "qa/example",
                    "--expected-sha", SHA,
                ]))
            localized_stdout.flush()
        expected = valid_workflow().encode("utf-8")
        self.assertIn("Zaměřovač".encode("utf-8"), expected)
        self.assertEqual(expected, raw.getvalue(),
                         "redirected stdout must be raw UTF-8, never Windows CP1250")
        GATE.check_workflow(raw.getvalue().decode("utf-8"), strict=True)

    def test_render_explicit_output_file_utf8_without_pythonutf8(self):
        # Safe default: create the one-shot YAML file directly, without shell
        # redirection; prove exact UTF-8 bytes plus a successful strict lint.
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp) / ".github" / "workflows"
            folder.mkdir(parents=True)
            target = folder / "home-qa-one-shot.yml"
            with mock.patch.dict(os.environ, {"PYTHONUTF8": "0"}):
                result = GATE.main([
                    "render-workflow", "--branch", "qa/example",
                    "--expected-sha", SHA, "--output", str(target),
                ])
            self.assertEqual(0, result)
            raw = target.read_bytes()
            self.assertEqual(valid_workflow().encode("utf-8"), raw)
            self.assertNotIn(b"\xef\xbb\xbf", raw[:3], "No UTF-8 BOM")
            GATE.check_workflow(raw.decode("utf-8"), strict=True)

    def test_render_output_file_refuses_overwriting_existing_yaml(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp) / ".github" / "workflows"
            folder.mkdir(parents=True)
            target = folder / "home-qa-one-shot.yml"
            target.write_bytes(b"original source, must not be overwritten")
            with mock.patch.object(GATE.sys, "stderr", io.StringIO()):
                self.assertEqual(2, GATE.main([
                    "render-workflow", "--branch", "qa/example",
                    "--expected-sha", SHA, "--output", str(target),
                ]))
            self.assertEqual(b"original source, must not be overwritten",
                             target.read_bytes())

    def test_render_rejects_noncanonical_output_location(self):
        with tempfile.TemporaryDirectory() as tmp:
            wrong = Path(tmp) / "unsafe.yml"
            with mock.patch.object(GATE.sys, "stderr", io.StringIO()):
                self.assertEqual(2, GATE.main([
                    "render-workflow", "--branch", "qa/example",
                    "--expected-sha", SHA, "--output", str(wrong),
                ]))
            self.assertFalse(wrong.exists())

    def test_python_x_utf8_explicit_subprocess_remains_supported(self):
        # This is the published fallback for a terminal that only supports
        # -X utf8; assertions inspect raw output bytes rather than display.
        env = dict(os.environ)
        env["PYTHONUTF8"] = "0"
        result = subprocess.run([
            sys.executable, "-X", "utf8",
            str(ROOT / "tools" / "home_qa_gate.py"),
            "render-workflow", "--branch", "qa/example",
            "--expected-sha", SHA,
        ], capture_output=True, env=env, check=False, timeout=15)
        self.assertEqual(0, result.returncode, result.stderr.decode("utf-8", errors="replace"))
        self.assertEqual(valid_workflow().encode("utf-8"), result.stdout)
        GATE.check_workflow(result.stdout.decode("utf-8"), strict=True)

    def test_render_rejects_unsafe_branch_or_sha(self):
        for branch in ("main", "qa/foo/../main", "refs/pull/1", "qa/unsafe;touch x"):
            with self.subTest(branch=branch), self.assertRaises(GATE.GateError):
                GATE.render_workflow(branch, SHA)
        with self.assertRaises(GATE.GateError):
            GATE.render_workflow("qa/safe", "main")

    def test_adversarial_wrong_executable_versions_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            java_home = Path(temp) / "jdk"
            (java_home / "bin").mkdir(parents=True)
            for name in ("java", "javac"):
                exe = java_home / "bin" / name
                exe.write_text("#!/bin/sh\nexit 0\n", encoding="utf-8")
                exe.chmod(0o755)
            gradle = Path(temp) / "gradle"
            gradle.write_text("#!/bin/sh\nexit 0\n", encoding="utf-8")
            gradle.chmod(0o755)
            env = {"JAVA_HOME": str(java_home), "WSL_DISTRO_NAME": "Ubuntu"}
            resolve = {"git": "/usr/bin/git", "python3": "/usr/bin/python3"}.get
            for fake in (
                ('openjdk version "21.0.5"', "javac 17.0.17", "Gradle 8.10.2"),
                ('openjdk version "17.0.17"', "javac 11.0.2", "Gradle 8.10.2"),
                ('openjdk version "17.0.17"', "javac 17.0.17", "Gradle 8.9"),
            ):
                with self.subTest(fake=fake), mock.patch.object(GATE, "read_version", side_effect=list(fake)):
                    with self.assertRaises(GATE.GateError):
                        GATE.check_wsl(gradle, resolve, "Linux", env, "microsoft-WSL2")

    def test_current_trusted_home_workflows_are_safe_from_wsl_node_discovery(self):
        # Existing main workflows predate this narrower canonical one-shot
        # contract. They are not certified by this test as whole YAML.
        for path in (ROOT / ".github/workflows/windows-self-hosted-qa.yml",
                     ROOT / ".github/workflows/windows-home-apk-release.yml"):
            with self.subTest(path=path):
                text = path.read_text(encoding="utf-8")
                self.assertIn("self-hosted, Windows, X64, zamerovac-qa", text)
                self.assertIn("persist-credentials: false", text)
                self.assertNotIn("python3 -m unittest discover", text)

    def test_all_home_workflows_never_run_node_python_unittest_inside_wsl(self):
        for path in (ROOT / ".github/workflows").glob("*.yml"):
            text = path.read_text(encoding="utf-8")
            if "self-hosted" not in text:
                continue
            with self.subTest(path=path.name):
                self.assertNotIn("wsl.exe --exec python3 -m unittest discover", text)
                self.assertNotIn("python3 -m unittest discover -s tests", text)


if __name__ == "__main__":
    unittest.main()
