"""Native file-sharing contract fixtures; no real Windows calls or permission changes."""
import ctypes
import hashlib
import importlib.util
import os
from pathlib import Path
import sys
import tempfile
import types
import unittest
from unittest import mock

SPEC=importlib.util.spec_from_file_location('browser_lock_contract',Path(__file__).resolve().parents[1]/'tools/qa_browser_lock.py')
lock=importlib.util.module_from_spec(SPEC);SPEC.loader.exec_module(lock)


class Fn:
    def __init__(self,fn):self.fn=fn
    def __call__(self,*a):return self.fn(*a)


class FileLockTests(unittest.TestCase):
    def exercise(self,reparse=False,close_ok=True):
        with tempfile.TemporaryDirectory() as directory:
            file=Path(directory)/'browser.exe';data=b'MZ-reviewed-fixture';file.write_bytes(data)
            profiles={'win32':{'path':str(file),'sha256':hashlib.sha256(data).hexdigest()}}
            opened={};closed=[]
            def create(name,access,share,security,disposition,flags,template):
                handle=100+len(opened);opened[handle]=(name,access,share,flags)
                self.assertEqual(share,1 if name==str(file) else 3)
                self.assertFalse(share&4,'DELETE sharing would permit path substitution')
                self.assertTrue(flags&0x00200000,'never follow a reparse point')
                return handle
            def info(handle,pointer):
                pointer._obj[0]=(0x80 if opened[handle][0]==str(file) else 0x10)|(0x400 if reparse else 0)
                return 1
            def close(handle):closed.append(handle);return int(close_ok)
            kernel=types.SimpleNamespace(CreateFileW=Fn(create),GetFileInformationByHandle=Fn(info),CloseHandle=Fn(close))
            with mock.patch.object(lock.sys,'platform','win32'), \
                 mock.patch.dict(os.environ,{'CHROMIUM_PATH':str(file)}), \
                 mock.patch.object(lock.json,'loads',return_value=profiles), \
                 mock.patch.object(ctypes,'WinDLL',return_value=kernel,create=True), \
                 mock.patch.object(lock.os,'O_BINARY',getattr(os,'O_BINARY',0),create=True), \
                 mock.patch.dict(sys.modules,{'msvcrt':types.SimpleNamespace(open_osfhandle=lambda handle,flags:os.open(file,os.O_RDONLY))}):
                if reparse:
                    with self.assertRaisesRegex(RuntimeError,'redirected'):lock.BrowserLock()
                else:
                    instance=lock.BrowserLock()
                    self.assertIsNotNone(instance.fd)
                    if close_ok:instance.close()
                    else:
                        with self.assertRaisesRegex(RuntimeError,'close Chromium path lock'):instance.close()
                self.assertEqual(set(closed),{h for h,v in opened.items() if v[0]!=str(file)})

    def test_parent_chain_and_file_deny_replacement(self):self.exercise()
    def test_reparse_component_is_rejected(self):self.exercise(reparse=True)
    def test_path_handle_close_error_is_reported(self):self.exercise(close_ok=False)


if __name__=='__main__':unittest.main()
