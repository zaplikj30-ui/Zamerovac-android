"""Cloud C source/synthetic unit tests; no npm, HOME, browser, network or Actions."""
import base64
import hashlib
import json
import os
from pathlib import Path
import signal
import stat
import sys
import tempfile
import threading
import time
import unittest
from unittest import mock
import qa_cloud_provision as q


class ProvisionTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='qa-c-provision-test-')
        self.addCleanup(self.tmp.cleanup)
        self.stage = Path(self.tmp.name) / 'stage'
        self.stage.mkdir(mode=0o700)
        self.log = self.stage / 'private.log'
        self.log.touch(mode=0o600)

    def launch(self, code, seconds=35):
        return q.run_group([sys.executable, '-c', code], self.stage, {},
                           (time.time() + seconds) * 1000, self.log)

    def test_positive_process_exits_and_reaps(self):
        self.assertTrue(self.launch("print('synthetic')")
                        and self.log.read_text().strip() == 'synthetic')

    def test_nonzero_process_rejected(self):
        with self.assertRaises(q.Blocked):
            self.launch('raise SystemExit(77)')

    def test_orphan_descendant_rejected_not_false_pass(self):
        child = ('import subprocess,sys;subprocess.Popen([sys.executable,"-c",'
                 '"import time;time.sleep(5)"],start_new_session=False)')
        with self.assertRaises(q.Blocked):
            self.launch(child)

    def test_cancel_sigterm_reaps_group(self):
        def cancel():
            time.sleep(.25)
            os.kill(os.getpid(), signal.SIGTERM)
        t = threading.Thread(target=cancel, daemon=True)
        t.start()
        with self.assertRaises(q.Blocked):
            self.launch('import time;time.sleep(8)')
        t.join(1)

    def test_too_short_deadline_blocks_before_spawn(self):
        with mock.patch.object(q.subprocess, 'Popen', side_effect=AssertionError('spawn')):
            with self.assertRaises(q.Blocked):
                self.launch('print(1)', 2)

    def test_token_oidc_proxy_npmrc_node_preload_never_in_child(self):
        tainted = {k: 'CANARY' for k in (
            'GITHUB_TOKEN', 'GH_TOKEN', 'ACTIONS_RUNTIME_TOKEN',
            'ACTIONS_ID_TOKEN_REQUEST_TOKEN', 'QA_CLOUD_METADATA_TOKEN',
            'HTTPS_PROXY', 'HTTP_PROXY', 'ALL_PROXY', 'NODE_OPTIONS',
            'NODE_PATH', 'npm_config_userconfig', 'NPM_CONFIG__AUTH')}
        child = q.isolated_env(self.stage, tainted, '/usr/bin')
        self.assertTrue(set(tainted).isdisjoint(child))
        self.assertNotIn('CANARY', repr(child))
        self.assertEqual(child['NPM_CONFIG_USERCONFIG'], '/dev/null')
        self.assertEqual(child['NPM_CONFIG_REGISTRY'], 'https://registry.npmjs.org/')

    def test_symlink_hardlink_and_world_writable_file_rejected(self):
        file = self.stage / 'input'
        file.write_bytes(b'synthetic')
        self.assertEqual(q.checked_file(file), b'synthetic')
        os.chmod(file, 0o666)
        with self.assertRaises(q.Blocked):
            q.checked_file(file)
        os.chmod(file, 0o600)
        alias = self.stage / 'alias'
        alias.symlink_to(file)
        with self.assertRaises(q.Blocked):
            q.checked_file(alias)
        hard = self.stage / 'hard'
        os.link(file, hard)
        with self.assertRaises(q.Blocked):
            q.checked_file(file)

    def test_unsafe_runner_parent_and_safe_0755(self):
        parent = Path(self.tmp.name)
        q.runner_directory(parent)
        mode = stat.S_IMODE(parent.stat().st_mode)
        try:
            os.chmod(parent, 0o755)
            q.runner_directory(parent)
            os.chmod(parent, 0o777)
            with self.assertRaises(q.Blocked):
                q.runner_directory(parent)
        finally:
            os.chmod(parent, mode)

    def test_unexpected_tree_and_symbolic_file_rejected(self):
        modules = self.stage / 'modules'
        modules.mkdir()
        for name in ('playwright', 'playwright-core'):
            sub = modules / name
            sub.mkdir()
            (sub / 'package.json').write_text('{"version":"1.62.1"}')
        self.assertEqual(len(q.exact_tree(modules, ('playwright','playwright-core'))), 2)
        (modules / 'foreign').write_text('unreviewed')
        with self.assertRaises(q.Blocked):
            q.exact_tree(modules, ('playwright','playwright-core'))

    def test_lock_sri_version_registry_extra_and_dependency_mutations(self):
        target = self.stage / 'tools/qa-browser'
        target.mkdir(parents=True)
        integrity = 'sha512-' + base64.b64encode(hashlib.sha512(b'example').digest()).decode()
        packages = {'': {'dependencies': {'playwright': '1.62.1'}}}
        for name in q.REQUIRED:
            packages['node_modules/' + name] = {
                'version': '1.62.1',
                'resolved': f'https://registry.npmjs.org/{name}/-/{name}-1.62.1.tgz',
                'integrity': integrity}
        packages['node_modules/playwright']['dependencies'] = {'playwright-core':'1.62.1'}
        packages['node_modules/fsevents'] = {'os':['darwin']}
        manifest = {'lockfileVersion':3, 'packages': packages}
        (target / 'package.json').write_text(json.dumps({'dependencies':{'playwright':'1.62.1'}}))
        lock_file = target / 'package-lock.json'
        lock_file.write_text(json.dumps(manifest))
        self.assertEqual(q.validate_lock(lock_file.read_bytes(), (target / 'package.json').read_bytes())['lockfileVersion'],3)
        with self.assertRaises(q.Blocked):
            q.locked_package(self.stage)  # synthetic bytes are NOT reviewed Git blobs
        edits = [
            lambda x: x['packages']['node_modules/playwright'].update(version='1.62.0'),
            lambda x: x['packages']['node_modules/playwright'].update(integrity='sha512-BAD'),
            lambda x: x['packages'].update({'node_modules/unknown':{}}),
            lambda x: x['packages']['node_modules/playwright-core'].update(resolved='http://evil.invalid'),
            lambda x: x['packages']['node_modules/playwright'].update(
                dependencies={'playwright-core':'1.62.0'})]
        for mutate in edits:
            altered = json.loads(json.dumps(manifest))
            mutate(altered)
            lock_file.write_text(json.dumps(altered))
            with self.assertRaises((q.Blocked, ValueError, KeyError)):
                q.validate_lock(lock_file.read_bytes(), (target / 'package.json').read_bytes())



