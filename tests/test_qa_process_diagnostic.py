"""Safe failure attribution only; no native Windows runtime is executed."""
import importlib.util
import ctypes
from ctypes import wintypes
from pathlib import Path
import sys
import tempfile
import types
import unittest
from unittest import mock

TOOLS=Path(__file__).resolve().parents[1]/'tools'
SPEC=importlib.util.spec_from_file_location('diag_owned',TOOLS/'qa_owned_processes.py')
owned=importlib.util.module_from_spec(SPEC);SPEC.loader.exec_module(owned)

class DiagnosticTests(unittest.TestCase):
    def test_typed_native_error_is_preserved_without_sensitive_text(self):
        e=owned.ScopeError('PRIVATE ACCOUNT PATH',stage='AssignProcessToJobObject',win32_error=5)
        self.assertEqual(owned.scope_diagnostic(e,'worker-start'),{'stage':'AssignProcessToJobObject','win32Error':5})

    def test_raw_error_text_never_becomes_a_native_error_code(self):
        self.assertEqual(owned.scope_diagnostic(RuntimeError('PRIVATE WinError=5'), 'worker-start'),
                         {'stage':'worker-start','win32Error':None})

    def test_logical_and_malformed_errors_never_leak_stale_codes(self):
        for code in (-1,2**32,True,'5'):
            e=owned.ScopeError('PRIVATE',stage='CreateProcessW',win32_error=code)
            self.assertIsNone(owned.scope_diagnostic(e,'worker-start')['win32Error'])
        e=owned.ScopeError('PRIVATE',stage='worker-image-check',win32_error=122)
        self.assertIsNone(owned.scope_diagnostic(e,'worker-start')['win32Error'])

    def test_windows_api_failure_is_attributed_before_cleanup_overwrites_last_error(self):
        # Native API model, never a Windows runtime result. All calls use the
        # real production ctypes declarations/control flow and mocked Win32.
        for failed in ['OpenProcessToken','GetTokenInformation','CreateWellKnownSid','DuplicateToken',
                       'CheckTokenMembership','GetUserNameW','CreateJobObjectW',
                       'SetInformationJobObject','InitializeProcThreadAttributeList','SetHandleInformation','UpdateProcThreadAttribute',
                       'CreateProcessW','AssignProcessToJobObject','QueryFullProcessImageNameW',
                       'GetProcessTimes','ResumeThread','GetExitCodeProcess','TerminateJobObject','QueryInformationJobObject',
                       'CloseJobHandle','CloseWorkerHandle']:
            with self.subTest(failed=failed):self.exercise(failed)

    def test_image_mismatch_does_not_misattribute_stale_win32_error(self):self.exercise('worker-image-check')

    def exercise(self,failed):
        calls=[];last=[0];executable=str(Path(sys.executable).resolve())
        class Function:
            def __init__(self,callback):self.callback=callback
            def __call__(self,*args):return self.callback(*args)
        class Kernel:
            def __getattr__(self,name):
                def invoke(*args):
                    calls.append(name)
                    if name=='CloseHandle' and ((failed=='CloseJobHandle' and args[0]==71) or (failed=='CloseWorkerHandle' and args[0]==81)):
                        last[0]=5;return 0
                    if name==failed:
                        last[0]=87 if name=='CreateProcessW' else 5
                        return 0xffffffff if name=='ResumeThread' else 0
                    if name=='GetCurrentProcess':return -1
                    if name=='OpenProcessToken':args[2]._obj.value=61
                    if name=='GetTokenInformation':args[2]._obj.value=1
                    if name=='DuplicateToken':args[2]._obj.value=62
                    if name=='CreateWellKnownSid':args[3]._obj.value=16
                    if name=='CheckTokenMembership':args[2]._obj.value=0
                    if name=='GetUserNameW':args[0].value='ZamerovacQA'
                    if name=='CreateJobObjectW':return 71
                    if name=='InitializeProcThreadAttributeList':args[3]._obj.value=256
                    if name=='CreateProcessW':
                        p=args[-1]._obj;p.process=81;p.thread=82;p.pid=91
                    if name=='QueryFullProcessImageNameW':
                        args[2].value=executable+('-different' if failed=='worker-image-check' else '')
                        last[0]=122
                    if name=='GetExitCodeProcess':args[1]._obj.value=0
                    if name=='QueryInformationJobObject':args[2]._obj.active=0
                    if name in ('CloseHandle','TerminateProcess','WaitForSingleObject'):last[0]=999
                    return 0 if name=='WaitForSingleObject' else 1
                function=Function(invoke);setattr(self,name,function);return function
        scope=None;failure=None
        def inheritable(*args):
            if failed=='SetHandleInformation':
                error=OSError('PRIVATE HANDLE');error.winerror=5;raise error
        with mock.patch.object(owned.sys,'platform','win32'), \
             mock.patch.object(ctypes,'WinDLL',return_value=Kernel(),create=True), \
             mock.patch.object(ctypes,'get_last_error',side_effect=lambda:last[0],create=True), \
             mock.patch.object(wintypes,'DWORD',ctypes.c_uint32), \
             mock.patch.object(wintypes,'WORD',ctypes.c_uint16), \
             mock.patch.object(wintypes,'BOOL',ctypes.c_int32), \
             mock.patch.object(wintypes,'UINT',ctypes.c_uint32), \
             mock.patch.dict(sys.modules,{'msvcrt':types.SimpleNamespace(get_osfhandle=lambda fd:fd)}), \
             mock.patch.object(owned.os,'set_handle_inheritable',side_effect=inheritable,create=True), \
             tempfile.TemporaryFile('w+b') as log:
            try:
                scope=owned.WindowsJob();scope.start([executable,'fixed'],str(TOOLS),log)
                scope.poll();scope.cleanup()
            except owned.ScopeError as error:failure=error
            finally:
                if scope:
                    try:scope.close()
                    except owned.ScopeError as error:
                        if failure is None:failure=error
        self.assertIsNotNone(failure)
        expected=None if failed=='worker-image-check' else 87 if failed=='CreateProcessW' else 5
        self.assertEqual(owned.scope_diagnostic(failure,'worker-start'),{'stage':failed,'win32Error':expected})
        if failed in ('AssignProcessToJobObject','CreateProcessW'):
            self.assertNotIn('ResumeThread',calls)
        if failed=='AssignProcessToJobObject':self.assertIn('TerminateProcess',calls)

if __name__=='__main__':unittest.main()
