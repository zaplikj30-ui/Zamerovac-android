"""Cloud C source/synthetic unit tests; no npm, HOME, browser, network or Actions."""
import base64
import hashlib
import json
import os
import platform
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
        self.root = Path(self.tmp.name)
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

    def test_real_preflight_identifies_each_gate_without_npm_or_writes(self):
        source = self.root / 'validator'
        target = source / 'tools/qa-browser'
        target.mkdir(parents=True)
        for name in ('package.json', 'package-lock.json'):
            (target / name).write_bytes((Path(__file__).parent / 'qa-browser' / name).read_bytes())
        (source / '.git').mkdir()
        (source / '.git/HEAD').write_text('b' * 40)
        env = {'RUNNER_TEMP': str(self.root), 'PATH': os.environ['PATH'],
               'ZAMEROVAC_QA_VALIDATOR_ROOT': str(source),
               'ZAMEROVAC_CLOUD_REVIEWED_V_SHA': 'b' * 40,
               'ZAMEROVAC_CLOUD_EVENT_SHA': 'c' * 40,
               'ZAMEROVAC_EXPECTED_PRODUCT_SHA': q.P_SHA,
               'ZAMEROVAC_CLOUD_DEADLINE': str(int((time.time()+600)*1000))}
        with mock.patch.object(q.subprocess, 'Popen', side_effect=AssertionError('npm must not run')) as spawn:
            before = set(self.root.iterdir())
            result = q.preflight(env)
            self.assertEqual(result[0], self.root / q.STAGE)
            self.assertEqual(set(self.root.iterdir()), before)
            for changed, phase in [
                ({'RUNNER_TEMP': str(self.root / 'absent')}, 'ADMISSION_RUNNER'),
                ({'ZAMEROVAC_EXPECTED_PRODUCT_SHA': 'd'*40}, 'ADMISSION_CHECKOUT'),
                ({'ZAMEROVAC_CLOUD_REVIEWED_V_SHA': 'd'*40}, 'ADMISSION_CHECKOUT'),
                ({'ZAMEROVAC_CLOUD_EVENT_SHA': 'invalid'}, 'ADMISSION_CHECKOUT'),
                ({'ZAMEROVAC_CLOUD_DEADLINE': '0'}, 'ADMISSION_DEADLINE'),
                ({'PATH': ''}, 'ADMISSION_TOOLS')]:
                with self.subTest(phase=phase), self.assertRaises(q.Blocked) as error:
                    q.preflight({**env, **changed})
                self.assertEqual(error.exception.args, (phase,))
            stage = self.root / q.STAGE
            stage.mkdir(mode=0o700)
            with self.assertRaises(q.Blocked) as error:
                q.preflight(env)
            self.assertEqual(error.exception.args, ('ADMISSION_STAGE',))
            stage.rmdir()
            (target / 'package-lock.json').write_text('{}')
            with self.assertRaises(q.Blocked) as error:
                q.preflight(env)
            self.assertEqual(error.exception.args, ('ADMISSION_LOCK',))
            spawn.assert_not_called()

    def test_phase_diagnostic_is_fixed_and_never_exception_text(self):
        import contextlib
        import io
        def fail():
            raise RuntimeError('SECRET_TOKEN /private/path https://secret.invalid')
        for phase in sorted(q.PHASES):
            with self.assertRaises(q.Blocked) as result:
                q.provision_step(phase, fail)
            self.assertEqual(result.exception.args, (phase,))
            output = io.StringIO()
            with mock.patch.object(q.sys, 'argv', ['provision', '--prepare']), mock.patch.object(q, 'prepare', side_effect=result.exception), contextlib.redirect_stderr(output):
                with self.assertRaises(SystemExit) as exit_result:
                    q.main()
            self.assertEqual(exit_result.exception.code, 78)
            self.assertIn('phase='+phase, output.getvalue())
            self.assertNotIn('SECRET', output.getvalue())
        with self.assertRaises(q.Blocked):
            q.provision_step('SECRET_TOKEN', lambda: None)

    def test_distinct_private_npm_config_real_cli(self):
        # Real config initialization only: synthetic hosted step never installs.
        import shutil
        import subprocess
        npm = shutil.which('npm')
        if npm is None:
            self.skipTest('real npm unavailable')
        child = q.isolated_env(self.stage, {}, os.environ['PATH'])
        config = Path(child['NPM_CONFIG_GLOBALCONFIG'])
        self.assertNotEqual(child['NPM_CONFIG_USERCONFIG'], str(config))
        self.assertEqual(config.read_bytes(), b'')
        self.assertEqual(stat.S_IMODE(config.stat().st_mode), 0o600)
        self.assertEqual(child['NPM_CONFIG_FETCH_RETRIES'], '0')
        command = [npm, 'config', 'get', 'registry']
        old = dict(child, NPM_CONFIG_GLOBALCONFIG='/dev/null')
        failed = subprocess.run(command, cwd=self.stage, env=old, capture_output=True, timeout=15)
        self.assertNotEqual(failed.returncode, 0)
        self.assertIn(b'double-loading config', failed.stderr)
        self.assertTrue(q.run_group(command, self.stage, child, (time.time()+35)*1000, self.log))
        self.assertEqual(self.log.read_text().strip(), 'https://registry.npmjs.org/')
        self.assertEqual(config.read_bytes(), b'')

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

    def test_browser_data_zero_byte_markers_have_exact_hash_and_size(self):
        browsers = self.stage / 'browsers'
        folder = browsers / 'chromium-1234'
        folder.mkdir(parents=True)
        for name in ('INSTALLATION_COMPLETE', 'DEPENDENCIES_VALIDATED', 'empty-data'):
            (folder / name).touch(mode=0o600)
        files = q.browser_data_tree(browsers, ('chromium-1234',))
        self.assertEqual(len(files), 3)
        for spec in files.values():
            self.assertEqual(spec, {'size': 0, 'sha256': hashlib.sha256(b'').hexdigest()})
        # Default APIs used for executable, metadata and module inputs stay strict.
        for read in (q.hash_file, q.checked_file):
            with self.assertRaises(q.Blocked):
                read(folder / 'empty-data')
        with self.assertRaises(q.Blocked):
            q.exact_tree(browsers, ('chromium-1234',))

    def test_browser_data_keeps_links_modes_limits_and_prefix_checks(self):
        browsers = self.stage / 'browsers'
        folder = browsers / 'chromium-1234'
        folder.mkdir(parents=True)
        file = folder / 'INSTALLATION_COMPLETE'
        file.touch(mode=0o600)
        def verify():
            return q.browser_data_tree(browsers, ('chromium-1234',))
        verify()
        with mock.patch.object(q, 'MAX_FILES', 0), self.assertRaises(q.Blocked):
            verify()
        file.write_bytes(b'changed')
        with mock.patch.object(q, 'MAX_TOTAL', 0), self.assertRaises(q.Blocked):
            verify()
        with self.assertRaises(q.Blocked):
            q.hash_file(file, 1, allow_empty=True)
        file.write_bytes(b'')
        file.chmod(0o666)
        with self.assertRaises(q.Blocked):
            verify()
        file.chmod(0o600)
        alias = folder / 'alias'
        os.link(file, alias)
        with self.assertRaises(q.Blocked):
            verify()
        alias.unlink()
        file.unlink()
        file.symlink_to(self.log)
        with self.assertRaises(q.Blocked):
            verify()
        file.unlink()
        folder.rmdir()
        folder.symlink_to(self.stage)
        with self.assertRaises(q.Blocked):
            verify()
        folder.unlink()
        folder.mkdir()
        file.touch(mode=0o600)
        (browsers / 'foreign').touch(mode=0o600)
        with self.assertRaises(q.Blocked):
            verify()

    def test_empty_data_hash_detects_mutation_during_read(self):
        file = self.stage / 'empty-data'
        file.touch(mode=0o600)
        original_open = Path.open
        def changed_open(p, *args, **kwargs):
            if p == file:
                with original_open(p, 'wb') as writer:
                    writer.write(b'tampered')
            return original_open(p, *args, **kwargs)
        with mock.patch.object(Path, 'open', changed_open), self.assertRaises(q.Blocked):
            q.hash_file(file, allow_empty=True)

    def test_empty_metadata_manifest_and_archive_are_still_blocked(self):
        for name in ('inventory.json', 'package.json', 'archive.tgz'):
            file = self.stage / name
            file.touch(mode=0o600)
            with self.assertRaises(q.Blocked):
                q.checked_file(file)


    def test_wrong_P_Q_E_or_missing_lock_block_before_any_installer(self):
        source = self.root / 'validator'
        source.mkdir()
        (source / '.git').mkdir()
        (source / '.git/HEAD').write_text('b' * 40)
        env = {'RUNNER_TEMP':str(self.root), 'ZAMEROVAC_QA_VALIDATOR_ROOT':str(source),
               'ZAMEROVAC_CLOUD_REVIEWED_V_SHA':'b' * 40,
               'ZAMEROVAC_CLOUD_EVENT_SHA':'c' * 40,
               'ZAMEROVAC_EXPECTED_PRODUCT_SHA':q.P_SHA,
               'ZAMEROVAC_CLOUD_DEADLINE':str(int((time.time() + 600) * 1000))}
        with mock.patch.object(q.subprocess, 'Popen', side_effect=AssertionError('no npm')) as starts:
            for altered in [
                {**env, 'ZAMEROVAC_EXPECTED_PRODUCT_SHA':'d' * 40},
                {**env, 'ZAMEROVAC_CLOUD_REVIEWED_V_SHA':'e' * 40},
                {**env, 'ZAMEROVAC_CLOUD_EVENT_SHA':'nonhex'},
                env  # missing package-lock must also stop before npm
            ]:
                with self.assertRaises((q.Blocked, FileNotFoundError)):
                    q.prepare(altered)
            starts.assert_not_called()

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



