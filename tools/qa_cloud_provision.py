"""One credential-free GitHub-hosted Playwright/Chromium provision, before browser QA.

No install on import. Trusted-host/change-detection, not a pidfd/security sandbox.
The standard workflow invokes --prepare exactly once after QUICK and before Q.
"""
import base64
import hashlib
import io
import json
import os
from pathlib import Path
import re
import select
import shutil
import signal
import stat
import subprocess
import sys
import tarfile
import time

STAGE = 'zamerovac-cloud-stage'
FINAL = 'zamerovac-cloud-final'
LOCK_PACKAGES = {'', 'node_modules/playwright', 'node_modules/playwright-core', 'node_modules/fsevents'}
REQUIRED = ('playwright', 'playwright-core')
LOCK_BLOB = '2901dfe9699efa4edbeab7e9655f4462228c39e9'
PACKAGE_BLOB = 'cd80df5950316c233785c4c96768d836689c79f5'
P_SHA = '3886fcf80213e4693464d3f30104885c1c58f53e'
MAX_REPORT = 8 * 1024 * 1024
MAX_LOG = 1024 * 1024
MAX_FILES = 20000
MAX_TOTAL = 2 * 1024 * 1024 * 1024


class Blocked(Exception):
    pass


def require(ok):
    if not ok:
        raise Blocked('provisioning contract rejected')


def private_directory(p):
    p = Path(p)
    s = p.lstat()
    require(p.is_absolute() and str(p.resolve(strict=True)) == str(p)
            and stat.S_ISDIR(s.st_mode) and s.st_uid == os.geteuid()
            and stat.S_IMODE(s.st_mode) == 0o700)
    return p


def runner_directory(p):
    # RUNNER_TEMP itself can be 0755 on standard hosted Ubuntu; only our child
    # staging area is required to be mode 0700. Never accept a writable parent.
    p = Path(p)
    st = p.lstat()
    require(p.is_absolute() and str(p.resolve(strict=True)) == str(p)
            and stat.S_ISDIR(st.st_mode) and st.st_uid == os.geteuid()
            and (st.st_mode & 0o022) == 0)
    return p


def checked_file(p, limit=128 * 1024 * 1024):
    p = Path(p)
    s = p.lstat()
    require(p.is_absolute() and str(p.resolve(strict=True)) == str(p)
            and stat.S_ISREG(s.st_mode) and s.st_nlink == 1
            and 0 < s.st_size <= limit and (s.st_mode & 0o022) == 0)
    data = p.read_bytes()
    after = p.lstat()
    require((s.st_dev, s.st_ino, s.st_size, s.st_mtime_ns) ==
            (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns))
    return data


def sha(data):
    return hashlib.sha256(data).hexdigest()


def hash_file(p, limit=1024 * 1024 * 1024):
    p = Path(p)
    s = p.lstat()
    require(p.is_absolute() and str(p.resolve(strict=True)) == str(p)
            and stat.S_ISREG(s.st_mode) and s.st_nlink == 1 and 0 < s.st_size <= limit
            and (s.st_mode & 0o022) == 0)
    d = hashlib.sha256()
    with p.open('rb') as f:
        while True:
            b = f.read(1024 * 1024)
            if not b:
                break
            d.update(b)
    t = p.lstat()
    require((s.st_dev, s.st_ino, s.st_size, s.st_mtime_ns) ==
            (t.st_dev, t.st_ino, t.st_size, t.st_mtime_ns))
    return {'sha256': d.hexdigest(), 'size': s.st_size}


