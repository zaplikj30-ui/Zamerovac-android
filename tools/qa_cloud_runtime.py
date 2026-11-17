"""Cloud-only reviewed R/D pre-exec verification; HOME path remains unchanged.

An inventory or a string claiming the right package version is NOT authorization.
Python and Node independently consume precisely the same R manifest and SHA.
"""
import base64
import hashlib
import json
import os
from pathlib import Path
import stat
import sys

MANIFEST = Path(__file__).with_name('qa-cloud-runtime.json')
LOCK = Path(__file__).parent / 'qa-browser' / 'package-lock.json'


def stop():
    raise RuntimeError('QA CLOUD BLOCKED: pre-exec runtime/provenance unavailable')


def demand(value):
    if not value:
        stop()


def checked(filename, limit=128 * 1024 * 1024):
    p = Path(filename)
    demand(p.is_absolute() and str(p.resolve(strict=True)) == str(p))
    metadata = p.lstat()
    demand(stat.S_ISREG(metadata.st_mode) and metadata.st_nlink == 1
           and 0 < metadata.st_size <= limit)
    before = p.stat()
    with p.open('rb') as stream:
        data = stream.read(limit + 1)
    after = p.stat()
    demand(len(data) == before.st_size and
           (before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns)
           == (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns))
    return data


def sha(data):
    return hashlib.sha256(data).hexdigest()


def exactly_tree(root, files):
    folder = Path(root)
    demand(folder.is_absolute() and str(folder.resolve(strict=True)) == str(folder))
    demand(isinstance(files, dict) and len(files) > 10)
    module_root = folder / 'node_modules'
    demand(str(module_root.resolve(strict=True)) == str(module_root))
    found = []
    def walk(parent):
        for item in parent.iterdir():
            st = item.lstat()
            demand(not stat.S_ISLNK(st.st_mode))
            if stat.S_ISDIR(st.st_mode):
                walk(item)
            else:
                demand(stat.S_ISREG(st.st_mode))
                found.append(item.relative_to(folder).as_posix())
    walk(module_root)
    demand(sorted(found) == sorted(files))
    demand(any(k.startswith('node_modules/playwright/') for k in files))
    demand(any(k.startswith('node_modules/playwright-core/') for k in files))
    for name, expected in files.items():
        demand(name.startswith(('node_modules/playwright/', 'node_modules/playwright-core/'))
               and name not in ('.', '..') and all(x not in ('', '.', '..') for x in name.split('/'))
               and len(expected) == 64
               and all(c in '0123456789abcdef' for c in expected))
        demand(sha(checked(folder / name)) == expected)


def verified_runtime():
    e = os.environ
    demand(e.get('ZAMEROVAC_QA_MODE') == 'cloud' and
           e.get('ZAMEROVAC_CLOUD_TRUST') == 'trusted-host/change-detection')
    demand(not e.get('ZAMEROVAC_CLOUD_IMMUTABLE_CLAIM')
           and not e.get('NODE_OPTIONS') and not e.get('NODE_PATH'))
    temporary = e.get('ZAMEROVAC_CLOUD_RUNTIME_FILE')
    if temporary:
        folder = Path(e.get('ZAMEROVAC_CLOUD_SCRATCH', ''))
        demand(folder.is_absolute() and folder.resolve() == folder and
               folder.stat().st_uid == os.geteuid() and stat.S_IMODE(folder.stat().st_mode) == 0o700
               and str(folder / 'runtime.json') == temporary)
    raw = checked(temporary or MANIFEST, 4 * 1024 * 1024)
    expected = e.get('ZAMEROVAC_CLOUD_RUNTIME_SHA256', '')
    demand(len(expected) == 64 and sha(raw) == expected)
    r = json.loads(raw)
    demand(r.get('schema') == (2 if temporary else 1) and r.get('runtimeApproved') is True
           and r.get('trustModel') == 'trusted-host/change-detection')
    demand(r.get('productSha') == '3886fcf80213e4693464d3f30104885c1c58f53e'
           and r.get('validatorSha') == e.get('ZAMEROVAC_CLOUD_REVIEWED_V_SHA')
           and r.get('eventSha') == e.get('ZAMEROVAC_CLOUD_EVENT_SHA'))
    demand(sys.platform == 'linux' and os.geteuid() > 0
           and r.get('linuxUid') == os.geteuid())
    demand(r.get('imageOS') == e.get('ImageOS') and
           r.get('imageVersion') == e.get('ImageVersion'))
    for name in ('node', 'python'):
        binary = r.get(name)
        demand(isinstance(binary, dict) and
               len(binary.get('sha256', '')) == 64)
        if name == 'python':
            demand(Path(sys.executable).resolve() == Path(binary['path']))
        demand(sha(checked(binary['path'])) == binary['sha256'])
    chromium = r.get('chromium')
    demand(isinstance(chromium, dict)
           and chromium.get('magic') == '7f454c46'
           and len(chromium.get('sha256', '')) == 64)
    demand(checked(chromium['path'], 1024 * 1024 * 1024)[:4] == b'\x7fELF')
    demand(sha(checked(chromium['path'], 1024 * 1024 * 1024)) == chromium['sha256'])
    pw = r.get('playwright')
    demand(isinstance(pw, dict))
    exactly_tree(pw['root'], pw['files'])
    locked = json.loads(checked(LOCK, 64 * 1024))['packages']
    for name in ('playwright', 'playwright-core'):
        expected = locked['node_modules/' + name]
        archive = pw['archives'][name]
        demand(expected['version'] == '1.62.1'
               and archive['integrity'] == expected['integrity'])
        digest = base64.b64encode(hashlib.sha512(
            checked(archive['path'], 64 * 1024 * 1024)).digest()).decode('ascii')
        demand('sha512-' + digest == archive['integrity'])
        package = Path(pw['root']) / 'node_modules' / name / 'package.json'
        demand(json.loads(checked(package))['version'] == '1.62.1')
    if temporary:
        demand(r.get('scratch') == str(folder) and pw['root'] == str(folder / 'deps'))
        demand(r.get('lockSha256') == sha(checked(LOCK, 64 * 1024)))
        spec = json.loads(checked(Path(pw['root']) / 'node_modules/playwright-core/browsers.json'))
        revision = next(b['revision'] for b in spec['browsers'] if b['name'] == 'chromium')
        demand(chromium.get('revision') == revision and
               Path(chromium['path']).is_relative_to(folder / 'browsers') and
               ('chromium-' + revision) in Path(chromium['path']).parts)
        st = Path(chromium['path']).stat()
        identity = {'dev':str(st.st_dev), 'ino':str(st.st_ino), 'size':str(st.st_size),
                    'mtimeNs':str(st.st_mtime_ns), 'mode':str(st.st_mode)}
        demand(chromium.get('identity') == identity)
    return r
