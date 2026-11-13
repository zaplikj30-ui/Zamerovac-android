"""Test-only nonroot Linux/WSL supervisor; never starts WSL, Gradle or Android.

Uses #117's EOF/heartbeat + independent session/group principle. The disposable
fixture is fixed, not an arbitrary command. No HOME workflow is connected.
"""
from __future__ import annotations

import argparse
import ctypes
import json
import os
from pathlib import Path
import platform
import selectors
import signal
import subprocess
import sys
import tempfile
import time


class Blocked(RuntimeError):
    pass


def require_runtime():
    if sys.platform != 'linux' or os.geteuid() == 0:
        raise Blocked('requires existing nonroot Linux/WSL; no root fallback')


def identity(pid):
    """Kernel identity including starttime; a zombie is still present."""
    try:
        base = Path('/proc') / str(pid)
        raw = (base / 'stat').read_text()
        fields = raw[raw.rfind(')') + 2:].split()
        return {'pid': pid, 'pgid': int(fields[2]), 'sid': int(fields[3]),
                'start': int(fields[19]), 'uid': base.stat().st_uid}
    except FileNotFoundError:
        return None


def group_members(pgid):
    result = []
    for entry in Path('/proc').iterdir():
        if entry.name.isdecimal():
            member = identity(int(entry.name))
            if member and member['pgid'] == pgid:
                result.append(member)
    return result


def check_anchor(child, anchor):
    # Never accept a caller-supplied PID, reap/release the leader before signalling,
    # or signal our own/client group. The anchor remains waitable through KILL.
    if (not anchor or anchor['pid'] != child.pid or
            anchor['pid'] in (os.getpid(), os.getpgrp()) or
            anchor['pgid'] != child.pid or anchor['sid'] != child.pid or
            anchor['uid'] != os.geteuid() or identity(child.pid) != anchor):
        raise Blocked('owned PID/starttime/UID/PGID/SID anchor changed')
    for member in group_members(child.pid):
        if member['uid'] != anchor['uid'] or member['sid'] != child.pid:
            raise Blocked('process escaped owned session')


def request_stop(child, anchor, sig):
    check_anchor(child, anchor)
    os.killpg(child.pid, sig)


def reap_group(child, pgid):
    exit_code = child.wait(timeout=2)
    deadline = time.monotonic() + 1
    while time.monotonic() < deadline:
        # The CLI is an isolated subreaper with only this fixed fixture subtree.
        try:
            while os.waitpid(-1, os.WNOHANG)[0]:
                pass
        except ChildProcessError:
            pass
        if not group_members(pgid):
            return exit_code
        time.sleep(.01)
    raise Blocked('owned descendants still present (including zombies)')


def cleanup_group(child, anchor):
    request_stop(child, anchor, signal.SIGTERM)
    time.sleep(.12)
    request_stop(child, anchor, signal.SIGKILL)
    return reap_group(child, child.pid)


def fixture(role, work, normal):
    """Fixed three-level tree. Every process independently expires within 6s."""
    require_runtime()
    if (work.is_symlink() or work.parent != Path('/tmp') or
            not work.name.startswith('zamerovac-home-tree-') or
            work.stat().st_uid != os.geteuid() or work.stat().st_mode & 0o077):
        raise Blocked('fixture directory must be private and owned')
    # Intentionally resist TERM to prove real KILL escalation and orphan reaping.
    signal.signal(signal.SIGTERM, signal.SIG_IGN)
    child = None
    try:
        if role != 'leaf':
            next_role = 'child' if role == 'leader' else 'leaf'
            child = subprocess.Popen([sys.executable, str(Path(__file__).resolve()),
                                      '--fixture', next_role, '--work', str(work)],
                                     stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                                     stderr=subprocess.DEVNULL)
        pending=work/(role+'.json.tmp')
        with pending.open('x') as output:
            output.write(json.dumps(identity(os.getpid())))
        os.replace(pending,work/(role+'.json'))
        started = time.monotonic()
        while time.monotonic() - started < 6:
            if role == 'leader' and normal and time.monotonic() - started > .35:
                (work / 'done').touch(exist_ok=True)
                # A normally exiting workload can still leave descendants.
                # Retain its zombie identity until the supervisor reaps the group.
                os._exit(0)
            time.sleep(.02)
    finally:
        if child:
            child.wait(timeout=3)