def exact_tree(root, allowed_roots):
    root = Path(root)
    require(str(root.resolve(strict=True)) == str(root))
    records = {}
    total = 0
    def visit(d):
        nonlocal total
        require(len(records) <= MAX_FILES)
        for item in d.iterdir():
            st = item.lstat()
            require(not stat.S_ISLNK(st.st_mode) and (st.st_mode & 0o022) == 0)
            if stat.S_ISDIR(st.st_mode):
                visit(item)
            else:
                require(stat.S_ISREG(st.st_mode) and st.st_nlink == 1)
                rel = item.relative_to(root).as_posix()
                require(any(rel.startswith(prefix + '/') for prefix in allowed_roots)
                        and '..' not in Path(rel).parts and rel not in records)
                total += st.st_size
                require(total <= MAX_TOTAL)
                records[rel] = hash_file(item)
    visit(root)
    require(0 < len(records) <= MAX_FILES)
    return records


def git_blob_sha1(data):
    return hashlib.sha1(b'blob ' + str(len(data)).encode('ascii') + b'\0' + data).hexdigest()


def locked_package(source):
    root = Path(source).resolve(strict=True)
    lock_path = root / 'tools/qa-browser/package-lock.json'
    package_path = root / 'tools/qa-browser/package.json'
    lock_bytes = checked_file(lock_path, 64 * 1024)
    package_bytes = checked_file(package_path, 64 * 1024)
    require(git_blob_sha1(lock_bytes) == LOCK_BLOB and
            git_blob_sha1(package_bytes) == PACKAGE_BLOB)
    return validate_lock(lock_bytes, package_bytes), lock_bytes, package_bytes


def validate_lock(lock_bytes, package_bytes):
    # Pure contract parser used by synthetic tests; production always verifies
    # the two exact reviewed Git blobs before calling this parser.
    lock = json.loads(lock_bytes)
    package = json.loads(package_bytes)
    require(lock.get('lockfileVersion') == 3
            and set(lock.get('packages', {})) == LOCK_PACKAGES
            and package.get('dependencies') == {'playwright': '1.62.1'}
            and lock['packages'][''].get('dependencies') == package['dependencies'])
    for name in REQUIRED:
        entry = lock['packages']['node_modules/' + name]
        integrity = entry.get('integrity')
        require(entry.get('version') == '1.62.1'
                and entry.get('resolved') == f'https://registry.npmjs.org/{name}/-/{name}-1.62.1.tgz'
                and isinstance(integrity, str)
                and re.fullmatch(r'sha512-[A-Za-z0-9+/]+={0,2}', integrity))
        digest = base64.b64decode(integrity[7:], validate=True)
        require(len(digest) == 64)
    require(lock['packages']['node_modules/fsevents'].get('os') == ['darwin']
            and lock['packages']['node_modules/playwright'].get('dependencies')
            == {'playwright-core': '1.62.1'})
    return lock


def isolated_env(stage, env, path_value):
    """Absolutely no ambient GitHub/OIDC/proxy/npmrc/preload secret inheritance."""
    root = private_directory(stage)
    result = {'PATH': path_value, 'HOME': str(root / 'home'),
              'TMPDIR': str(root / 'tmp'), 'TMP': str(root / 'tmp'),
              'TEMP': str(root / 'tmp'), 'LANG': 'C.UTF-8',
              'NPM_CONFIG_USERCONFIG': '/dev/null',
              'NPM_CONFIG_GLOBALCONFIG': '/dev/null',
              'NPM_CONFIG_CACHE': str(root / 'npm-cache'),
              'NPM_CONFIG_REGISTRY': 'https://registry.npmjs.org/',
              'NPM_CONFIG_AUDIT': 'false', 'NPM_CONFIG_FUND': 'false',
              'NPM_CONFIG_UPDATE_NOTIFIER': 'false',
              'PLAYWRIGHT_BROWSERS_PATH': str(root / 'browsers')}
    for folder in ('home', 'tmp', 'npm-cache', 'browsers'):
        (root / folder).mkdir(mode=0o700)
        private_directory(root / folder)
    require(not any(k.startswith(('GITHUB_', 'ACTIONS_', 'RUNNER_', 'QA_CLOUD_', 'NODE_',
                                   'GH_', 'INPUT_', 'CI_', 'HTTP_', 'HTTPS_', 'ALL_',
                                   'NO_', 'npm_config_')) for k in result))
    require(not any('TOKEN' in k or 'PROXY' in k or 'AUTH' in k or 'OIDC' in k for k in result))
    return result


