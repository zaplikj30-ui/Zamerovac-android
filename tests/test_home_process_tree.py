"""Real disposable Linux process tests; Windows never launches bash or WSL here."""
import json
import importlib.util
import os
from pathlib import Path
import select
import signal
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
PROBE = ROOT / 'tools/home_process_tree_probe.py'


class RuntimeGuardTests(unittest.TestCase):
    def load_probe(self):
        spec = importlib.util.spec_from_file_location('home_probe_guards', PROBE)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module

    def test_root_or_windows_never_starts_a_process(self):
        p = self.load_probe()
        for system, uid in [('win32', 1000), ('linux', 0)]:
            with self.subTest(system=system, uid=uid), \
                 mock.patch.object(p.sys, 'platform', system), \
                 mock.patch.object(p.os, 'geteuid', return_value=uid, create=True), \
                 mock.patch.object(p.subprocess, 'Popen') as spawn:
                with self.assertRaises(p.Blocked):
                    p.run_probe()
                spawn.assert_not_called()

    def test_foreign_or_changed_group_is_not_signalled(self):
        p = self.load_probe()
        child = mock.Mock(pid=123456)
        with mock.patch.object(p.os, 'killpg') as killer:
            for anchor in [None, {'pid': 1},
                           {'pid': child.pid, 'pgid': child.pid, 'sid': child.pid,
                            'uid': -1, 'start': 1}]:
                with self.assertRaises(p.Blocked):
                    p.request_stop(child, anchor, signal.SIGTERM)
            killer.assert_not_called()

    @unittest.skipUnless(sys.platform == 'linux' and os.geteuid() != 0, 'nonroot Linux only')
    def test_missing_kernel_reaper_support_blocks_before_spawn(self):
        p = self.load_probe()
        with mock.patch.object(p.ctypes, 'CDLL') as libc, \
             mock.patch.object(p.subprocess, 'Popen') as spawn:
            libc.return_value.prctl.return_value = -1
            with self.assertRaises(p.Blocked):
                p.run_probe()
            spawn.assert_not_called()


@unittest.skipUnless(sys.platform == 'linux' and os.geteuid() != 0,
                     'nonroot Linux process probe only; HOME Windows/WSL NOT RUN')
