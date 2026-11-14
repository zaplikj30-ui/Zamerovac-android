"""Safe failure attribution only; no native Windows runtime is executed."""
import importlib.util
import ctypes
import os
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
                       'UpdateProcThreadAttributeJobList','CreateProcessW','IsProcessInJob','job-not-attached','QueryFullProcessImageNameW',
                       'GetProcessTimes','ResumeThread','GetExitCodeProcess','TerminateJobObject','QueryInformationJobObject',
                       'CloseJobHandle','CloseWorkerHandle','CloseWorkerThreadHandle']:
            with self.subTest(failed=failed):self.exercise(failed)

    def test_image_mismatch_does_not_misattribute_stale_win32_error(self):self.exercise('worker-image-check')
    def test_failed_worker_thread_close_is_reported_and_resources_still_closed(self):
        trace=self.exercise('CloseWorkerThreadHandle')
        self.assertEqual(trace['diagnostic'],{'stage':'CloseWorkerThreadHandle','win32Error':5})
        self.assertEqual(trace['secondary'],'ScopeError')
        self.assertTrue(trace['null_closed'])
        self.assertIn('DeleteProcThreadAttributeList',trace['calls'])

    def test_set_and_restore_both_fail_but_resources_are_closed(self):
        trace=self.exercise('SetHandleInformation')
        self.assertEqual(trace['restores'],1)
        self.assertTrue(trace['null_closed'])
        self.assertIn('DeleteProcThreadAttributeList',trace['calls'])

    def test_first_restoration_failure_still_restores_second_handle(self):
        trace=self.exercise('restore-first-fails')
        self.assertEqual(trace['restores'],2)
        self.assertTrue(trace['null_closed'])
        self.assertIn('DeleteProcThreadAttributeList',trace['calls'])
        self.assertEqual(trace['secondary'],'ScopeError')

    def test_primary_create_failure_survives_secondary_restore_failure(self):
        trace=self.exercise('CreateProcessW+restore-first-fails')
        self.assertEqual(trace['diagnostic'],{'stage':'CreateProcessW','win32Error':87})
        self.assertEqual(trace['secondary'],'ScopeError')
        self.assertTrue(trace['null_closed'])
        self.assertIn('DeleteProcThreadAttributeList',trace['calls'])

    def test_get_osfhandle_failure_still_releases_null_and_attributes(self):
        trace=self.exercise('GetOsfhandle')
        self.assertEqual(trace['diagnostic'],{'stage':'worker-start','win32Error':None})
        self.assertTrue(trace['null_closed'])
        self.assertIn('DeleteProcThreadAttributeList',trace['calls'])

    def exercise(self,failed):
        calls=[];last=[0];executable=str(Path(sys.executable).resolve())
        restores=[];null_opened=[]
        native_open=open
        def tracked_open(*args,**kwargs):
            stream=native_open(*args,**kwargs)
            if args and str(args[0])==os.devnull:null_opened.append(stream)
            return stream
        def os_handle(fd):
            if failed=='GetOsfhandle':raise OSError('PRIVATE get_osfhandle failure')
            return fd
        class Function:
            def __init__(self,callback):self.callback=callback
            def __call__(self,*args):return self.callback(*args)
        class Kernel:
            def __getattr__(self,name):
                def invoke(*args):
                    calls.append(name)
                    if name=='CloseHandle' and ((failed=='CloseJobHandle' and args[0]==71) or
                        (failed=='CloseWorkerHandle' and args[0]==81) or
                        (failed=='CloseWorkerThreadHandle' and args[0]==82)):
                        last[0]=5;return 0
                    if name==failed or (name=='CreateProcessW' and failed=='CreateProcessW+restore-first-fails') or (name=='UpdateProcThreadAttribute' and
                       failed=='UpdateProcThreadAttributeJobList' and args[2]==0x2000d):
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
                    if name=='IsProcessInJob':args[2]._obj.value=0 if failed=='job-not-attached' else 1
                    if name=='QueryFullProcessImageNameW':
                        args[2].value=executable+('-different' if failed=='worker-image-check' else '')
                        last[0]=122
                    if name=='GetExitCodeProcess':args[1]._obj.value=0
                    if name=='QueryInformationJobObject':args[2]._obj.active=0
                    if name in ('CloseHandle','TerminateProcess','WaitForSingleObject'):last[0]=999
                    return 0 if name=='WaitForSingleObject' else 1
                function=Function(invoke);setattr(self,name,function);return function
        scope=None;failure=None
        def inheritable(handle,value):
            if not value:restores.append(handle)
            fail=failed=='SetHandleInformation' or (
                not value and len(restores)==1 and failed in (
                    'restore-first-fails','CreateProcessW+restore-first-fails'))
            if fail:
                error=OSError('PRIVATE HANDLE');error.winerror=5;raise error
        with mock.patch.object(owned.sys,'platform','win32'), \
             mock.patch.object(ctypes,'WinDLL',return_value=Kernel(),create=True), \
             mock.patch.object(ctypes,'get_last_error',side_effect=lambda:last[0],create=True), \
             mock.patch.object(wintypes,'DWORD',ctypes.c_uint32), \
             mock.patch.object(wintypes,'WORD',ctypes.c_uint16), \
             mock.patch.object(wintypes,'BOOL',ctypes.c_int32), \
             mock.patch.object(wintypes,'UINT',ctypes.c_uint32), \
             mock.patch.dict(sys.modules,{'msvcrt':types.SimpleNamespace(get_osfhandle=os_handle)}), \
             mock.patch.object(owned.os,'set_handle_inheritable',side_effect=inheritable,create=True), \
             mock.patch.object(owned,'open',side_effect=tracked_open,create=True), \
             tempfile.TemporaryFile('w+b') as log:
            try:
                scope=owned.WindowsJob();scope.start([executable,'fixed'],str(TOOLS),log)
                scope.poll();scope.cleanup()
            except BaseException as error:failure=error
            finally:
                if scope:
                    try:scope.close()
                    except owned.ScopeError as error:
                        if failure is None:failure=error
        self.assertIsNotNone(failure)
        expected_stage={'UpdateProcThreadAttributeJobList':'UpdateProcThreadAttribute',
                        'restore-first-fails':'SetHandleInformation',
                        'CreateProcessW+restore-first-fails':'CreateProcessW',
                        'GetOsfhandle':'worker-start'}.get(failed,failed)
        expected=None if failed in ('worker-image-check','job-not-attached','GetOsfhandle') else 87 if failed in ('CreateProcessW','CreateProcessW+restore-first-fails') else 5
        self.assertEqual(owned.scope_diagnostic(failure,'worker-start'),{'stage':expected_stage,'win32Error':expected})
        if failed in ('IsProcessInJob','job-not-attached','CreateProcessW','UpdateProcThreadAttributeJobList'):
            self.assertNotIn('ResumeThread',calls)
        if failed in ('IsProcessInJob','job-not-attached'):
            self.assertIn('TerminateProcess',calls)
        # Every opened NUL handle must have been closed before the scope returns.
        self.assertTrue(all(stream.closed for stream in null_opened),'leaked NUL handle / ResourceWarning')
        return {'calls':calls,'restores':len(restores),
                'null_closed':all(stream.closed for stream in null_opened),
                'secondary':getattr(scope,'start_cleanup_error_type',None),
                'diagnostic':owned.scope_diagnostic(failure,'worker-start')}

if __name__=='__main__':unittest.main()
