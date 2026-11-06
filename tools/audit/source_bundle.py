#!/usr/bin/env python3
"""Auditor-only text export of tracked sources; never includes private keys or user files.

Run with: python3 tools/audit/source_bundle.py REPOSITORY_ROOT OUTPUT_DIRECTORY
The workflow checks out the exact released SHA to REPOSITORY_ROOT.
"""
from __future__ import annotations

import hashlib
import os
from pathlib import Path
import re
import subprocess
import sys

DOCS = {
    "START_ZDE.md", "AGENTS.md", "README.md", "DATOVY_FORMAT_A_PC_KOMPATIBILITA.md",
    "docs/audit39-fixes.md", "docs/architecture-39-boundaries.md",
    "docs/archive-v2.md", "docs/cloud-sync-v2.md",
    "docs/peer-transfer-v2.md", "docs/drive-api-integration.md",
    "docs/verzovani.md",
}
CONFIG = {
    "app/build.gradle", "build.gradle", "settings.gradle", "gradle.properties",
    "gradle/drive-registration.gradle", "config/app-version.properties",
    "config/drive-preview.properties", "app/src/main/AndroidManifest.xml",
}
TEXT_EXTENSIONS = {".java", ".xml", ".js", ".css", ".html", ".json",
                   ".gradle", ".properties", ".py", ".cjs", ".md", ".txt", ".sh", ".yml"}
BLOCKED_EXTENSIONS = {".p12", ".jks", ".keystore", ".pem", ".key", ".b64",
                      ".apk", ".db", ".sqlite", ".sqlite3", ".zip"}
SECRET_PATTERNS = [
    (re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----"),
     "[PRIVATE KEY REMOVED FOR EXTERNAL AUDIT]"),
    (re.compile(r"\bghp_[A-Za-z0-9]{20,}\b|\bgithub_pat_[A-Za-z0-9_]{20,}\b"),
     "[ACCESS TOKEN REMOVED]"),
    (re.compile(r"\bsk-ant-[A-Za-z0-9_-]{20,}\b|\bsk-[A-Za-z0-9]{30,}\b"),
     "[API KEY REMOVED]"),
]
CATEGORY_NAME = {
    1: "01_ANDROID_JAVA_KONFIGURACE",
    2: "02_WEB_EDITOR_SYNC",
    3: "03_AUTOMATICKE_TESTY",
    4: "04_DOKUMENTACE_WORKFLOWS",
}


def categorize(name: str) -> int | None:
    if name.endswith((".p12.b64", ".pem", ".key", ".jks", ".keystore")):
        return None
    p = Path(name)
    if p.suffix.lower() in BLOCKED_EXTENSIONS:
        return None
    if name.startswith("app/src/main/java/"):
        return 1 if p.suffix == ".java" else None
    if name in CONFIG or name.startswith("app/src/main/res/") and p.suffix == ".xml":
        return 1
    if (name.startswith("app/src/main/assets/") and "/licenses/" not in name
            and p.suffix in {".js", ".css", ".html"}) or (
            name.startswith("sync/") and p.suffix == ".js"):
        return 2
    if (name.startswith("app/src/test/") or name.startswith("tests/")
            or name.startswith("tools/") or name.startswith("qa/")):
        return 3 if p.suffix in TEXT_EXTENSIONS else None
    if name.startswith(".github/workflows/") or name in DOCS:
        return 4
    return None


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("Usage: source_bundle.py CHECKED_OUT_RELEASE OUTPUT_DIRECTORY")
    root = Path(sys.argv[1]).resolve()
    target = Path(sys.argv[2]).resolve()
    target.mkdir(parents=True, exist_ok=True)
    sha = subprocess.check_output(["git", "-C", str(root), "rev-parse", "HEAD"], text=True).strip()
    expected = os.environ.get("EXPECTED_RELEASE_COMMIT", sha)
    if expected != sha:
        raise RuntimeError("Wrong checkout SHA; refuse potentially misleading audit: " + sha)

    tracked_bytes = subprocess.check_output(["git", "-C", str(root), "ls-files", "-z"])
    tracked = [x.decode("utf-8") for x in tracked_bytes.split(b"\x00") if x]
    groups: dict[int, list[tuple[str, str, str, bool]]] = {i: [] for i in CATEGORY_NAME}
    excluded: list[str] = []
    total_redactions = 0
    for name in sorted(tracked):
        group = categorize(name)
        if group is None:
            excluded.append(name)
            continue
        raw = (root / name).read_bytes()
        if len(raw) > 3_000_000:
            raise RuntimeError("Unexpected enormous selected file: " + name)
        try:
            text = raw.decode("utf-8")
        except UnicodeError as exc:
            raise RuntimeError("Selected source is not valid UTF-8: " + name) from exc
        replaced = False
        for regex, replacement in SECRET_PATTERNS:
            text, count = regex.subn(replacement, text)
            if count:
                total_redactions += count
                replaced = True
        digest = hashlib.sha256(raw).hexdigest()
        groups[group].append((name, text, digest, replaced))

    if len(groups[1]) < 60 or len(groups[2]) < 25 or len(groups[3]) < 80:
        raise RuntimeError("Too few source files, reject incomplete audit package")
    manifest = [
        "ZAMEROVAC 1.3.0 – AUDITNI EXPORT – MANIFEST",
        "Source release commit: " + sha,
        "Generated directly from exact checked-out commit; not from current main.",
        "Production source plus automated tests and relevant reference documents.",
        "Excluded any binary signing keys, certificates, key material, APK/media and user data.",
        "A static source audit does not validate the installed APK on a physical device.",
        "Source code lines start at 1 after each BEGIN FILE marker.",
        "",
    ]
    for group, title in CATEGORY_NAME.items():
        paths = groups[group]
        manifest.append(f"{title}: {len(paths)} files")
        body = [
            f"ZAMEROVAC 1.3.0 – EXTERNAL AUDIT SOURCES – {title}",
            "Release commit: " + sha,
            "Each BEGIN FILE block identifies original repository path; count line numbers within it.",
            "DO NOT assume that reading a source file proves runtime, security or device behavior.",
            "",
        ]
        for name, text, digest, replaced in paths:
            manifest.append(f"  {name} | sha256={digest}" + (" | REDACTED" if replaced else ""))
            body.append("======== BEGIN FILE: " + name + " ========")
            body.append(text.rstrip("\n"))
            body.append("======== END FILE: " + name + " ========")
            body.append("")
        output = target / f"ZAMEROVAC_1_3_0_{title}.txt"
        output.write_text("\n".join(body) + "\n", encoding="utf-8")
        print(f"CREATED {output.name}: {len(paths)} files, {output.stat().st_size} bytes")

    manifest.extend(["", f"Redactions performed: {total_redactions}", "Excluded paths:"])
    manifest.extend("  " + name for name in excluded)
    (target / "00_CIST_NEJDRIVE_MANIFEST.txt").write_text("\n".join(manifest) + "\n", encoding="utf-8")
    print("PASS: complete selected source export from immutable release commit " + sha)


if __name__ == "__main__":
    main()