class ProcessTreeTests(unittest.TestCase):
    def test_published_readiness_is_never_partial_json(self):
        with tempfile.TemporaryDirectory(prefix='zamerovac-home-tree-',dir='/tmp') as name, \
             tempfile.TemporaryDirectory(prefix='qa-slow-writer-') as injection:
            work=Path(name)
            Path(injection,'sitecustomize.py').write_text(
                'from pathlib import Path\nimport time\noriginal=Path.write_text\n'
                'def slow(self,data,*a,**k):\n'
                ' if self.parent.name.startswith("zamerovac-home-tree-") and self.suffix==".json":\n'
                '  self.touch();time.sleep(.2)\n'
                ' return original(self,data,*a,**k)\nPath.write_text=slow\n')
            env={**os.environ,'PYTHONPATH':injection}
            child=subprocess.Popen([sys.executable,str(PROBE),'--fixture','leaf','--work',name],env=env,
                                   stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
            try:
                deadline=time.monotonic()+2
                ready=work/'leaf.json'
                while not ready.exists():
                    self.assertLess(time.monotonic(),deadline)
                    time.sleep(.002)
                self.assertEqual(json.loads(ready.read_text())['pid'],child.pid)
            finally:
                child.kill();child.wait(timeout=2);child.stdout.close();child.stderr.close()

    def scenario(self, mode):
        with tempfile.TemporaryDirectory(prefix='home-outside-') as outside:
            sentinel = Path(outside) / 'sentinel.bin'
            sentinel.write_bytes(b'outside original\x00\xff')
            # Own unrelated process, outside the probe's new session/group.
            neighbour = subprocess.Popen([sys.executable, '-c', 'import time; time.sleep(12)'])
            writer = None
            if mode == 'client-exit':
                writer = subprocess.Popen([sys.executable, '-c',
                    'import os,time; os.write(1,b"QA_ALIVE\\n"); time.sleep(6)'], stdout=subprocess.PIPE)
            command = [sys.executable, str(PROBE), '--probe']
            if mode == 'fault':
                # A real missing-signal negative, not a fake successful kill.
                # The supervisor retains its separate emergency cleanup path.
                code = ('import sys; sys.path.insert(0, sys.argv.pop(1)); '
                        'import home_process_tree_probe as p; '
                        'p.request_stop=lambda *args: None; sys.exit(p.main())')
                command = [sys.executable, '-c', code, str(ROOT / 'tools'), '--probe']
            if mode == 'normal':
                command.append('--normal')
            proc = subprocess.Popen(command, stdin=writer.stdout if writer else subprocess.PIPE, stdout=subprocess.PIPE,
                                    stderr=subprocess.PIPE, text=True)
            sender = None
            stop = threading.Event()
            try:
                ready, _, _ = select.select([proc.stdout], [], [], 4)
                self.assertTrue(ready, 'probe did not announce a verified group')
                line = proc.stdout.readline()
                self.assertTrue(line, proc.stderr.read() if proc.poll() is not None else 'no READY')
                start = json.loads(line)
                self.assertEqual(start['event'], 'ready')
                members = start['members']
                self.assertEqual(len(members), 3)
                self.assertEqual(len({p['pid'] for p in members}), 3)
                self.assertNotIn(neighbour.pid, [p['pid'] for p in members])
                self.assertTrue(all(Path('/proc', str(p['pid'])).exists() for p in members))
                if mode in ('eof', 'fault'):
                    proc.stdin.close()
                elif mode == 'client-exit':
                    writer.kill(); writer.wait(timeout=2)
                elif mode == 'cancel':
                    proc.send_signal(signal.SIGTERM)
                elif mode == 'token-cancel':
                    proc.stdin.write('QA_CANCEL\n');proc.stdin.flush()
                elif mode == 'invalid':
                    proc.stdin.write('WRONG\n'); proc.stdin.flush()
                elif mode in ('normal', 'timeout'):
                    def heartbeat():
                        while not stop.wait(.05):
                            try:
                                proc.stdin.write('QA_ALIVE\n'); proc.stdin.flush()
                            except (OSError, ValueError):
                                break
                    sender = threading.Thread(target=heartbeat)
                    sender.start()
                # heartbeat-loss deliberately leaves the pipe open, no messages.
                proc.wait(timeout=5)
                tail = proc.stdout.read()
                errors = proc.stderr.read()
                final = json.loads(tail.strip().splitlines()[-1])
                if mode == 'fault':
                    self.assertEqual(proc.returncode, 77, errors + tail)
                    self.assertEqual(final['status'], 'BLOCKED')
                else:
                    self.assertEqual(proc.returncode, 0, errors + tail)
                    self.assertEqual(final['status'], 'PASS')
                    reason = {'heartbeat-loss': 'heartbeat-timeout', 'client-exit': 'eof','token-cancel':'cancel'}.get(mode, mode)
                    self.assertEqual(final['reason'], reason)
                    self.assertTrue(final['cleanupVerified'])
                    self.assertEqual(final['workloadExitCode'], 0 if mode == 'normal' else -signal.SIGKILL)
                # A zombie still has /proc identity; it is not counted as reaped.
                for member in members:
                    self.assertFalse(Path('/proc', str(member['pid'])).exists(), member)
                self.assertFalse(Path(start['workspace']).exists())
                self.assertEqual(sentinel.read_bytes(), b'outside original\x00\xff')
                self.assertIsNone(neighbour.poll(), 'unrelated process was killed')
                print(json.dumps({'scenario': mode, 'ready': start, 'result': final,
                                  'outsideSentinel': 'unchanged', 'outsideProcess': 'alive'}), flush=True)
            finally:
                stop.set()
                if sender:
                    sender.join(timeout=1)
                if proc.stdin and not proc.stdin.closed:
                    try:
                        proc.stdin.close()
                    except BrokenPipeError:
                        pass
                if proc.poll() is None:
                    proc.send_signal(signal.SIGTERM)
                    try:
                        proc.wait(timeout=5)
                    except subprocess.TimeoutExpired:
                        proc.kill(); proc.wait(timeout=2)
                proc.stdout.close(); proc.stderr.close()
                if writer:
                    if writer.poll() is None:
                        writer.kill(); writer.wait(timeout=2)
                    writer.stdout.close()
                neighbour.terminate(); neighbour.wait(timeout=2)

    def test_normal_completion_also_reaps_descendants(self):
        self.scenario('normal')

    def test_eof(self):
        self.scenario('eof')

    def test_timeout_with_live_heartbeat(self):
        self.scenario('timeout')

    def test_cancel(self):
        self.scenario('cancel')

    def test_invalid_communication(self):
        self.scenario('invalid')

    def test_silent_broken_communication(self):
        self.scenario('heartbeat-loss')

    def test_missing_real_signals_is_blocked_and_emergency_recovery_is_scoped(self):
        self.scenario('fault')

    def test_client_process_death_closes_communication(self):
        self.scenario('client-exit')

    def test_windows_bridge_cancel_protocol(self):
        self.scenario('token-cancel')


if __name__ == '__main__':
    unittest.main()
