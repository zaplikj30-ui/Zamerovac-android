"""Bounded, synthetic WSL process-tree probe. Never runs Gradle or Android.

Review before HOME use. Linux --selftest checks the same Bash, not Windows/WSL.
No filesystem access outside unique owned /tmp probe paths in WSL.
"""
import argparse
import os
import platform
import subprocess
import sys

DISTRO = "Zamerovac-Ubuntu-QA"
# The script runs under an existing nonroot WSL user; no escalation or installation.
BASH_PROBE = r'''set -Eeuo pipefail
if [ "$(id -u)" -eq 0 ]; then echo 'BLOCKED: root user'; exit 77; fi
mode="$1"
case "$mode" in normal|eof|invalid|timeout) ;; *) exit 78;; esac
umask 077
work="$(mktemp -d /tmp/zamerovac-safe-probe.XXXXXXXX)"
sentinel="$(mktemp /tmp/zamerovac-safe-sentinel.XXXXXXXX)"
printf 'untouched-by-probe\n' > "$sentinel"
child=""; watch=""; child_pid=""
cleanup() {
  rc=$?
  trap - EXIT HUP INT TERM
  if [ -n "$watch" ]; then kill "$watch" 2>/dev/null || true; fi
  if [ -n "$child" ]; then
    group="$(ps -o pgid= -p "$child" 2>/dev/null | tr -d '[:space:]' || true)"
    if [ "$group" = "$child" ]; then
      kill -TERM -- "-$child" 2>/dev/null || true
      sleep 0.2
      kill -KILL -- "-$child" 2>/dev/null || true
    fi
    wait "$child" 2>/dev/null || true
  fi
  if [ "$(cat "$sentinel")" != 'untouched-by-probe' ]; then
    echo 'FAIL: outside sentinel altered'; rc=1
  fi
  rm -f -- "$sentinel"
  rm -rf -- "$work"
  exit "$rc"
}
trap cleanup EXIT HUP INT TERM
if [ "$mode" = normal ]; then duration=0.5; else duration=7; fi
# Unique process group. Only its own PID/PGID may be signalled.
setsid bash -c 'sleep "$1" & echo "$!" > "$2"; wait' _ "$duration" "$work/child.pid" &
child="$!"
for i in 1 2 3 4 5 6 7 8 9 10; do
  [ -s "$work/child.pid" ] && break
  sleep 0.1
done
[ -s "$work/child.pid" ] || { echo 'FAIL child PID missing'; exit 81; }
child_pid="$(cat "$work/child.pid")"
case "$child:$child_pid" in *[!0-9:]*|'') echo 'FAIL invalid PID'; exit 82;; esac
group="$(ps -o pgid= -p "$child" | tr -d '[:space:]')"
child_group="$(ps -o pgid= -p "$child_pid" | tr -d '[:space:]')"
[ "$group" = "$child" ] && [ "$child_group" = "$child" ] || {
  echo 'FAIL process group mismatch'; exit 83; }
echo "SCOPED_PID=$child CHILD_PID=$child_pid GROUP=$group MODE=$mode"
(
  while true; do
    if IFS= read -r -t 2 heartbeat; then
      [ "$heartbeat" = 'QA_PROBE_ALIVE' ] || break
    else
      break
    fi
  done
  kill -TERM -- "-$child" 2>/dev/null || true
  sleep 0.2
  kill -KILL -- "-$child" 2>/dev/null || true
) <&0 &
watch="$!"
set +e
wait "$child"
child_rc=$?
set -e
kill "$watch" 2>/dev/null || true
wait "$watch" 2>/dev/null || true
watch=""
# Both child and parent must no longer be running. Zombies are not proof of activity.
for pid in "$child" "$child_pid"; do
  state="$(ps -o stat= -p "$pid" 2>/dev/null | tr -d ' ' || true)"
  case "$state" in ''|Z*|z*) ;; *) echo "FAIL active descendant PID=$pid state=$state"; exit 84;; esac
done
[ "$(cat "$sentinel")" = 'untouched-by-probe' ] || exit 85
printf 'PASS scoped process termination mode=%s child_rc=%s\n' "$mode" "$child_rc"
'''

def run_bash(mode: str, use_wsl: bool) -> tuple[int, str]:
    args = (["wsl.exe", "--distribution", DISTRO, "--exec", "/bin/bash", "-c", BASH_PROBE, "_", mode]
            if use_wsl else ["/bin/bash", "-c", BASH_PROBE, "_", mode])
    proc = subprocess.Popen(args, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                            stderr=subprocess.STDOUT, text=True)
    try:
        if mode == "normal":
            proc.stdin.write("QA_PROBE_ALIVE\n")
            proc.stdin.flush()
        elif mode == "invalid":
            proc.stdin.write("INVALID\n")
            proc.stdin.flush()
            proc.stdin.close()
        elif mode == "eof":
            proc.stdin.close()
        # Timeout scenario: parent intentionally keeps stdin open without a heartbeat.
        rc = proc.wait(timeout=14)
        output = proc.stdout.read() if proc.stdout else ""
        return rc, output
    finally:
        if proc.stdin and not proc.stdin.closed:
            proc.stdin.close()
        if proc.poll() is None:
            proc.kill()
            proc.wait(timeout=5)

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--selftest-linux", action="store_true",
                        help="Same synthetic Bash test in isolated Linux, not Windows proof")
    parser.add_argument("--run-home", action="store_true",
                        help="Existing Windows QA runner only, after independent approval")
    opts = parser.parse_args()
    if opts.selftest_linux == opts.run_home:
        parser.error("choose exactly one mode")
    if opts.run_home:
        if platform.system() != "Windows" or os.environ.get("USERNAME", "").lower() != "zamerovacqa":
            print("BLOCKED: requires existing ZamerovacQA Windows service account")
            return 77
        expected = {"GITHUB_REPOSITORY": "zaplikj30-ui/Zamerovac-android",
                    "GITHUB_ACTOR": "zaplikj30-ui", "GITHUB_TRIGGERING_ACTOR": "zaplikj30-ui",
                    "GITHUB_RUN_ATTEMPT": "1", "RUNNER_NAME": "Zamerovac-Win11-QA",
                    "GITHUB_EVENT_NAME": "push"}
        if (not os.environ.get("GITHUB_REF", "").startswith("refs/heads/qa/")
                or any(os.environ.get(k) != v for k, v in expected.items())):
            print("BLOCKED: missing owner-only Actions identity")
            return 78
    elif platform.system() != "Linux" or os.geteuid() == 0:
        print("BLOCKED: Linux selftest requires nonroot Linux user")
        return 79
    for mode in ("normal", "eof", "invalid", "timeout"):
        try:
            rc, output = run_bash(mode, use_wsl=opts.run_home)
        except (OSError, subprocess.TimeoutExpired) as error:
            print(f"FAIL {mode}: {type(error).__name__}: {error}")
            return 1
        print(output.rstrip())
        if rc or f"PASS scoped process termination mode={mode}" not in output:
            print(f"FAIL {mode}: returncode={rc}")
            return 1
    print("PASS: 4 bounded synthetic probes; no Gradle, Android or HOME product tests")
    return 0

if __name__ == "__main__":
    sys.exit(main())