def group_exists(pgid):
    try:
        os.killpg(pgid, 0)
        return True
    except ProcessLookupError:
        return False
    except PermissionError:
        raise Blocked('process group not owned')


def stop_group(proc):
    """Best-effort group termination, then positive group absence proof.

    This is NOT equivalent to pidfd containment, especially for escaped groups.
    """
    pgid = proc.pid
    if group_exists(pgid):
        os.killpg(pgid, signal.SIGTERM)
    deadline = time.monotonic() + 3.0
    while time.monotonic() < deadline and group_exists(pgid):
        time.sleep(.05)
    if group_exists(pgid):
        os.killpg(pgid, signal.SIGKILL)
    deadline = time.monotonic() + 3.0
    while time.monotonic() < deadline and group_exists(pgid):
        time.sleep(.05)
    try:
        proc.wait(timeout=1)
    except subprocess.TimeoutExpired:
        raise Blocked('leader cannot be reaped')
    require(not group_exists(pgid))


def run_group(command, cwd, env, deadline_ms, log_file):
    """No shell, bounded I/O, new process group, no success with group survivors."""
    require(isinstance(command, list) and command and Path(command[0]).is_absolute())
    require(all(isinstance(x, str) and '\0' not in x for x in command))
    remain = deadline_ms / 1000.0 - time.time()
    require(remain > 30)
    before = time.monotonic()
    cancelled = []
    def cancel(sig, _frame):
        # Never interrupt Popen halfway through start: preserve its process
        # handle, then terminate/reap the entire known group in finally.
        cancelled.append(sig)
    old_term, old_int = signal.getsignal(signal.SIGTERM), signal.getsignal(signal.SIGINT)
    signal.signal(signal.SIGTERM, cancel)
    signal.signal(signal.SIGINT, cancel)
    process = None
    try:
        process = subprocess.Popen(command, cwd=cwd, env=env, stdin=subprocess.DEVNULL,
                                   stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                   close_fds=True, start_new_session=True)
    except BaseException:
        signal.signal(signal.SIGTERM, old_term)
        signal.signal(signal.SIGINT, old_int)
        raise
    child_status = None
    outstanding = False
    total = 0
    try:
        with open(log_file, 'ab', buffering=0) as private_log:
            fd = process.stdout.fileno()
            eof = False
            while not eof or process.poll() is None:
                require(not cancelled)
                require(time.monotonic() - before < remain - 10)
                ready, _, _ = select.select([fd], [], [], .2) if not eof else ([], [], [])
                if ready:
                    chunk = os.read(fd, 65536)
                    if chunk:
                        total += len(chunk)
                        require(total <= MAX_LOG)
                        private_log.write(chunk)
                    else:
                        eof = True
            require(not cancelled)
            child_status = process.wait(timeout=1)
            outstanding = group_exists(process.pid)
        # An orphan in the group is NEVER success, even if it can be killed.
        require(child_status == 0 and not outstanding)
        return True
    finally:
        # Keep SIGTERM/INT intercepted throughout cleanup; a second cancel must
        # not interrupt reaping and accidentally permit a later browser step.
        signal.signal(signal.SIGTERM, signal.SIG_IGN)
        signal.signal(signal.SIGINT, signal.SIG_IGN)
        try:
            stop_group(process)
        finally:
            process.stdout.close()
            signal.signal(signal.SIGTERM, old_term)
            signal.signal(signal.SIGINT, old_int)


