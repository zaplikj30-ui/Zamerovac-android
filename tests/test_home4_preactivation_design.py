"""Inert reference models for the HOME4 proposal, NOT an execution/approval gate.

All observations are synthetic. No process, network, browser, WSL or APK is
started. Existing runtime validators are tested separately, unchanged. The
fictional pins below cannot authorize a real run; this module has no CLI gate.
"""
import hashlib
from pathlib import Path
import re
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tests/helpers"))
from qa_historical import historical_text
MAIN = "a3cc8eb3a14a9a6710664b73ba8a5c70ed1a340a"
PRODUCT = "ae3b4df53c25557f28b4a25ccb65adc2abdff639"
DIAGNOSTICS = {
    "cz.zamerovac.app.SafSyncV2Test.driveStagedAckMustNotPublishAfterLocalAuthorityLostInsideProviderCommit":
        "Provider completed signed ACK after recovery epoch loss: Drive staged expected:<0> but was:<1>",
    "cz.zamerovac.app.SafSyncV2Test.safDirectAckMustNotPublishAfterLocalAuthorityLostInsideProviderWrite":
        "Provider completed signed ACK after recovery epoch loss: SAF direct expected:<0> but was:<1>",
}


class Home4ProposalModels(unittest.TestCase):
    # These predicates specify proposed acceptance using supplied observations.
    # They neither acquire nor authenticate OS observations. Never import them
    # into tools/workflows; a runtime implementation needs separate review.
    def identity(self, actual, pins):
        if any(not isinstance(pins.get(k), str) or
               not re.fullmatch(r"[0-9a-f]{40}", pins[k])
               for k in ("source", "validator", "event_sha")):
            return False
        expected = dict(repo="zaplikj30-ui/Zamerovac-android", actor="zaplikj30-ui",
                        triggering_actor="zaplikj30-ui", event="workflow_dispatch",
                        ref="refs/heads/main", attempt="1", **pins)
        return (actual == expected and pins["source"] == pins["event_sha"])

    def counts(self, rows, names, exit_code=0, diagnostic=None):
        return (type(exit_code) is int and exit_code == 0 and diagnostic is None
                and len(names) == len(set(names)) and len(rows) == len(names)
                and [r[0] for r in rows] == names
                and all(r[1] == "PASS" for r in rows))

    def cache(self, contents, approved_hashes):
        # Hash bytes, not existence/version text; real path/handle/TOCTOU checks
        # remain the responsibility of the unchanged runtime identity verifier.
        return (bool(approved_hashes) and set(contents) == set(approved_hashes)
                and all(isinstance(h, str) and re.fullmatch(r"[0-9a-f]{64}", h)
                        and isinstance(contents[n], bytes)
                        and hashlib.sha256(contents[n]).hexdigest() == h
                        for n, h in approved_hashes.items()))

    def wsl(self, observation, contents, hashes):
        return (all(type(observation.get(k)) is bool for k in
                    ("nonroot", "ext4", "fresh", "clean", "ignored_clean", "local_objects"))
                and all(type(observation.get(k)) is int for k in ("ram_mib", "cpus", "workers"))
                and observation == dict(nonroot=True, ext4=True, fresh=True,
                                    clean=True, ignored_clean=True, local_objects=True,
                                    source=MAIN, ram_mib=4096, cpus=2, workers=1)
                and self.cache(contents, hashes))

    def cleanup(self, evidence):
        # A FAIL with successful cleanup is still not a successful job.
        return (type(evidence.get("exit")) is int and
                all(type(evidence.get(k)) is bool for k in
                    ("job_empty", "handles_closed", "temp_removed", "audit_equal", "disk_within_budget"))
                and evidence == dict(status="PASS", reason="normal", exit=0,
                                job_empty=True, handles_closed=True,
                                temp_removed=True, audit_equal=True,
                                disk_within_budget=True, diagnostic=None))

    def jvm(self, records, expected_names, files, exit_code, approved=False):
        # Synthetic strict companion to PR121 classify(): exact registry and
        # exact messages, not >= counts or substring messages. No XML I/O here.
        ids = [r[0] for r in records]
        raw = "PASS" if type(exit_code) is int and exit_code == 0 else "FAIL" if type(exit_code) is int else "UNKNOWN"
        binding = (PRODUCT, "b" * 40, "12345678", "1", "synthetic-token")
        if (approved is not True or type(exit_code) is not int or exit_code != 1
                or len(files) != 64
                or {f[0] for f in files} != {"synthetic-XML-" + str(i) for i in range(64)}
                or any(f[1] != binding or f[2] is not True for f in files)
                or len(expected_names) != 513 or len(set(expected_names)) != 513
                or len(ids) != 513 or len(set(ids)) != 513
                or set(ids) != set(expected_names)):
            return {"raw": raw, "acceptance": "BLOCKED"}
        ok = all((status, message) == ("FAIL", DIAGNOSTICS[name])
                 if name in DIAGNOSTICS else (status, message) == ("PASS", "")
                 for name, status, message in records)
        return {"raw": raw, "acceptance": "PASS" if ok else "BLOCKED"}

    def test_A_D_manual_exact_identity_positive_and_unresolved_pins(self):
        pins = dict(source=MAIN, validator="b" * 40, event_sha=MAIN)
        actual = dict(repo="zaplikj30-ui/Zamerovac-android", actor="zaplikj30-ui",
                      triggering_actor="zaplikj30-ui", event="workflow_dispatch",
                      ref="refs/heads/main", attempt="1", **pins)
        self.assertTrue(self.identity(actual, pins))  # fictional reviewed validator
        for key in pins:
            broken = {**pins, key: None}
            self.assertFalse(self.identity(actual, broken))
        for key, value in dict(repo="fork/repo", actor="other", triggering_actor="other",
                               event="push", ref="refs/pull/121/merge", attempt="2",
                               source=PRODUCT, validator="c" * 40, event_sha=PRODUCT).items():
            with self.subTest(key=key):
                self.assertFalse(self.identity({**actual, key: value}, pins))
        self.assertFalse(self.identity({**actual, "event": "pull_request"}, pins))
        self.assertFalse(self.identity({**actual, "extra": "ignored?"}, pins))
        # Even a pinned historical product cannot be called main HOME4.
        separate = {**pins, "source": PRODUCT}
        self.assertFalse(self.identity({**actual, **separate}, separate))

    def test_B_cache_bytes_missing_corrupt_extra_and_unapproved_hash(self):
        data = {"node.exe": b"synthetic-node", "cache/jar": b"synthetic-cache"}
        hashes = {n: hashlib.sha256(b).hexdigest() for n, b in data.items()}
        self.assertTrue(self.cache(data, hashes))
        for changed in ({}, {"node.exe": data["node.exe"]},
                        {**data, "cache/jar": b"corrupt"}, {**data, "extra": b"x"}):
            self.assertFalse(self.cache(changed, hashes))
        for h in (None, "", "exists", "0" * 64):
            self.assertFalse(self.cache(data, {**hashes, "node.exe": h}))

    def test_B_transfers_are_explicit_and_not_package_installs(self):
        # Separate proposed data permissions. No permission is granted by tests.
        permitted = {"checkout-exact-sha", "github-actions-pinned-code"}
        requested = ["checkout-exact-sha", "github-actions-pinned-code"]
        self.assertTrue(set(requested) <= permitted)
        for transfer in ("curl-mingit", "curl-gradle", "npm-install", "npm-ci-offline",
                         "playwright-install", "pip-install", "setup-java-download",
                         "maven-resolution", "robolectric-resolution",
                         "release-asset-read", "upload-raw-log", "upload-apk"):
            self.assertFalse(set(requested + [transfer]) <= permitted)
        # Read-only APK transfer needs a distinct owner decision, not npm rights.
        self.assertTrue({"release-asset-read"} <= permitted | {"release-asset-read"})

    def test_C_WSL_fresh_tree_and_objects_not_just_HEAD(self):
        data = {"tracked": b"source"}
        hashes = {"tracked": hashlib.sha256(data["tracked"]).hexdigest()}
        good = dict(nonroot=True, ext4=True, fresh=True, clean=True,
                    ignored_clean=True, local_objects=True, source=MAIN,
                    ram_mib=4096, cpus=2, workers=1)
        self.assertTrue(self.wsl(good, data, hashes))
        for key in ("nonroot", "ext4", "fresh", "clean", "ignored_clean", "local_objects"):
            self.assertFalse(self.wsl({**good, key: False}, data, hashes), key)
        for key, value in dict(source=PRODUCT, ram_mib=8192, cpus=4, workers=2).items():
            self.assertFalse(self.wsl({**good, key: value}, data, hashes), key)
        self.assertFalse(self.wsl(good, {"tracked": b"tampered"}, hashes))
        self.assertFalse(self.wsl(good, {**data, "ignored": b"untracked"}, hashes))
        self.assertFalse(self.wsl({**good, "workers": True}, data, hashes))
        self.assertFalse(self.wsl({**good, "nonroot": 1}, data, hashes))

    def test_E_cleanup_unknown_timeout_cancel_and_budget_never_PASS(self):
        good = dict(status="PASS", reason="normal", exit=0, job_empty=True,
                    handles_closed=True, temp_removed=True, audit_equal=True,
                    disk_within_budget=True, diagnostic=None)
        self.assertTrue(self.cleanup(good))
        for key in ("job_empty", "handles_closed", "temp_removed", "audit_equal", "disk_within_budget"):
            for value in (False, None):
                self.assertFalse(self.cleanup({**good, key: value}))
        for reason in ("timeout", "cancel", "crash", "owner-death", "createprocess-hang"):
            self.assertFalse(self.cleanup({**good, "reason": reason}))
        self.assertFalse(self.cleanup({**good, "exit": 1}))
        self.assertFalse(self.cleanup({**good, "status": "FAIL"}))
        self.assertFalse(self.cleanup({**good, "diagnostic": "ScopeError"}))
        self.assertFalse(self.cleanup({**good, "exit": False}))
        self.assertFalse(self.cleanup({**good, "job_empty": 1}))

    def test_F_named_results_not_exit_code_only(self):
        names = ["synthetic-" + str(i) for i in range(15)]
        rows = [(name, "PASS") for name in names]
        self.assertTrue(self.counts(rows, names))
        for bad in (rows[:-1], rows + [rows[0]], [rows[0]] * 15,
                    [("renamed", "PASS")] + rows[1:], list(reversed(rows))):
            self.assertFalse(self.counts(bad, names))
        for state in ("FAIL", "SKIP", "ERROR", "TODO", "NOT RUN"):
            self.assertFalse(self.counts([(names[0], state)] + rows[1:], names))
        for code in (1, 2, None, "0", False):
            self.assertFalse(self.counts(rows, names, code))
        self.assertFalse(self.counts(rows, names, diagnostic="error"))

    def test_G_513_synthetic_cases_exact_raw_FAIL_separate_acceptance(self):
        # The 511 fake names are deliberately NOT a production method registry.
        records = [("synthetic." + str(i), "PASS", "") for i in range(511)]
        records += [(name, "FAIL", message) for name, message in DIAGNOSTICS.items()]
        names = [r[0] for r in records]
        binding = (PRODUCT, "b" * 40, "12345678", "1", "synthetic-token")
        files = [("synthetic-XML-" + str(i), binding, True) for i in range(64)]
        self.assertEqual(self.jvm(records, names, files, 1), {"raw": "FAIL", "acceptance": "BLOCKED"})
        self.assertEqual(self.jvm(records, names, files, 1, approved=True),
                         {"raw": "FAIL", "acceptance": "PASS"})
        mutations = [records[:-1], records + [records[0]], [records[0]] + records[1:-1] + [records[0]],
                     [("renamed", "PASS", "")] + records[1:]]
        for state in ("PASS", "SKIP", "ERROR"):
            mutations.append(records[:-1] + [(records[-1][0], state, records[-1][2])])
        for message in ("wrong", records[-1][2] + " additional error"):
            mutations.append(records[:-1] + [(records[-1][0], "FAIL", message)])
        mutations.append([(records[0][0], "FAIL", "third fail")] + records[1:])
        for bad in mutations:
            self.assertEqual(self.jvm(bad, names, files, 1, True)["acceptance"], "BLOCKED")
        for code in (0, 2, None, "1", True):
            self.assertEqual(self.jvm(records, names, files, code, True)["acceptance"], "BLOCKED")
        self.assertEqual(self.jvm(records, names, files, 0, True)["raw"], "PASS")
        for xml in (files[:-1], files + [files[0]], [files[0]] * 64,
                    [(files[0][0], binding, False)] + files[1:],
                    [(files[0][0], (MAIN,) + binding[1:], True)] + files[1:],
                    [("renamed.xml", binding, True)] + files[1:]):
            self.assertEqual(self.jvm(records, names, xml, 1, True)["acceptance"], "BLOCKED")

    def test_G_four_job_conclusions_do_not_replace_bound_evidence(self):
        # Join across jobs is exact, not 'all values that happened to arrive'.
        expected = ("local-quick", "browser-smoke", "native-jvm", "preview-build-smoke")
        identity = (MAIN, "b" * 40, "12345678", "1")
        good = [(name, identity, "PASS", True) for name in expected]

        def joined(rows):
            return (len(rows) == 4 and tuple(r[0] for r in rows) == expected
                    and all(r[1] == identity and r[2] == "PASS" and r[3] is True for r in rows))

        self.assertTrue(joined(good))
        for bad in (good[:-1], good + [good[0]], [good[0]] * 4,
                    [(expected[0], identity, "PASS", False)] + good[1:],
                    [(expected[0], identity, "PASS", 1)] + good[1:],
                    [(expected[0], (PRODUCT,) + identity[1:], "PASS", True)] + good[1:],
                    [(expected[0], identity[:-1] + ("2",), "PASS", True)] + good[1:]):
            self.assertFalse(joined(bad))

    def test_static_runtime_remains_manual_and_original_browser_policy_is_not_activated(self):
        workflow = (ROOT / ".github/workflows/windows-self-hosted-qa.yml").read_text()
        trigger = workflow.split("on:\n", 1)[1].split("\npermissions:", 1)[0]
        self.assertEqual(trigger.strip(), "workflow_dispatch:")
        browser = historical_text('integrity')
        self.assertIn("env.GITHUB_EVENT_NAME==='push'", browser)
        self.assertIn("refs/heads/qa/browser-smoke-winfix-20261113-run", browser)
        self.assertIn("env.GITHUB_TRIGGERING_ACTOR==='zaplikj30-ui'", browser)


if __name__ == "__main__":
    unittest.main()
