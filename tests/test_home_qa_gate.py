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
            "GITHUB_ACTOR": "zaplikj30-ui", "GITHUB_EVENT_NAME": "push",
            "GITHUB_REF": "refs/heads/qa/preflight", "RUNNER_ENVIRONMENT": "self-hosted",
        }
        GATE.trusted_owner(e)
        for patch in ({"GITHUB_REPOSITORY": "fork/Zamerovac-android"},
                      {"GITHUB_EVENT_NAME": "pull_request"},
                      {"RUNNER_ENVIRONMENT": "github-hosted"},
                      {"GITHUB_REF": "refs/pull/7/merge"},
                      {"GITHUB_ACTOR": "other"},
                      {"GITHUB_HEAD_REF": "evil"}):
            with self.subTest(patch=patch), self.assertRaises(GATE.GateError):
                GATE.trusted_owner({**e, **patch})

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



NATIVE_SHA = "144bb5573932be032411c11451aa560a10f623ee"
NATIVE_SOURCE_BRANCH = "fix/p1-34-b-protected-archive-chat33-20261110"
NATIVE_QA_BRANCH = "qa/pr102-native-controlled"


def native_workflow():
    return GATE.render_native_workflow(NATIVE_QA_BRANCH, NATIVE_SHA,
                                       NATIVE_SOURCE_BRANCH)


