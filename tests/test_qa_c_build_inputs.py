"""Local artifact gate tests; fixture hashes are injected only inside unittest."""
import contextlib
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest import mock

SPEC=importlib.util.spec_from_file_location('qa_c_inputs',Path(__file__).resolve().parents[1]/'tools/qa_c_build_inputs.py')
gate=importlib.util.module_from_spec(SPEC);SPEC.loader.exec_module(gate)

@unittest.skipUnless(os.name=='posix','POSIX input staging; native Windows path verification NOT RUN')
class BuildInputTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name);self.file=self.root/'input.bin'
        self.file.write_bytes(b'approved fixture bytes\r\n')
        self.pin=hashlib.sha256(self.file.read_bytes()).hexdigest()
        self.patch=mock.patch.dict(gate.PINS,{'headers':self.pin,'node-lib':self.pin,'node-exe':self.pin})
        self.patch.start();self.addCleanup(self.patch.stop)

    def blocked(self,path,reason=None):
        with self.assertRaises(gate.InputBlocked) as c:gate.verify_file('headers',path)
        if reason:self.assertEqual(c.exception.reason,reason)

    def test_positive_local_bytes(self):
        r=gate.verify_file('headers',self.file)
        self.assertEqual(r['sha256'],self.pin);self.assertEqual(r['status'],'PASS')
        self.assertNotIn(str(self.root),json.dumps(r))

    def test_wrong_hash(self):
        self.file.write_bytes(b'changed');self.blocked(self.file,'hash-mismatch')

    def test_missing_file(self):self.blocked(self.root/'missing')
    def test_directory(self):self.blocked(self.root,'not-regular')

    def test_symlink(self):
        link=self.root/'link';link.symlink_to(self.file);self.blocked(link,'reparse-or-symlink')

    def test_parent_symlink(self):
        link=self.root/'parent';link.symlink_to(self.root,target_is_directory=True)
        self.blocked(link/'input.bin','reparse-or-symlink')

    def test_hardlink(self):
        os.link(self.file,self.root/'second');self.blocked(self.file,'not-unique-file')

    def test_parent_traversal(self):self.blocked(self.root/'child'/ '..'/'input.bin','parent-traversal')

    def test_size_limit(self):
        with mock.patch.object(gate,'MAX_BYTES',1):self.blocked(self.file,'size-limit')

    def test_read_failure(self):
        with mock.patch.object(gate.os,'read',side_effect=PermissionError('PRIVATE PATH')):
            self.blocked(self.file,'io-error')

    def test_mutation_during_hash(self):
        original=gate.os.read;changed=False
        def read(fd,n):
            nonlocal changed
            data=original(fd,n)
            if not changed:self.file.write_bytes(b'different bytes');changed=True
            return data
        with mock.patch.object(gate.os,'read',side_effect=read):self.blocked(self.file)

    def test_name_replacement_during_hash(self):
        original=gate.os.read;changed=False
        def read(fd,n):
            nonlocal changed
            data=original(fd,n)
            if not changed:
                self.file.rename(self.root/'original');self.file.write_bytes(b'replacement');changed=True
            return data
        with mock.patch.object(gate.os,'read',side_effect=read):self.blocked(self.file,'changed-file')

    def test_unknown_label(self):
        with self.assertRaises(gate.InputBlocked):gate.verify_file('PRIVATE NAME',self.file)

    def test_windows_is_not_silently_treated_as_verified_posix(self):
        with mock.patch.object(gate.os,'name','nt'):
            self.blocked(self.file,'platform-unverified')

    def test_directory_replacement_during_hash(self):
        folder=self.root/'folder';folder.mkdir();self.file.rename(folder/'input.bin');self.file=folder/'input.bin'
        original=gate.os.read;changed=False
        def read(fd,n):
            nonlocal changed
            data=original(fd,n)
            if not changed:
                folder.rename(self.root/'old');folder.mkdir();changed=True
            return data
        with mock.patch.object(gate.os,'read',side_effect=read):self.blocked(self.file,'changed-directory')

    def test_close_failure_blocks_and_does_not_skip_other_closes(self):
        original=gate.os.close;seen=[]
        def close(fd):
            original(fd);seen.append(fd)
            if len(seen)==1:raise OSError('PRIVATE CLOSE ERROR')
        with mock.patch.object(gate.os,'close',side_effect=close):self.blocked(self.file,'close-error')
        self.assertGreaterEqual(len(seen),3);self.assertEqual(len(seen),len(set(seen)))

    def test_cli_complete_is_inputs_only(self):
        out=io.StringIO()
        with contextlib.redirect_stdout(out):
            rc=gate.main(['--headers',str(self.file),'--node-lib',str(self.file),'--node-exe',str(self.file)])
        r=json.loads(out.getvalue());self.assertEqual(rc,0)
        self.assertEqual(r['status'],'ARTIFACTS_VERIFIED')
        self.assertEqual(r['build'],'NOT_RUN');self.assertEqual(r['nativeLoad'],'NOT_RUN')
        self.assertNotIn(str(self.root),out.getvalue())

    def test_cli_missing_and_duplicate_arguments_block(self):
        for args in [[],['--headers',str(self.file),'--headers',str(self.file)],['--PRIVATE',str(self.file)]]:
            out=io.StringIO()
            with contextlib.redirect_stdout(out):self.assertEqual(gate.main(args),1)
            self.assertNotIn(str(self.root),out.getvalue());self.assertNotIn('PRIVATE',out.getvalue())

    def test_cli_error_is_redacted(self):
        out=io.StringIO()
        with contextlib.redirect_stdout(out):
            rc=gate.main(['--headers',str(self.root/'PRIVATE'),'--node-lib',str(self.file),'--node-exe',str(self.file)])
        self.assertEqual(rc,1);self.assertNotIn('PRIVATE',out.getvalue());self.assertNotIn(str(self.root),out.getvalue())

if __name__=='__main__':unittest.main()
