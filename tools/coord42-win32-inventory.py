#!/usr/bin/env python3
"""Read-only Windows native-addon prerequisite inventory: no installs/builds/network."""
from __future__ import annotations

import ctypes
from ctypes import wintypes
import getpass
import os
from pathlib import Path
import re
import shutil
import struct
import sys

BRANCH = "refs/heads/qa/coord42-vs2026-inventory-20261115"

def emit(key: str, value: str) -> None:
    # Never print paths, secrets, user environment values or arbitrary tool output.
    assert re.fullmatch(r"[A-Z][A-Z0-9_]+", key)
    assert len(value) <= 96 and re.fullmatch(r"[A-Za-z0-9_.,-]+", value)
    print(f"{key}={value}", flush=True)

def yes(value: object) -> str:
    return "YES" if value else "NO"

def version(path: Path) -> str:
    """Read trusted PE file version resource; do NOT execute the candidate binary."""
    try:
        dll = ctypes.WinDLL("version.dll", use_last_error=True, winmode=0x800)
        dll.GetFileVersionInfoSizeW.argtypes = [wintypes.LPCWSTR, ctypes.POINTER(wintypes.DWORD)]
        dll.GetFileVersionInfoSizeW.restype = wintypes.DWORD
        dll.GetFileVersionInfoW.argtypes = [wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD, wintypes.LPVOID]
        dll.GetFileVersionInfoW.restype = wintypes.BOOL
        dll.VerQueryValueW.argtypes = [wintypes.LPCVOID, wintypes.LPCWSTR, ctypes.POINTER(ctypes.c_void_p), ctypes.POINTER(wintypes.UINT)]
        dll.VerQueryValueW.restype = wintypes.BOOL
        unused = wintypes.DWORD()
        size = dll.GetFileVersionInfoSizeW(str(path), ctypes.byref(unused))
        if not size or size > 8_000_000:
            return "UNKNOWN"
        data = ctypes.create_string_buffer(size)
        if not dll.GetFileVersionInfoW(str(path), 0, size, data):
            return "UNKNOWN"
        pointer, length = ctypes.c_void_p(), wintypes.UINT()
        if not dll.VerQueryValueW(data, "\\", ctypes.byref(pointer), ctypes.byref(length)) or length.value < 52:
            return "UNKNOWN"
        values = struct.unpack("<13I", ctypes.string_at(pointer.value, 52))
        if values[0] != 0xFEEF04BD:
            return "UNKNOWN"
        hi, lo = values[2], values[3]
        return f"{hi >> 16}.{hi & 65535}.{lo >> 16}.{lo & 65535}"
    except (OSError, ValueError, AttributeError, TypeError, OverflowError):
        return "UNKNOWN"

def safe_version(value: str) -> str:
    return value if re.fullmatch(r"[0-9]+(?:\.[0-9]+){1,3}", value) else "UNKNOWN"