def linux_elf_fixture(payload=b'synthetic'):
    data = bytearray(64 + len(payload))
    data[:7] = b'\x7fELF\x02\x01\x01'
    data[16:18] = (2).to_bytes(2, 'little')
    data[18:20] = (62 if platform.machine() == 'x86_64' else 183).to_bytes(2, 'little')
    data[64:] = payload
    return bytes(data)


class BrowserRevision(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='qa-c-browser-registry-')
        self.addCleanup(self.tmp.cleanup)
        self.stage = Path(self.tmp.name) / 'stage'
        self.stage.mkdir(mode=0o700)
        self.core = self.stage / 'deps/node_modules/playwright-core'
        self.core.mkdir(parents=True)
        self.browsers = self.stage / 'browsers'
        self.browsers.mkdir()
        cli = self.stage / 'deps/node_modules/playwright/cli.js'
        cli.parent.mkdir(parents=True)
        cli.write_bytes(b'synthetic CLI, never executed')
        (self.core / 'browsers.json').write_text(json.dumps({
            'browsers':[{'name':'chromium','revision':'1234'},
                        {'name':'ffmpeg','revision':'1011'}]}))
        self.chrome = self.browsers / 'chromium-1234/chrome-linux64/chrome'
        self.chrome.parent.mkdir(parents=True)
        self.chrome.write_bytes(b'\x7fELF' + b'not runnable - synthetic')
        self.ffmpeg = self.browsers / 'ffmpeg-1011'
        self.ffmpeg.mkdir()
        self.ffmpeg_binary = self.ffmpeg / 'ffmpeg-linux'
        self.ffmpeg_binary.write_bytes(linux_elf_fixture(b'synthetic-ffmpeg-identity'))
        self.ffmpeg_binary.chmod(0o700)

    def test_reviewed_chromium_and_ffmpeg_companion_only(self):
        binary, revision, ffmpeg, companion = q.resolved_browser(self.stage, None, {}, {})
        self.assertEqual(binary, self.chrome)
        self.assertEqual((revision, ffmpeg), ('1234', '1011'))
        self.assertEqual(companion, self.ffmpeg_binary)
        self.assertEqual(q.required_ffmpeg(self.stage, '1011')[1], q.hash_file(companion))

    def test_empty_ffmpeg_directory_or_missing_executable_block(self):
        self.ffmpeg_binary.unlink()
        with self.assertRaises((q.Blocked, FileNotFoundError)):
            q.resolved_browser(self.stage, None, {}, {})
        with self.assertRaises((q.Blocked, FileNotFoundError)):
            q.required_ffmpeg(self.stage, '1011')

    def test_empty_chromium_and_ffmpeg_never_become_data_approved_executables(self):
        for executable in (self.chrome, self.ffmpeg_binary):
            original = executable.read_bytes()
            executable.write_bytes(b'')
            # DATA closure may record it, executable validation must reject it.
            files = q.browser_data_tree(self.browsers, ('chromium-1234', 'ffmpeg-1011'))
            self.assertEqual(files[executable.relative_to(self.browsers).as_posix()]['size'], 0)
            with self.assertRaises(q.Blocked):
                q.resolved_browser(self.stage, None, {}, {})
            executable.write_bytes(original)

    def test_ffmpeg_symlink_bad_elf_not_executable_and_hardlink_block(self):
        with tempfile.TemporaryDirectory() as outside:
            target = Path(outside) / 'different'
            target.write_bytes(b'\x7fELF' + b'outside')
            self.ffmpeg_binary.unlink()
            self.ffmpeg_binary.symlink_to(target)
            with self.assertRaises(q.Blocked):
                q.resolved_browser(self.stage, None, {}, {})
            self.ffmpeg_binary.unlink()
        self.ffmpeg_binary.write_bytes(b'NOPE' + b'bad header')
        self.ffmpeg_binary.chmod(0o700)
        with self.assertRaises(q.Blocked):
            q.resolved_browser(self.stage, None, {}, {})
        self.ffmpeg_binary.write_bytes(linux_elf_fixture(b'fixed'))
        self.ffmpeg_binary.chmod(0o600)
        with self.assertRaises(q.Blocked):
            q.resolved_browser(self.stage, None, {}, {})
        self.ffmpeg_binary.chmod(0o700)
        link = self.ffmpeg / 'hardlink-copy'
        os.link(self.ffmpeg_binary, link)
        try:
            with self.assertRaises(q.Blocked):
                q.resolved_browser(self.stage, None, {}, {})
        finally:
            link.unlink()

    def test_ffmpeg_mutated_hash_and_revision_block(self):
        _, old = q.required_ffmpeg(self.stage, '1011')
        self.ffmpeg_binary.write_bytes(linux_elf_fixture(b'tampered'))
        self.assertNotEqual(q.hash_file(self.ffmpeg_binary), old)
        with self.assertRaises((q.Blocked, FileNotFoundError)):
            q.required_ffmpeg(self.stage, '1012')

    def test_missing_extra_and_wrong_ffmpeg_revision_block(self):
        self.ffmpeg_binary.unlink()
        self.ffmpeg.rmdir()
        with self.assertRaises(q.Blocked):
            q.resolved_browser(self.stage, None, {}, {})
        self.ffmpeg.mkdir()
        self.ffmpeg_binary.write_bytes(linux_elf_fixture(b'fixture'))
        self.ffmpeg_binary.chmod(0o700)
        extra = self.browsers / 'unapproved-1234'
        extra.mkdir()
        with self.assertRaises(q.Blocked):
            q.resolved_browser(self.stage, None, {}, {})
        extra.rmdir()
        data = json.loads((self.core / 'browsers.json').read_text())
        data['browsers'][1]['revision'] = '1012'
        (self.core / 'browsers.json').write_text(json.dumps(data))
        with self.assertRaises(q.Blocked):
            q.resolved_browser(self.stage, None, {}, {})


if __name__ == '__main__':
    unittest.main()
