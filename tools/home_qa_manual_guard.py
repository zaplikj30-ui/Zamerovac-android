#!/usr/bin/env python3
"""Trusted-main-only authorizer for manual HOME QA; no arbitrary source ref.

This file and the workflow must be executed from a reviewed main commit.
Update ALLOWED_SOURCE_SHAS only after an independent source review.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import sys

OWNER = "zaplikj30-ui"
REPO = "zaplikj30-ui/Zamerovac-android"
SHA = re.compile(r"[a-f0-9]{40}\Z")
# Approved target for the first stage only; adding SHA requires reviewed main change.
ALLOWED_SOURCE_SHAS = frozenset({
    "3f2779ec9b5c432296f9db2bad8502cc4ff63588",  # PR #105 2026-11-11
})
WORKFLOW_SHA256 = "72a28cd8ac97dbd1a563bb98a2f5cd6475208940d3f79854cf445b3284acd055"


def require(check: bool, reason: str) -> None:
    if not check:
        raise ValueError("HOME MANUAL STOP: " + reason)


def verify_workflow(path: Path) -> None:
    require(path.is_file() and not path.is_symlink(), "missing/linked workflow")
    require(hashlib.sha256(path.read_bytes()).hexdigest() == WORKFLOW_SHA256,
            "workflow differs from independently reviewed literal recipe")


def authorize(env: dict[str, str], trusted_root: Path) -> str:
    require(env.get("GITHUB_ACTIONS") == "true", "GitHub Actions required")
    require(env.get("GITHUB_REPOSITORY") == REPO, "wrong repository/fork")
    require(env.get("GITHUB_ACTOR") == OWNER, "owner-only manual dispatch")
    require(env.get("GITHUB_EVENT_NAME") == "workflow_dispatch", "manual event only")
    require(env.get("GITHUB_REF") == "refs/heads/main", "main workflow only")
    require(not env.get("GITHUB_HEAD_REF") and not env.get("GITHUB_BASE_REF"), "PR refs forbidden")
    require(env.get("RUNNER_ENVIRONMENT") == "self-hosted", "self-hosted runner required")
    require(env.get("USERNAME", "").lower() == "zamerovacqa", "wrong Windows service account")
    require(bool(re.fullmatch(r"[a-f0-9]{40}", env.get("GITHUB_SHA", ""))), "invalid trusted main SHA")
    require((trusted_root / ".git").exists(), "no trusted git checkout")
    verify_workflow(trusted_root / ".github" / "workflows" / "home-qa-manual.yml")
    head = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=trusted_root,
                                   text=True, timeout=10).strip()
    require(head == env["GITHUB_SHA"], "trusted checkout mismatch")
    requested = env.get("REQUESTED_SOURCE_SHA", "")
    require(bool(SHA.fullmatch(requested)), "source must be exact 40-lowercase-hex SHA")
    require(requested in ALLOWED_SOURCE_SHAS, "source SHA is NOT independently allowed")
    return requested


def verify_source(root: Path, sha: str) -> None:
    require(sha in ALLOWED_SOURCE_SHAS, "source not approved")
    require((root / ".git").exists(), "source is not a git checkout")
    current = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root,
                                      text=True, timeout=10).strip()
    require(current == sha, "checked out source SHA mismatch")


def prepare_evidence(env: dict[str, str], trusted_root: Path) -> Path:
    """Create a new run/attempt-scoped *synthetic-only* evidence directory.

    mkdtemp uses exclusive random creation: stale results cannot be reused even
    after an abrupt runner stop; no existing media or result folder is deleted.
    """
    sha = authorize(env, trusted_root)
    require(env.get("QA_ALLOWED_SHA") == sha, "source was not previously authorized")
    run_id, attempt = env.get("GITHUB_RUN_ID", ""), env.get("GITHUB_RUN_ATTEMPT", "")
    require(bool(re.fullmatch(r"[0-9]{1,20}", run_id)) and
            bool(re.fullmatch(r"[0-9]{1,8}", attempt)), "invalid run identity")
    raw = env.get("RUNNER_TEMP", "")
    temp_root = Path(raw)
    require(bool(raw) and temp_root.is_absolute() and
            temp_root.is_dir() and not temp_root.is_symlink(),
            "trusted runner temp directory required")
    envfile = Path(env.get("GITHUB_ENV") or ".")
    require(envfile.is_file() and not envfile.is_symlink(),
            "trusted GitHub environment file missing")
    root = Path(tempfile.mkdtemp(prefix=f"zamerovac-home-{run_id}-{attempt}-",
                                 dir=str(temp_root)))
    require("\r" not in str(root) and "\n" not in str(root),
            "unsafe runner temp path")
    results = root / "Zamerovac-QA" / "results"
    results.mkdir(parents=True, exist_ok=False)
    marker = {"source_sha": sha, "trusted_sha": env["GITHUB_SHA"],
              "run_id": run_id, "run_attempt": attempt,
              "kind": "synthetic-home-qa"}
    (results / "run.json").write_text(
        json.dumps(marker, sort_keys=True) + "\n", encoding="utf-8")
    with envfile.open("a", encoding="utf-8", newline="\n") as stream:
        stream.write("QA_EVIDENCE_DIR=" + str(root) + "\n")
        stream.write("LOCALAPPDATA=" + str(root) + "\n")
    print("PASS: fresh synthetic evidence " + str(root))
    print("EVIDENCE_SOURCE_SHA=" + sha + " RUN=" + run_id + "/" + attempt)
    return root


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=("authorize", "verify-source", "lint", "prepare-evidence"))
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument("--source", type=Path)
    args = parser.parse_args()
    try:
        if args.mode == "lint":
            verify_workflow(args.root / ".github" / "workflows" / "home-qa-manual.yml")
        elif args.mode == "prepare-evidence":
            prepare_evidence(os.environ, args.root)
        elif args.mode == "authorize":
            sha = authorize(os.environ, args.root)
            envfile = os.environ.get("GITHUB_ENV", "")
            require(bool(envfile) and Path(envfile).is_file(), "missing trusted GitHub env file")
            with open(envfile, "a", encoding="utf-8", newline="\n") as file:
                file.write("QA_ALLOWED_SHA=" + sha + "\n")
            print("PASS: approved HOME QA source SHA " + sha)
        else:
            require(bool(args.source), "source path required")
            verify_source(args.source, os.environ.get("QA_ALLOWED_SHA", ""))
            print("TESTED_SOURCE_SHA=" + os.environ["QA_ALLOWED_SHA"])
        return 0
    except (ValueError, OSError, subprocess.CalledProcessError, subprocess.TimeoutExpired) as error:
        print(str(error), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