def normalize_npm_tree(deps):
    modules = Path(deps) / 'node_modules'
    bin_dir = modules / '.bin'
    if bin_dir.exists():
        require(bin_dir.is_dir() and not bin_dir.is_symlink())
        for child in bin_dir.iterdir():
            require(child.name in ('playwright', 'playwright-core') and child.is_symlink())
            child.unlink()
        bin_dir.rmdir()
    hidden = modules / '.package-lock.json'
    if hidden.exists():
        require(hidden.is_file() and not hidden.is_symlink() and hidden.stat().st_nlink == 1)
        hidden.unlink()
    require(set(p.name for p in modules.iterdir()) == set(REQUIRED))


def approved_archives(stage, lock):
    stage = private_directory(stage)
    deps = stage / 'deps'
    archdir = stage / 'archives'
    archdir.mkdir(mode=0o700)
    out = {}
    for name in REQUIRED:
        item = lock['packages']['node_modules/' + name]
        digest = base64.b64decode(item['integrity'][7:], validate=True).hex()
        src = stage / 'npm-cache/_cacache/content-v2/sha512' / digest[:2] / digest[2:4] / digest[4:]
        contents = checked_file(src, 64 * 1024 * 1024)
        require('sha512-' + base64.b64encode(hashlib.sha512(contents).digest()).decode() == item['integrity'])
        dest = archdir / (name + '.tgz')
        with dest.open('xb') as handle:
            handle.write(contents)
        os.chmod(dest, 0o600)
        out[name] = {'rel': 'archives/' + name + '.tgz', 'integrity': item['integrity']}
    return out


def verified_modules(stage, lock):
    stage = private_directory(stage)
    mods = stage / 'deps/node_modules'
    tree = exact_tree(mods, ('playwright', 'playwright-core'))
    rels = {('node_modules/' + name): row['sha256'] for name, row in tree.items()}
    require(len(rels) > 10)
    for name in REQUIRED:
        pkg = json.loads(checked_file(mods / name / 'package.json'))
        require(pkg.get('version') == '1.62.1')
    require(all((Path(k).parts[1] in REQUIRED) for k in rels))
    return rels


def verify_tarball_contents(stage, files):
    # Lockfile SRI alone is insufficient: prove that the installed JS byte tree
    # is precisely the contents of the verified npm tarballs before CLI executes.
    stage = private_directory(stage)
    require(isinstance(files, dict) and len(files) > 10)
    for name in REQUIRED:
        archive = checked_file(stage / 'archives' / (name + '.tgz'), 64 * 1024 * 1024)
        observed = {}
        total = 0
        with tarfile.open(fileobj=io.BytesIO(archive), mode='r:gz') as tar:
            for member in tar:
                require(member.name == 'package' or member.name.startswith('package/'))
                relative = member.name[len('package/'):].strip('/') if member.name != 'package' else ''
                require(relative == '' or all(p not in ('', '.', '..') for p in relative.split('/')))
                if member.isdir():
                    continue
                require(member.isfile() and relative)
                key = 'node_modules/' + name + '/' + relative
                require(key not in observed and 0 <= member.size <= 128 * 1024 * 1024)
                total += member.size
                require(total <= MAX_TOTAL and len(observed) < MAX_FILES)
                content = tar.extractfile(member).read(member.size + 1)
                require(len(content) == member.size)
                observed[key] = sha(content)
        expected = {key: value for key, value in files.items()
                    if key.startswith('node_modules/' + name + '/')}
        require(observed == expected and len(expected) > 1)


def required_ffmpeg(stage, revision):
    # Playwright 1.62.1 registry/index.ts maps linux-x64/linux-arm64 to
    # ffmpeg-<browsers.json revision>/ffmpeg-linux (never an arbitrary file).
    stage = private_directory(stage)
    require(isinstance(revision, str) and re.fullmatch(r'[0-9]{3,7}', revision))
    binary = stage / 'browsers' / ('ffmpeg-' + revision) / 'ffmpeg-linux'
    st = binary.lstat()  # NO follow: a symlink cannot stand in for this binary.
    require(stat.S_ISREG(st.st_mode) and st.st_nlink == 1 and
            st.st_uid == os.geteuid() and stat.S_IMODE(st.st_mode) & stat.S_IXUSR and
            (st.st_mode & 0o022) == 0 and st.st_size > 4 and
            str(binary.resolve(strict=True)) == str(binary))
    require(checked_file(binary, 128 * 1024 * 1024)[:4] == b'\x7fELF')
    digest = hash_file(binary, 128 * 1024 * 1024)
    require(digest['size'] == st.st_size)
    return binary, digest


