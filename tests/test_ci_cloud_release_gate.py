"""Stálé bezpečnostní brány nouzového CLOUD sestavení Zaměřovače.

Test čte pouze zdroj workflow, nepoužívá GitHub token a nic nespouští.
Skutečný cloudový sestavovací/release průchod zůstává NOT RUN bez souhlasu.
"""
from pathlib import Path
import re
import unittest


WORKFLOW = (
    Path(__file__).resolve().parents[1]
    / ".github" / "workflows" / "build-apk.yml"
).read_text(encoding="utf-8")


class CloudReleaseSafetyGateTest(unittest.TestCase):
    def test_cloud_is_manual_only(self):
        self.assertIn("on:\n  workflow_dispatch:\n", WORKFLOW)
        self.assertNotRegex(
            WORKFLOW, r"(?m)^  (?:push|pull_request|pull_request_target|schedule|workflow_run):"
        )
        self.assertIn("default: false", WORKFLOW)

    def test_owner_main_and_two_explicit_approvals(self):
        self.assertIn("github.actor == 'zaplikj30-ui'", WORKFLOW)
        self.assertIn("github.ref == 'refs/heads/main'", WORKFLOW)
        self.assertIn(
            "inputs.cloud_run_approved == true && inputs.publish_release == true",
            WORKFLOW,
        )

    def test_preflight_checks_old_package_before_expensive_build(self):
        download = WORKFLOW.index('gh release download "$PREVIOUS_TAG"')
        build = WORKFLOW.index("gradle --no-daemon :app:verifyDriveRegistration assemblePreview")
        self.assertLess(download, build)
        self.assertIn("PREVIOUS_SIGN=", WORKFLOW)
        self.assertIn("cz.zamerovac.app.preview", WORKFLOW)
        self.assertIn(
            "c828c96739e554e8da4f5851913356134f1359a98d5013772ad5587e74a2d229",
            WORKFLOW,
        )

    def test_version_comes_from_published_apk_not_workflow_counter(self):
        self.assertIn("NEW_CODE=$((PREVIOUS_CODE + 1))", WORKFLOW)
        self.assertIn('VERSION_WORKFLOW_OFFSET=$((NEW_CODE - 1000))', WORKFLOW)
        self.assertIn('export GITHUB_RUN_NUMBER="$VERSION_WORKFLOW_OFFSET"', WORKFLOW)
        self.assertIn("versionCode='${RELEASE_VERSION_CODE}'", WORKFLOW)
        self.assertNotIn("$((1000 + GITHUB_RUN_NUMBER))", WORKFLOW)
        self.assertIn("node - \"$APP_VERSION\" \"${PREVIOUS_TAG#test-v}\"", WORKFLOW)

    def test_release_race_stops_publication(self):
        self.assertIn("CURRENT_PREVIOUS_TAG=", WORKFLOW)
        self.assertIn('"$CURRENT_PREVIOUS_TAG" != "$PREVIOUS_TAG"', WORKFLOW)
        self.assertIn('gh release view "$TAG"', WORKFLOW)
        self.assertIn("inputs.publish_release == true", WORKFLOW)

    def test_no_stale_fixed_release_notes(self):
        self.assertNotIn("funkce z 1.2.153 zůstaly zachovány", WORKFLOW)
        self.assertIn("historie změn přímo v aplikaci", WORKFLOW)


if __name__ == "__main__":
    unittest.main()