class ArchiveBinding(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='qa-c-tar-synthetic-')
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name) / 'private'
        self.root.mkdir(mode=0o700)
        (self.root / 'archives').mkdir(mode=0o700)
        self.files = {}
        for name in q.REQUIRED:
            data = {f'f{n}.js': (name + str(n)).encode() for n in range(6)}
            self.write_tgz(name, data)
            for file, content in data.items():
                self.files['node_modules/' + name + '/' + file] = q.sha(content)

    def write_tgz(self, name, contents, wrong_type=False):
        import io
        import tarfile
        archive = self.root / 'archives' / (name + '.tgz')
        with tarfile.open(archive, 'w:gz') as tar:
            for file, content in contents.items():
                info = tarfile.TarInfo('package/' + file)
                info.size = len(content)
                if wrong_type:
                    info.type = tarfile.SYMTYPE
                    info.linkname = 'unreviewed'
                tar.addfile(info, io.BytesIO(content) if not wrong_type else None)

    def test_tarball_bytes_match_installed_tree(self):
        q.verify_tarball_contents(self.root, self.files)

    def test_tampered_installed_hash_or_archive_symlink_is_blocked(self):
        wrong = dict(self.files)
        wrong['node_modules/playwright/f0.js'] = '0' * 64
        with self.assertRaises(q.Blocked):
            q.verify_tarball_contents(self.root, wrong)
        self.write_tgz('playwright', {'bad.js':b'evil'}, wrong_type=True)
        with self.assertRaises(q.Blocked):
            q.verify_tarball_contents(self.root, self.files)


if __name__ == '__main__':
    unittest.main()
