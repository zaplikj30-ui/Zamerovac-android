"""Fast positive/negative tests of HOME QA preflight; no Android, cloud or APK."""
from __future__ import annotations

import importlib.util
from pathlib import Path
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("home_qa_gate", ROOT / "tools/home_qa_gate.py")
GATE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(GATE)
SHA = "5411eb04e174c54c6c649084872f31f0d1b421a0"
CHECKOUT = "11d5960a326750d5838078e36cf38b85af677262"


def valid_workflow():
    return """
name: HOME QA pinned self-hosted only
on:
  push:
    branches: [qa/example]
jobs:
  windows-and-wsl:
    if: github.repository == 'zaplikj30-ui/Zamerovac-android' && github.actor == 'zaplikj30-ui' && github.ref == 'refs/heads/qa/example' && github.event_name == 'push'
    runs-on: [self-hosted, Windows, X64, zamerovac-qa]
    steps:
      - uses: actions/checkout@%s
        with:
          ref: %s
          persist-credentials: false
      - name: Gate before expensive work
        run: |
          python tools/home_qa_gate.py lint-workflow .github/workflows/qa.yml --strict
          python tools/home_qa_gate.py windows-quick --expected-sha %s
      - name: WSL native
        run: |
          linux = r\"\"\"
          python3 tools/home_qa_gate.py wsl-native --expected-sha %s
          /opt/gradle-8.10.2/bin/gradle :app:testPreviewUnitTest
          \"\"\"
""" % (CHECKOUT, SHA, SHA, SHA)


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
                (home / "bin" / name).write_text("fixture", encoding="utf-8")
            gradle = Path(t) / "gradle"
            gradle.write_text("fixture", encoding="utf-8")
            env = {"JAVA_HOME": str(home), "WSL_DISTRO_NAME": "Zamerovac-Ubuntu-QA"}
            tools = {"git": "/usr/bin/git", "python3": "/usr/bin/python3"}
            # No node executable exists in the fake WSL: native preflight passes.
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
        broken = valid_workflow().replace(
            "python3 tools/home_qa_gate.py wsl-native",
            "python3 -m unittest discover -s tests -p 'test_*.py' -v\n          python3 tools/home_qa_gate.py wsl-native",
        )
        with self.assertRaisesRegex(GATE.GateError, "WSL Python unittest"):
            GATE.check_workflow(broken, strict=True)

    def test_workflow_rejects_wsl_direct_unittest(self):
        broken = valid_workflow().replace(
            "/opt/gradle-8.10.2/bin/gradle :app:testPreviewUnitTest",
            "wsl.exe --exec python3 -m unittest discover -s tests\n          /opt/gradle-8.10.2/bin/gradle :app:testPreviewUnitTest",
        )
        with self.assertRaises(GATE.GateError):
            GATE.check_workflow(broken, strict=True)

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
        bad = valid_workflow().replace(
            "python3 tools/home_qa_gate.py wsl-native --expected-sha",
            "echo skipping_wsl_native_preflight --expected-sha",
        )
        with self.assertRaisesRegex(GATE.GateError, "reusable Windows and WSL"):
            GATE.check_workflow(bad, strict=True)

    def test_strict_rejects_untrusted_checkout_ref(self):
        for replacement in ("main", "refs/heads/qa/old", "0" * 40):
            with self.subTest(replacement=replacement), self.assertRaises(GATE.GateError):
                GATE.check_workflow(valid_workflow().replace("ref: " + SHA, "ref: " + replacement), strict=True)

    def test_strict_rejects_disagreement_of_source_and_expected(self):
        bad = valid_workflow().replace("--expected-sha " + SHA, "--expected-sha " + ("f" * 40))
        with self.assertRaisesRegex(GATE.GateError, "must match a pinned checkout"):
            GATE.check_workflow(bad, strict=True)

    def test_current_trusted_home_workflows_are_safe_from_wsl_node_discovery(self):
        for path in (ROOT / ".github/workflows/windows-self-hosted-qa.yml",
                     ROOT / ".github/workflows/windows-home-apk-release.yml"):
            with self.subTest(path=path):
                GATE.check_workflow(path.read_text(encoding="utf-8"))

    def test_all_home_workflows_never_run_node_python_unittest_inside_wsl(self):
        for path in (ROOT / ".github/workflows").glob("*.yml"):
            text = path.read_text(encoding="utf-8")
            if "self-hosted" not in text:
                continue
            with self.subTest(path=path.name):
                GATE.check_workflow(text)


if __name__ == "__main__":
    unittest.main()