def run_probe(normal=False):
    require_runtime()
    # Adopt only this CLI's own orphaned grandchildren so every PID can be
    # waitpid-reaped; no root/capability/permission or other-process changes.
    libc = ctypes.CDLL(None, use_errno=True)
    prctl = getattr(libc, 'prctl', None)
    if prctl is None or prctl(36, 1, 0, 0, 0) != 0:  # PR_SET_CHILD_SUBREAPER, Linux/WSL2
        raise Blocked('kernel cannot provide private descendant reaping')
    cancelled = []
    old_handlers = {}
    for sig in (signal.SIGTERM, signal.SIGINT, signal.SIGHUP):
        old_handlers[sig] = signal.signal(sig, lambda signum, frame: cancelled.append(signum))
    child, anchor = None, None
    cleaned = False
    try:
        with tempfile.TemporaryDirectory(prefix='zamerovac-home-tree-', dir='/tmp') as name:
            work = Path(name)
            args = [sys.executable, str(Path(__file__).resolve()), '--fixture', 'leader', '--work', name]
            if normal:
                args.append('--normal')
            child = subprocess.Popen(args, start_new_session=True, stdin=subprocess.DEVNULL,
                                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            anchor = identity(child.pid)
            try:
                deadline = time.monotonic() + 2
                while not all((work / (r + '.json')).exists() for r in ('leader', 'child', 'leaf')):
                    if time.monotonic() > deadline:
                        raise Blocked('fixture failed to start its complete tree')
                    time.sleep(.01)
                members = [json.loads((work / (r + '.json')).read_text())
                           for r in ('leader', 'child', 'leaf')]
                check_anchor(child, anchor)
                if (len({p['pid'] for p in members}) != 3 or
                        any(identity(p['pid']) != p or p['pgid'] != child.pid or
                            p['sid'] != child.pid or p['uid'] != os.geteuid() for p in members)):
                    raise Blocked('fixture PID/group ownership not verified')
                print(json.dumps({'event': 'ready', 'workspace': name, 'members': members}), flush=True)
                started = last_beat = time.monotonic()
                buffer = b''
                with selectors.DefaultSelector() as selector:
                    selector.register(sys.stdin.fileno(), selectors.EVENT_READ)
                    while True:
                        now = time.monotonic()
                        if cancelled:
                            reason = 'cancel'; break
                        if normal and (work / 'done').exists():
                            reason = 'normal'; break
                        if now - started > 1.2:
                            reason = 'timeout'; break
                        if now - last_beat > .45:
                            reason = 'heartbeat-timeout'; break
                        if selector.select(.02):
                            data = os.read(sys.stdin.fileno(), 128)
                            if not data:
                                reason = 'eof'; break
                            buffer += data
                            if len(buffer) > 128:
                                reason = 'invalid'; break
                            lines = buffer.split(b'\n')
                            buffer = lines.pop()
                            if b'QA_CANCEL' in lines:
                                reason = 'cancel'; break
                            if any(line != b'QA_ALIVE' for line in lines):
                                reason = 'invalid'; break
                            if lines:
                                last_beat = now
                workload_exit = cleanup_group(child, anchor)
                cleaned = True
                remaining = [identity(p['pid']) for p in members]
                if any(now and now['start'] == before['start']
                       for before, now in zip(members, remaining)):
                    raise Blocked('original fixture process survived cleanup')
                result = {'status': 'PASS', 'reason': reason, 'cleanupVerified': True,
                          'platform': platform.platform(), 'uid': os.geteuid(),
                          'signals': ['TERM', 'KILL'], 'reaped': [p['pid'] for p in members]}
                result['workloadExitCode'] = workload_exit
            finally:
                if not cleaned and child:
                    # Failures remain BLOCKED even if this emergency recovery works.
                    # Keep the unreaped anchor while signalling this owned group only.
                    check_anchor(child, anchor)
                    os.killpg(child.pid, signal.SIGKILL)
                    reap_group(child, child.pid)
        print(json.dumps(result), flush=True)
        return 0
    finally:
        for sig, handler in old_handlers.items():
            signal.signal(sig, handler)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--probe', action='store_true')
    parser.add_argument('--normal', action='store_true')
    parser.add_argument('--fixture', choices=('leader', 'child', 'leaf'), help=argparse.SUPPRESS)
    parser.add_argument('--work', type=Path, help=argparse.SUPPRESS)
    args = parser.parse_args()
    try:
        require_runtime()
        if args.fixture and args.work and not args.probe:
            fixture(args.fixture, args.work, args.normal)
            return 0
        if not args.probe or args.work or args.fixture:
            raise Blocked('explicit --probe required; HOME execution not authorized')
        return run_probe(args.normal)
    except (Blocked, OSError, ValueError, subprocess.TimeoutExpired) as error:
        print(json.dumps({'status': 'BLOCKED', 'reason': str(error)}), flush=True)
        return 77


if __name__ == '__main__':
    sys.exit(main())