def resolved_browser(stage, node, childenv, lock):
    stage = private_directory(stage)
    deps = stage / 'deps'
    cli = deps / 'node_modules/playwright/cli.js'
    checked_file(cli)
    # No unowned Node subprocess or second install during verification.
    browsers_json = json.loads(checked_file(deps / 'node_modules/playwright-core/browsers.json'))
    revision = next((x['revision'] for x in browsers_json['browsers'] if x['name'] == 'chromium'), None)
    ffmpeg = next((x['revision'] for x in browsers_json['browsers'] if x['name'] == 'ffmpeg'), None)
    require(re.fullmatch('[0-9]{3,7}', str(revision))
            and re.fullmatch('[0-9]{3,7}', str(ffmpeg)))
    name = stage / 'browsers' / ('chromium-' + revision) / 'chrome-linux64/chrome'
    require(name.is_file() and name.is_relative_to(stage / 'browsers')
            and checked_file(name, 1024 * 1024 * 1024)[:4] == b'\x7fELF')
    # Playwright writes install bookkeeping in .links; never hand it to the
    # browser worker. No unknown siblings or ad-hoc browser executable.
    browser_root = stage / 'browsers'
    links = browser_root / '.links'
    if links.exists():
        require(links.is_dir() and not links.is_symlink())
        for item in links.iterdir():
            st = item.lstat()
            require(stat.S_ISREG(st.st_mode) and st.st_nlink == 1)
            item.unlink()
        links.rmdir()
    # The reviewed Playwright CLI also downloads its pinned ffmpeg companion.
    # Permit exactly the two browser.json revisions, not arbitrary extra bins.
    require(set(p.name for p in browser_root.iterdir())
            == {'chromium-' + revision, 'ffmpeg-' + ffmpeg})
    ffmpeg_binary, _ = required_ffmpeg(stage, ffmpeg)
    return name, revision, ffmpeg, ffmpeg_binary


