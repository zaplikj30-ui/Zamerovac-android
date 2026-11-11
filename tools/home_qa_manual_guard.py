#!/usr/bin/env python3
"""Trusted-main-only authorizer for manual HOME QA; no arbitrary source ref.

This file and the workflow must be executed from a reviewed main commit.
Update ALLOWED_SOURCE_SHAS only after an independent source review.
"""
from __future__ import annotations

import argparse
import hashlib
import os
from pathlib import Path
import re
import subprocess
import sys

OWNER = "zaplikj30-ui"
REPO = "zaplikj30-ui/Zamerovac-android"
SHA = re.compile(r"[a-f0-9]{40}\Z")
# Approved target for the first stage only; adding SHA requires reviewed main change.
ALLOWED_SOURCE_SHAS = frozenset({
    "3f2779ec9b5c432296f9db2bad8502cc4ff63588",  # PR #105 2026-11-11
})
WORKFLOW_SHA256 = "5f847ba6306ad274d9d0836d1c8a3a649eefc1425ed6f74c06c8dd79edc9149e"


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


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=("authorize", "verify-source", "lint"))
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument("--source", type=Path)
    args = parser.parse_args()
    try:
        if args.mode == "lint":
            verify_workflow(args.root / ".github" / "workflows" / "home-qa-manual.yml")
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