def main() -> int:
    emit("CHECK", "COORD42_VS2026_INVENTORY")
    if sys.platform != "win32":
        emit("STATUS", "BLOCKED_NOT_WINDOWS")
        return 2
    if (getpass.getuser().lower() != "zamerovacqa" or
        os.environ.get("USERNAME", "").lower() != "zamerovacqa"):
        emit("STATUS", "BLOCKED_WRONG_ACCOUNT")
        return 2
    if (os.environ.get("GITHUB_REPOSITORY") != "zaplikj30-ui/Zamerovac-android" or
        os.environ.get("GITHUB_ACTOR") != "zaplikj30-ui" or
        os.environ.get("GITHUB_EVENT_NAME") != "push" or
        os.environ.get("GITHUB_REF") != BRANCH or
        os.environ.get("RUNNER_ENVIRONMENT") != "self-hosted"):
        emit("STATUS", "BLOCKED_UNTRUSTED_CONTEXT")
        return 2
    emit("SERVICE_ACCOUNT", "PASS")
    emit("PYTHON_VERSION", safe_version(".".join(map(str, sys.version_info[:3]))))
    roots = [Path(p) for p in (os.environ.get("ProgramFiles"), os.environ.get("ProgramFiles(x86)")) if p]
    msvc, clang = [], []
    for root in roots:
        vs = root / "Microsoft Visual Studio"
        if vs.is_dir():
            for year in ("2022", "18", "2026"):  # VS 2026 uses major-version folder 18
                for edition in ("BuildTools", "Community", "Professional", "Enterprise"):
                    vc = vs / year / edition / "VC" / "Tools"
                    msvc.extend(vc.glob("MSVC/*/bin/Hostx64/x64/cl.exe"))
                    clang.extend(vc.glob("Llvm/x64/bin/clang-cl.exe"))
        clang.append(root / "LLVM" / "bin" / "clang-cl.exe")
    msvc = sorted({str(p).lower(): p for p in msvc if p.is_file()}.values(), key=str)
    clang = sorted({str(p).lower(): p for p in clang if p.is_file()}.values(), key=str)
    emit("MSVC_CL_FOUND", yes(msvc))
    emit("MSVC_CL_VERSIONS", ",".join(safe_version(version(p)) for p in msvc[:3]) if msvc else "NONE")
    emit("CLANG_CL_FOUND", yes(clang))
    emit("CLANG_CL_VERSIONS", ",".join(safe_version(version(p)) for p in clang[:3]) if clang else "NONE")

    sdk = []
    for root in roots:
        kits = root / "Windows Kits" / "10"
        include = kits / "Include"
        if include.is_dir():
            for folder in include.glob("10.*"):
                v = folder.name
                if (folder / "um" / "Windows.h").is_file() and (folder / "shared" / "minwindef.h").is_file() and (folder / "ucrt" / "stdio.h").is_file() and (kits / "Lib" / v / "um" / "x64" / "kernel32.lib").is_file() and (kits / "Lib" / v / "ucrt" / "x64" / "ucrt.lib").is_file():
                    sdk.append(v)
    sdk = sorted(set(sdk))
    emit("WINDOWS_SDK_FOUND", yes(sdk))
    emit("WINDOWS_SDK_VERSIONS", ",".join(sdk[-2:]) if sdk else "NONE")

    node_path = shutil.which("node.exe") or shutil.which("node")
    node_file = Path(node_path) if node_path else None
    emit("NODE_EXE_FOUND", yes(node_file and node_file.is_file()))
    node_version = safe_version(version(node_file)) if node_file and node_file.is_file() else "UNKNOWN"
    emit("NODE_FILE_VERSION", node_version)
    node_core = ".".join(node_version.split(".")[:3]) if node_version != "UNKNOWN" else "UNKNOWN"
    headers = []
    if node_file:
        headers.append(node_file.parent / "include" / "node")
    for root in roots:
        headers.append(root / "nodejs" / "include" / "node")
    local_app, user = os.environ.get("LOCALAPPDATA"), os.environ.get("USERPROFILE")
    if node_core != "UNKNOWN":
        if local_app:
            headers.append(Path(local_app) / "node-gyp" / "Cache" / node_core / "include" / "node")
        if user:
            headers.append(Path(user) / ".node-gyp" / node_core / "include" / "node")
    headers = [p for p in headers if (p / "node_api.h").is_file()]
    emit("NODE_API_HEADERS_FOUND", yes(headers))
    libs = []
    for header in headers:
        base = header.parent.parent
        libs.extend((base / "x64" / "node.lib", base / "node.lib", header / "node.lib"))
    emit("NODE_IMPORT_LIBRARY_FOUND", yes(any(p.is_file() for p in libs)))
    emit("NODE_GYP_COMMAND_FOUND", yes(shutil.which("node-gyp.cmd") or shutil.which("node-gyp")))
    emit("COMPILER_EXECUTED", "NO")
    emit("NATIVE_BUILD_EXECUTED", "NO")
    emit("NATIVE_ADDON_LOADED", "NO")
    emit("BINARY_PROVENANCE_VERIFIED", "NO")
    emit("OUTER_JOB_NESTING_TESTED", "NO")
    emit("STATUS", "INVENTORY_COMPLETE_NOT_BUILD_PROOF")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
