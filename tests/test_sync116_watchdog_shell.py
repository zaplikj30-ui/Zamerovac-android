"""Linux-only Bash unit probe; never starts WSL, Java, HOME or a real kill."""
import ast
from pathlib import Path
import shutil
import subprocess
import sys
import unittest


@unittest.skipUnless(sys.platform == "linux" and shutil.which("bash"),
                     "requires isolated Linux Bash; never use Windows bash/WSL")
class WatchdogShellTests(unittest.TestCase):
    def probe(self, heartbeat):
        source = Path(__file__).resolve().parents[1] / "tools/sync116_home_qa.py"
        tree = ast.parse(source.read_text(encoding="utf-8"))
        launch = next(n for n in tree.body if isinstance(n, ast.FunctionDef)
                      and n.name == "launch_wsl")
        script = next(n.value.value for n in launch.body if isinstance(n, ast.Assign)
                      and any(isinstance(t, ast.Name) and t.id == "linux" for t in n.targets))
        # Execute only the actual background watcher; all signals and sleeps
        # are harmless shell functions. Trace successful reads before EOF.
        watcher = script.split('child="$!"\n', 1)[1].split('watch="$!"', 1)[0]
        watcher = watcher.replace('[ "$heartbeat" = "QA117_ALIVE" ] || break',
            '[ "$heartbeat" = "QA117_ALIVE" ] || break\n   echo accepted')
        probe = ('set -eu\nchild=12345\n'
                 'kill() { echo "signal $*"; }\nsleep() { :; }\n' +
                 watcher + '\nwait "$!"\n')
        result = subprocess.run([shutil.which("bash"), "-c", probe], input=heartbeat,
                                text=True, capture_output=True, timeout=3)
        self.assertEqual(0, result.returncode, result.stderr)
        return result.stdout.splitlines()

    def test_valid_heartbeat_is_read_before_eof_cleanup(self):
        self.assertEqual(["accepted", "signal -TERM -- -12345", "signal -KILL -- -12345"],
                         self.probe("QA117_ALIVE\n"))

    def test_eof_or_wrong_heartbeat_requests_bounded_cleanup(self):
        for heartbeat in ("", "not-approved\n"):
            with self.subTest(heartbeat=heartbeat):
                self.assertEqual(["signal -TERM -- -12345", "signal -KILL -- -12345"],
                                 self.probe(heartbeat))


if __name__ == "__main__":
    unittest.main()
