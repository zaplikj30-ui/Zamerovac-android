"""Read exact old Git blobs as inert offline QUICK fixtures (no Git history/fetch).

These bytes were obtained from the explicitly reviewed old commit SHA,
not the current checkout. Any missing/changed/symlinked fixture is a FAIL.
"""
import hashlib
from pathlib import Path
import stat

DEFAULT = Path(__file__).resolve().parents[1] / 'fixtures' / 'qa-history'
FILES = {
    'integrity': ('a3cc8eb3/qa-integrity.cjs.txt',
                  'f25616f9751d701339e92195d7913176a4827980'),
    'workflow': ('a3cc8eb3/windows-self-hosted-qa.yml.txt',
                 '12e820d4664d1ff8f696fb9e67d1e1095ade841f'),
}


def historical_bytes(key, root=DEFAULT):
    if key not in FILES:
        raise ValueError('QA HISTORICAL BLOCKED: unsupported reference')
    name, expected = FILES[key]
    base = Path(root)
    target = base / name
    metadata = target.lstat()
    if (not stat.S_ISREG(metadata.st_mode) or metadata.st_nlink != 1 or
            not 0 < metadata.st_size <= 32768 or
            target.resolve(strict=True) != target.absolute()):
        raise ValueError('QA HISTORICAL BLOCKED: fixture type, path or bound')
    before = target.stat()
    data = target.read_bytes()
    after = target.stat()
    if ((before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns) !=
            (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns) or
            len(data) != before.st_size or
            hashlib.sha1(b'blob ' + str(len(data)).encode('ascii') + bytes([0]) + data).hexdigest() != expected):
        raise ValueError('QA HISTORICAL BLOCKED: byte hash mismatch')
    return data


def historical_text(key, root=DEFAULT):
    return historical_bytes(key, root).decode('utf-8')
