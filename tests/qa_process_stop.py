"""Persistent admission/STOP for Linux process tests, not a process supervisor.

Reserve BEFORE spawning. Only known-safe cleanup releases it. UNKNOWN ends the
whole unittest interpreter (including without failfast), retains evidence and
blocks later invocations/other checkouts. No TTL, PID recovery or reset command.
"""
import json
import os
from pathlib import Path
import stat
import sys

# Fixed sticky /tmp, independent of checkout, HOME, TMPDIR or per-job temp.
# Only the Linux-owned test suite creates this admission; Windows stays SKIP.
MARKER=Path('/tmp')/('zamerovac-qa-process-tests-'+str(os.geteuid())+'.blocked') if os.name=='posix' and hasattr(os,'geteuid') else None
EXIT_BLOCKED=78  # Also consumed by tools/local-qa.cjs; never worker exit77.


def abort():
    # Test HARNESS only, never the supervisor/owner. Model tests use stub owners.
    # SystemExit/self.fail are caught by unittest and would continue the suite.
    try:
        sys.stderr.write('PROCESS_TESTS_BLOCKED_STOP_NO_RETRY\n')
        sys.stderr.flush()
        sys.stdout.flush()
    finally:
        os._exit(EXIT_BLOCKED)


def require_available():
    if MARKER is None:return
    try:MARKER.lstat()
    except FileNotFoundError:return
    except BaseException:abort()
    abort()


# unittest discovery imports the process suite before executing any test body.
# A fresh interpreter must reject a retained quarantine, not just the next
# OwnedRunnerTests method. This also rejects dangling links and unreadable state.
require_available()


class Admission:
    def __init__(self,path,identity):
        self.path=path
        self.identity=identity

    def check(self):
        meta=self.path.lstat()
        if (not stat.S_ISDIR(meta.st_mode) or stat.S_IMODE(meta.st_mode)!=0o700
                or meta.st_uid!=os.geteuid() or (meta.st_dev,meta.st_ino)!=self.identity):
            raise OSError('admission identity unknown')

    def retain_evidence(self,folder):
        try:
            self.check()
            meta=folder.lstat()
            if not stat.S_ISDIR(meta.st_mode) or meta.st_uid!=os.geteuid() or stat.S_IMODE(meta.st_mode)!=0o700:
                raise OSError('private evidence identity unknown')
            fd=os.open(self.path/'evidence.json',os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
            with os.fdopen(fd,'w',encoding='utf8') as out:
                # Private pointer only. Never print it or raw logs publicly.
                json.dump({'schema':1,'evidenceDirectory':str(folder)},out)
                out.flush();os.fsync(out.fileno())
        except BaseException:abort()

    def block(self,**observations):
        try:
            self.check()
            fd=os.open(self.path/'unknown.json',os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
            with os.fdopen(fd,'w',encoding='utf8') as out:
                keys=('ownerStopped','protocolKnown','cleanupKnown','neighbourStopped',
                      'senderStopped','channelCleanup','filesRemoved','releaseVerified')
                json.dump({'schema':1,**{k:observations[k] is True for k in keys if k in observations}},out)
                out.flush();os.fsync(out.fileno())
        except BaseException:pass  # The existing admission remains quarantined.
        abort()

    def release_verified(self):
        try:
            self.check()
            (self.path/'evidence.json').unlink()
            self.path.rmdir()
        except BaseException:self.block(releaseVerified=False)


def claim():
    if sys.platform!='linux' or os.geteuid()==0:abort()
    try:
        parent=Path('/tmp').lstat()
        if not stat.S_ISDIR(parent.st_mode) or not parent.st_mode&stat.S_ISVTX:
            raise OSError('sticky temporary directory required')
        # Exclusive creation rejects ANY existing entry, including dangling
        # symlinks. Unwritable storage blocks before a process can be created.
        MARKER.mkdir(mode=0o700)
        meta=MARKER.lstat()
        admission=Admission(MARKER,(meta.st_dev,meta.st_ino))
        admission.check()
        return admission
    except BaseException:abort()
