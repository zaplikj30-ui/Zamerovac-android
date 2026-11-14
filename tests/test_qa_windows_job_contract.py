"""Win32 API contract fixtures on any host. Never Windows runtime evidence."""
import ctypes
from ctypes import wintypes
import importlib.util
from pathlib import Path
import sys
import tempfile
import types
import unittest
from unittest import mock

TOOLS=Path(__file__).resolve().parents[1]/'tools'
SPEC=importlib.util.spec_from_file_location('owned_win_contract',TOOLS/'qa_owned_processes.py')
owned=importlib.util.module_from_spec(SPEC);SPEC.loader.exec_module(owned)


class Function:
    def __init__(self, callback):self.callback=callback
    def __call__(self,*args):return self.callback(*args)


class JobContractTests(unittest.TestCase):
    def exercise(self, assignment=True, close_ok=True, elevated=False, admin=False, linked=1, user='ZamerovacQA', job_attr_ok=True):
        calls=[];assigned=False
        executable=str(Path(sys.executable).resolve())
        class Kernel:
            def __getattr__(self,name):
                def invoke(*a):
                    nonlocal assigned
                    calls.append((name,a))
                    if name=='GetCurrentProcess':return -1
                    if name=='OpenProcessToken':a[2]._obj.value=61
                    if name=='GetTokenInformation':a[2]._obj.value=int(linked)
                    if name=='DuplicateToken':a[2]._obj.value=62
                    if name=='CreateWellKnownSid':a[3]._obj.value=16
                    if name=='CheckTokenMembership':a[2]._obj.value=int(admin)
                    if name=='GetUserNameW':a[0].value=user
                    if name=='CreateJobObjectW':return 71
                    if name=='SetInformationJobObject':
                        self_outer.assertEqual(a[2]._obj.basic.flags,0x2000)
                    if name=='InitializeProcThreadAttributeList':
                        self_outer.assertEqual(a[1],2,'require handle list plus creation-time job list')
                        a[3]._obj.value=256
                    if name=='UpdateProcThreadAttribute':
                        if a[2]==0x2000d and not job_attr_ok:return 0
                    if name=='CreateProcessW':
                        self_outer.assertTrue(a[5]&4,'must create suspended')
                        self_outer.assertFalse(a[5]&0x01000000,'must not allow breakaway')
                        p=a[-1]._obj;p.process=81;p.thread=82;p.pid=91
                    if name=='IsProcessInJob':
                        assigned=assignment;a[2]._obj.value=int(assignment)
                    if name=='ResumeThread':self_outer.assertTrue(assigned,'resume before verified job membership')
                    if name=='QueryFullProcessImageNameW':a[2].value=executable
                    if name=='GetProcessTimes':a[1]._obj.value=12345
                    if name=='QueryInformationJobObject':a[2]._obj.active=0
                    if name=='GetExitCodeProcess':a[1]._obj.value=0
                    if name=='WaitForSingleObject':return 0
                    if name=='CloseHandle':
                        handle=a[0].value if hasattr(a[0],'value') else a[0]
                        return int(close_ok or handle in (61,62))
                    return 1
                fn=Function(invoke);setattr(self,name,fn);return fn
        self_outer=self
        # Win32 DWORD is always 32-bit; host ctypes.wintypes may differ on Linux.
        with mock.patch.object(owned.sys,'platform','win32'), \
             mock.patch.object(ctypes,'WinDLL',return_value=Kernel(),create=True), \
             mock.patch.object(ctypes,'get_last_error',return_value=5,create=True), \
             mock.patch.object(wintypes,'DWORD',ctypes.c_uint32), \
             mock.patch.object(wintypes,'WORD',ctypes.c_uint16), \
             mock.patch.object(wintypes,'BOOL',ctypes.c_int32), \
             mock.patch.object(wintypes,'UINT',ctypes.c_uint32), \
             mock.patch.dict(sys.modules,{'msvcrt':types.SimpleNamespace(get_osfhandle=lambda fd:fd)}), \
             mock.patch.object(owned.os,'set_handle_inheritable',create=True), \
             tempfile.TemporaryFile('w+b') as log:
            if admin or linked!=1 or user!='ZamerovacQA':
                with self.assertRaises(owned.ScopeError):owned.WindowsJob()
                self.assertNotIn('CreateProcessW',[n for n,_ in calls]);return
            scope=owned.WindowsJob()
            if not assignment or not job_attr_ok:
                with self.assertRaises(owned.ScopeError):
                    scope.start([executable,'synthetic-only'],'/tmp',log)
            else:
                start=scope.start([executable,'synthetic-only'],'/tmp',log)
                self.assertEqual(start['creationTime'],12345)
                self.assertEqual(scope.poll(),0)
                self.assertTrue(scope.cleanup());self.assertTrue(scope.verify_empty())
            if close_ok:scope.close()
            else:
                with self.assertRaises(owned.ScopeError):scope.close()
        names=[n for n,_ in calls]
        self.assertNotIn('AssignProcessToJobObject',names)
        attrs=[a[2] for n,a in calls if n=='UpdateProcThreadAttribute']
        self.assertIn(0x20002,attrs)
        self.assertIn(0x2000d,attrs)
        if not job_attr_ok:
            self.assertNotIn('CreateProcessW',names)
        if not assignment:self.assertIn('TerminateProcess',names)
        if not assignment or not job_attr_ok:self.assertNotIn('ResumeThread',names)
        if assignment and job_attr_ok:
            self.assertLess(names.index('CreateProcessW'),names.index('IsProcessInJob'))
            self.assertLess(names.index('IsProcessInJob'),names.index('ResumeThread'))

    def test_job_contains_worker_before_any_execution(self):self.exercise()
    def test_failed_membership_kills_only_retained_suspended_handle(self):self.exercise(assignment=False)
    def test_failed_atomic_job_attribute_does_not_create_any_worker(self):self.exercise(job_attr_ok=False)
    def test_close_failure_is_not_silently_accepted(self):self.exercise(close_ok=False)
    def test_scm_high_non_admin_service_is_allowed(self):self.exercise(elevated=True)
    def test_active_administrators_token_never_starts_child(self):self.exercise(admin=True)
    def test_linked_full_admin_token_never_starts_child(self):self.exercise(linked=2)
    def test_linked_limited_admin_token_never_starts_child(self):self.exercise(linked=3)
    def test_other_windows_account_never_starts_child(self):self.exercise(user='different-account')


if __name__=='__main__':unittest.main()