class TargetedNativeGateTest(unittest.TestCase):
    """No HOME workflow is emitted by these tests; all provider/JUnit data synthetic."""

    def test_native_canonical_accepts_only_exact_recipe(self):
        text = native_workflow()
        GATE.check_native_workflow(text, strict=True)
        self.assertIn("ref: " + NATIVE_SHA, text)
        self.assertIn("refs/heads/" + NATIVE_QA_BRANCH, text)
        self.assertIn("ZamerovacQA", text)
        self.assertIn("refs/heads/" + NATIVE_QA_BRANCH, text)
        self.assertIn("verify-trusted-source --source-branch " + NATIVE_SOURCE_BRANCH,
                      text)
        self.assertIn("GH_TOKEN: " + "$" + "{{ github.token }}", text)
        self.assertIn("persist-credentials: false", text)
        self.assertIn("submodules: false", text)
        self.assertNotIn("pull_request:", text)
        self.assertNotIn("ubuntu-latest", text)
        self.assertNotIn("assemblePreview", text)
        self.assertNotIn("upload-artifact@v4", text)

    def test_native_refuses_untrusted_source_branches_and_refs(self):
        for branch in ("main", "refs/pull/102/merge", "fork/other",
                       "fix/../../main", "qa/foo//bad", "fix/fork.lock",
                       "fix/x;rm -rf", "fix/FORK", "fix/foo/"):
            with self.subTest(branch=branch), self.assertRaises(GATE.GateError):
                GATE.render_native_workflow(NATIVE_QA_BRANCH, NATIVE_SHA, branch)
        for bad in ("refs/heads/main", "qa/foo/../bar", "qa/pr102;echo", "main"):
            with self.subTest(branch=bad), self.assertRaises(GATE.GateError):
                GATE.render_native_workflow(bad, NATIVE_SHA, NATIVE_SOURCE_BRANCH)
        with self.assertRaises(GATE.GateError):
            GATE.render_native_workflow(NATIVE_QA_BRANCH, "main", NATIVE_SOURCE_BRANCH)

    def test_native_strict_yaml_rejects_every_security_bypass(self):
        good = native_workflow()
        edits = (
            ("runs-on: [self-hosted, Windows, X64, zamerovac-qa]", "runs-on: ubuntu-latest"),
            ("persist-credentials: false", "persist-credentials: true"),
            ("actions/checkout@" + CHECKOUT, "actions/checkout@v4"),
            ("github.actor == 'zaplikj30-ui'", "github.actor == 'someone'"),
            ("github.event_name == 'push'", "github.event_name == 'pull_request'"),
            ("if: always()", "if: success()"),
            ("--expected-sha " + NATIVE_SHA, "--expected-sha " + "f" * 40),
            ("ref: " + NATIVE_SHA, "ref: main"),
            ("--source-branch " + NATIVE_SOURCE_BRANCH, "--source-branch fix/other"),
            ("wsl-targeted-from-windows", "windows-quick"),
            ("lint-native-workflow", "lint-workflow"),
        )
        for old, new in edits:
            self.assertIn(old, good, "security test must change existing YAML")
            with self.subTest(bypass=new):
                changed = good.replace(old, new)
                self.assertNotEqual(good, changed)
                with self.assertRaises(GATE.GateError):
                    GATE.check_native_workflow(changed, strict=True)
        for addition in (
            "\n  cloud:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo paid\n",
            "\n      - run: gradle :app:assemblePreview\n",
            "\n# fake skipped preflight\n",
        ):
            with self.subTest(added=addition), self.assertRaises(GATE.GateError):
                GATE.check_native_workflow(good + addition, strict=True)
        with self.assertRaises(GATE.GateError):
            GATE.check_native_workflow(good, strict=False)

    def test_native_utf8_output_is_safe_and_refuses_overwrite(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary) / ".github" / "workflows"
            directory.mkdir(parents=True)
            target = directory / "home-qa-targeted-native.yml"
            self.assertEqual(0, GATE.main([
                "render-native-workflow", "--branch", NATIVE_QA_BRANCH,
                "--source-branch", NATIVE_SOURCE_BRANCH,
                "--expected-sha", NATIVE_SHA, "--output", str(target),
            ]))
            self.assertEqual(native_workflow().encode("utf-8"), target.read_bytes())
            GATE.check_native_workflow(target.read_text(encoding="utf-8"), strict=True)
            with mock.patch.object(GATE.sys, "stderr", io.StringIO()):
                self.assertEqual(2, GATE.main([
                    "render-native-workflow", "--branch", NATIVE_QA_BRANCH,
                    "--source-branch", NATIVE_SOURCE_BRANCH,
                    "--expected-sha", NATIVE_SHA, "--output", str(target),
                ]))
            self.assertEqual(native_workflow().encode("utf-8"), target.read_bytes())
            self.assertEqual(0, GATE.main([
                "lint-native-workflow", str(target), "--strict",
            ]))

    @staticmethod
    def _owner_env():
        return {
            "GITHUB_ACTIONS": "true", "GITHUB_REPOSITORY": GATE.REPO,
            "GITHUB_ACTOR": GATE.OWNER, "GITHUB_EVENT_NAME": "push",
            "GITHUB_REF": "refs/heads/" + NATIVE_QA_BRANCH,
            "RUNNER_ENVIRONMENT": "self-hosted", "GH_TOKEN": "test-read-only-token",
        }

    @staticmethod
    def _branch_response(sha=NATIVE_SHA, ref=None, kind="commit"):
        body = {
            "ref": ref or "refs/heads/" + NATIVE_SOURCE_BRANCH,
            "object": {"sha": sha, "type": kind},
        }
        class Response:
            status = 200
            def __enter__(self): return self
            def __exit__(self, *args): return False
            def read(self, limit): return __import__("json").dumps(body).encode("utf-8")
        return Response()

    def test_owner_source_attestation_real_branch_shape_positive(self):
        env = self._owner_env()
        def verified_open(request, timeout):
            self.assertEqual(20, timeout)
            self.assertEqual(
                "https://api.github.com/repos/" + GATE.REPO +
                "/git/ref/heads/" + NATIVE_SOURCE_BRANCH,
                request.full_url,
            )
            self.assertEqual("Bearer test-read-only-token",
                             request.get_header("Authorization"))
            return self._branch_response()
        self.assertEqual(NATIVE_SHA, GATE.verify_trusted_source(
            NATIVE_SOURCE_BRANCH, NATIVE_SHA, env, verified_open))

    def test_owner_source_attestation_never_trusts_fork_or_stale_commit(self):
        env = self._owner_env()
        for change in (
            {"GITHUB_ACTOR": "attacker"},
            {"GITHUB_REPOSITORY": "fork/Zamerovac-android"},
            {"GITHUB_REF": "refs/pull/102/merge"},
            {"GITHUB_EVENT_NAME": "pull_request"},
            {"RUNNER_ENVIRONMENT": "github-hosted"},
            {"GH_TOKEN": ""},
        ):
            with self.subTest(change=change), self.assertRaises(GATE.GateError):
                GATE.verify_trusted_source(NATIVE_SOURCE_BRANCH, NATIVE_SHA,
                                           {**env, **change},
                                           lambda request, timeout: self._branch_response())
        for response in (
            self._branch_response("f" * 40),
            self._branch_response(ref="refs/heads/fix/other"),
            self._branch_response(kind="tag"),
        ):
            with self.assertRaises(GATE.GateError):
                GATE.verify_trusted_source(NATIVE_SOURCE_BRANCH, NATIVE_SHA,
                                           env, lambda request, timeout: response)

    def test_source_attestation_remote_failure_does_not_fall_through(self):
        def unreachable(request, timeout):
            raise OSError("network unavailable")
        with self.assertRaises(GATE.GateError):
            GATE.verify_trusted_source(NATIVE_SOURCE_BRANCH, NATIVE_SHA,
                                       self._owner_env(), unreachable)
        with self.assertRaises(GATE.GateError):
            GATE._RejectRedirect().redirect_request(None, None, 302, "redirect", {}, "https://fork.invalid")

    @staticmethod
    def _junit_fixture(root):
        directory = root / "app" / "build" / "test-results" / "testPreviewUnitTest"
        directory.mkdir(parents=True)
        for name, required in GATE.TARGETED_NATIVE.items():
            cases = "".join('<testcase name="positive-and-negative" classname="cz.zamerovac.app.' +
                            name + '"/>' for _ in range(required))
            (directory / ("TEST-cz.zamerovac.app." + name + ".xml")).write_text(
                '<testsuite tests="' + str(required) +
                '" failures="0" errors="0" skipped="0">' + cases + '</testsuite>',
                encoding="utf-8")
        return directory

    def test_exact_94_junit_methods_and_evidence_required(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            directory = self._junit_fixture(root)
            report = root / "evidence" / "summary.txt"
            with mock.patch.object(GATE, "git_source", return_value=NATIVE_SHA):
                self.assertEqual(94, GATE.verify_targeted_xml(root, report, NATIVE_SHA))
                self.assertIn("TESTED_SOURCE_SHA=" + NATIVE_SHA, report.read_text())
                self.assertIn("SKIPPED=0", report.read_text())
                self.assertNotIn("app/src", report.read_text())
                target = directory / "TEST-cz.zamerovac.app.TrashPurgerTest.xml"
                original = target.read_text()
                for mutated in (
                    original.replace('skipped="0"', 'skipped="1"'),
                    original.replace('failures="0"', 'failures="1"'),
                    original.replace('errors="0"', 'errors="1"'),
                    original.replace('tests="17"', 'tests="16"'),
                    "<testsuite incomplete",
                ):
                    with self.subTest(changed=mutated[:50]):
                        target.write_text(mutated)
                        with self.assertRaises(GATE.GateError):
                            GATE.verify_targeted_xml(root, report, NATIVE_SHA)
                target.write_text(original)
                target.unlink()
                with self.assertRaises(GATE.GateError):
                    GATE.verify_targeted_xml(root, report, NATIVE_SHA)

    def test_native_gradle_is_serial_offline_whitelisted_and_never_builds_apk(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            testdir = root / "app" / "src" / "test" / "java" / "cz" / "zamerovac" / "app"
            testdir.mkdir(parents=True)
            for name, count in GATE.TARGETED_NATIVE.items():
                (testdir / (name + ".java")).write_text("@Test void probe(){}\n" * count)
            commands = []
            def capture(argv, **kwargs):
                commands.append(argv)
                self.assertEqual(root, kwargs["cwd"])
                self.assertTrue(kwargs["check"])
            with mock.patch.object(GATE, "git_source", return_value=NATIVE_SHA), \
                 mock.patch.object(GATE.subprocess, "run", side_effect=capture), \
                 mock.patch.object(GATE, "verify_targeted_xml", return_value=94):
                GATE.run_targeted_native(root, NATIVE_SHA, Path("/opt/gradle-8.10.2/bin/gradle"),
                                         root / "summary.txt")
            self.assertEqual(2, len(commands))
            self.assertIn(":app:compilePreviewUnitTestJavaWithJavac", commands[0])
            self.assertIn(":app:testPreviewUnitTest", commands[1])
            self.assertEqual(5, commands[1].count("--tests"))
            for argv in commands:
                self.assertIn("--offline", argv)
                self.assertIn("--no-daemon", argv)
                self.assertIn("--max-workers=1", argv)
                self.assertIn("--no-parallel", argv)
                self.assertFalse(any("assemble" in item or "release" in item for item in argv))
            (testdir / "TrashPurgerTest.java").write_text("pass\n")
            with mock.patch.object(GATE, "git_source", return_value=NATIVE_SHA), \
                 mock.patch.object(GATE.subprocess, "run") as forbidden:
                with self.assertRaises(GATE.GateError):
                    GATE.run_targeted_native(root, NATIVE_SHA, Path("/opt/gradle-8.10.2/bin/gradle"),
                                             root / "summary.txt")
                forbidden.assert_not_called()


if __name__ == "__main__":
    unittest.main()