def prepare(env=None):
    env = dict(os.environ if env is None else env)
    require(sys.platform == 'linux' and os.geteuid() > 0)
    runner = runner_directory(env['RUNNER_TEMP'])
    stage = runner / STAGE
    require(not stage.exists() and not stage.is_symlink())
    source = Path(env['ZAMEROVAC_QA_VALIDATOR_ROOT']).resolve(strict=True)
    require((source / '.git').exists() and source.is_dir()
            and re.fullmatch('[a-f0-9]{40}', env.get('ZAMEROVAC_CLOUD_REVIEWED_V_SHA', ''))
            and re.fullmatch('[a-f0-9]{40}', env.get('ZAMEROVAC_CLOUD_EVENT_SHA', ''))
            and env.get('ZAMEROVAC_EXPECTED_PRODUCT_SHA') == P_SHA)
    # checkout@exact-commit is detached; reject changed HEAD before npm.
    require(checked_file(source / '.git/HEAD', 1024).decode().strip()
            == env['ZAMEROVAC_CLOUD_REVIEWED_V_SHA'])
    deadline_ms = int(env['ZAMEROVAC_CLOUD_DEADLINE'])
    require(time.time() * 1000 < deadline_ms < (time.time() + 200 * 60) * 1000 + 20000)
    lock, lock_data, package_data = locked_package(source)
    node = shutil.which('node', path=env['PATH'])
    npm = shutil.which('npm', path=env['PATH'])
    require(node is not None and npm is not None)
    node, npm = str(Path(node).resolve(strict=True)), str(Path(npm).resolve(strict=True))
    require(Path(node).is_file() and Path(npm).is_file())
    stage.mkdir(mode=0o700)
    private_directory(stage)
    deps = stage / 'deps'
    deps.mkdir(mode=0o700)
    (deps / 'package.json').write_bytes(package_data)
    (deps / 'package-lock.json').write_bytes(lock_data)
    childenv = isolated_env(stage, env, env['PATH'])
    log = stage / 'provision.log'
    with log.open('xb'):
        pass
    os.chmod(log, 0o600)
    try:
        # Exactly one npm ci. No retry, nested npm, npx or install fallback.
        run_group([npm, 'ci', '--ignore-scripts', '--no-audit', '--no-fund'],
                  deps, childenv, min(deadline_ms, int((time.time() + 420) * 1000)), log)
        normalize_npm_tree(deps)
        archives = approved_archives(stage, lock)
        files = verified_modules(stage, lock)
        verify_tarball_contents(stage, files)
        # CLI is invoked directly and only after the pinned integrity checks.
        run_group([node, str(deps / 'node_modules/playwright/cli.js'),
                   'install', 'chromium', '--no-shell'], deps, childenv,
                  min(deadline_ms, int((time.time() + 420) * 1000)), log)
        browser, revision, ffmpeg_revision, ffmpeg_binary = resolved_browser(stage, node, childenv, lock)
        browser_files = exact_tree(stage / 'browsers', ('chromium-' + revision,
                                                       'ffmpeg-' + ffmpeg_revision))
        require(browser.relative_to(stage / 'browsers').as_posix() in browser_files)
        ffmpeg_relative = ffmpeg_binary.relative_to(stage / 'browsers').as_posix()
        require(ffmpeg_relative in browser_files)
        ffmpeg_info = hash_file(ffmpeg_binary, 128 * 1024 * 1024)
        require(browser_files[ffmpeg_relative] == ffmpeg_info)
        output = {
            'schema': 1, 'complete': True,
            'lockSha256': sha(lock_data), 'packageSha256': sha(package_data),
            'productSha': env['ZAMEROVAC_EXPECTED_PRODUCT_SHA'],
            'validatorSha': env['ZAMEROVAC_CLOUD_REVIEWED_V_SHA'],
            'eventSha': env['ZAMEROVAC_CLOUD_EVENT_SHA'],
            'playwright': {'files': files, 'archives': archives},
            'chromium': {'relative': browser.relative_to(stage).as_posix(),
                         'revision': revision, 'ffmpegRevision': ffmpeg_revision,
                         'sha256': hash_file(browser)['sha256'],
                         'files': browser_files},
            'ffmpeg': {'relative': ffmpeg_binary.relative_to(stage).as_posix(),
                       'revision': ffmpeg_revision, 'magic': '7f454c46',
                       'sha256': ffmpeg_info['sha256'], 'size': ffmpeg_info['size']},
        }
        # Manifest stored inside the ONE root that will be atomically renamed.
        inventory = stage / 'inventory.json'
        with inventory.open('x', encoding='utf8') as handle:
            json.dump(output, handle, sort_keys=True)
        os.chmod(inventory, 0o600)
        digest = sha(checked_file(inventory, MAX_REPORT))
        output_file = env['GITHUB_OUTPUT']
        require(Path(output_file).is_absolute() and Path(output_file).is_file()
                and not Path(output_file).is_symlink())
        with open(output_file, 'a', encoding='ascii') as out:
            out.write('inventory_sha256=' + digest + '\n')
        return digest
    except BaseException:
        # Do not claim cleanup for provisioning on failure or cancellation.
        raise


def main():
    require(sys.argv[1:] == ['--prepare'])
    try:
        prepare()
        print('PASS CLOUD provisioning integrity + known-group cleanup; browser NOT RUN')
    except BaseException:
        print('BLOCKED CLOUD provisioning; STOP NO RETRY; Chromium NOT RUN', file=sys.stderr)
        raise SystemExit(78)


if __name__ == '__main__':
    main()
