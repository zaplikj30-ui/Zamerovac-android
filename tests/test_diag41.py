"""Real import of modified Python supervisor, with owned scope model and faults."""
import contextlib, io, importlib.util, json, os, pathlib, sys, tempfile, types, unittest
from unittest.mock import patch
ROOT=pathlib.Path(__file__).resolve().parents[1]
class ScopeError(RuntimeError):
    def __init__(self,message,stage=None,win32_error=None):
        super().__init__(message);self.stage=stage;self.win32_error=win32_error
def scope_diagnostic(e,stage):
    actual=getattr(e,'stage',None) or stage
    return {'stage':actual,'win32Error':getattr(e,'win32_error',None)}
with patch.dict(sys.modules,{'qa_owned_processes':types.SimpleNamespace(new_scope=None,ScopeError=ScopeError,scope_diagnostic=scope_diagnostic),'qa_browser_lock':types.SimpleNamespace(BrowserLock=object)}):
    spec=importlib.util.spec_from_file_location('qa41_supervisor',ROOT/'tools/qa_process_supervisor.py')
    m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class FakeScope:
    observed=[]
    def __init__(self,mode):self.mode=mode;self.calls=[]
    def start(self,*args):
        self.calls.append('start')
        if self.mode in ('create','both'):
            raise ScopeError('SECRET_TOKEN=abc private path',stage='CreateProcessW',win32_error=5)
        return {'pid':42,'backend':'model'}
    def poll(self):self.calls.append('poll');return 1 if self.mode=='crash' else 0
    def cleanup(self):
        self.calls.append('cleanup')
        if self.mode in ('both','cleanup'):raise ScopeError('secondary SECRET',stage='TerminateJobObject',win32_error=32)
    def verify_empty(self):self.calls.append('verify_empty');return True
    def close(self):self.calls.append('close');return None
@unittest.skipUnless(sys.platform=='linux', 'Linux-only scope API model; not native Windows')
class Cases(unittest.TestCase):
    def run_case(self,mode,enabled=False):
        with tempfile.TemporaryDirectory() as d:
            base=pathlib.Path(d);scope=FakeScope(mode)
            cfg={'command':[sys.executable], 'cwd':d, 'log':str(base/('no-dir' if mode=='open' else 'present')/'log'), 'timeout':1,'heartbeatTimeout':1,'token':'a'*32}
            if mode!='open':(base/'present').mkdir(mode=0o700)
            capture=io.StringIO()
            env={'ZAMEROVAC_DIAGNOSTICS':'1'} if enabled else {}
            with patch.dict(os.environ,env,clear=False),patch.object(m,'new_scope',return_value=scope),patch('resource.setrlimit'),patch.object(m.threading.Thread,'start',return_value=None),contextlib.redirect_stdout(capture):
                if not enabled:os.environ.pop('ZAMEROVAC_DIAGNOSTICS',None)
                rc=m.supervise(cfg)
            output=capture.getvalue();report=json.loads(output.splitlines()[-1]);
            tracefile=base/'present'/'diagnostic.trace'
            trace=tracefile.read_text() if tracefile.exists() else None
            return rc,report,output,trace,scope.calls
    def test_create_preserves_win32_primary(self):
        rc,r,out,trace,c=self.run_case('create',True)
        self.assertEqual(rc,77);self.assertEqual(r['firstFailure'],{'stage':'CreateProcessW','win32Error':5,'errorType':'ScopeError'});
        self.assertEqual(r['reason'],'startup-error');self.assertEqual(r['cleanupEvidence']['remainingProcesses'],0)
        self.assertNotIn('SECRET_',out);self.assertTrue(r['privateTracebackWritten']);self.assertIn('test_diag41.py',trace)
        self.assertEqual(c,['start','cleanup','verify_empty','close'])
    def test_secondary_cleanup_does_not_replace_first(self):
        rc,r,out,trace,c=self.run_case('both',True)
        self.assertEqual(rc,77);self.assertEqual(r['firstFailure']['win32Error'],5)
        self.assertEqual(r['cleanupErrorType'],'ScopeError');self.assertFalse(r['cleanupVerified']);self.assertIsNone(r['cleanupEvidence']['remainingProcesses']);self.assertNotIn('SECRET',out)
    def test_default_off_no_metadata_no_private_trace(self):
        rc,r,out,trace,c=self.run_case('create',False)
        self.assertEqual(rc,77);self.assertNotIn('firstFailure',r);self.assertFalse(trace);self.assertNotIn('SECRET',out)
    def test_open_failure_preserved(self):
        rc,r,out,trace,c=self.run_case('open',True)
        self.assertEqual(rc,77);self.assertEqual(r['firstFailure']['stage'],'verdict-open');self.assertTrue(r['cleanupVerified'])
    def test_local_private_trace_file_permission_and_redacted_content(self):
        with tempfile.TemporaryDirectory() as d:
            private=pathlib.Path(d)/'private';private.mkdir(mode=0o700)
            try:raise ScopeError('PASSWORD=abc TOKEN=qwe /path/to/customer',stage='CreateProcessW',win32_error=5)
            except ScopeError as e:
                status=m.private_trace(e,'worker-start',{'log':str(private/'verdict.log')})
            self.assertTrue(status)
            trace=private/'diagnostic.trace'
            self.assertEqual(trace.stat().st_mode & 0o777,0o600)
            text=trace.read_text();self.assertIn('test_diag41.py',text)
            for secret in ['PASSWORD','TOKEN=','customer','/path/to/']:
                self.assertNotIn(secret,text)
    def test_private_trace_fails_closed_when_directory_is_public(self):
        with tempfile.TemporaryDirectory() as d:
            public=pathlib.Path(d)/'public';public.mkdir(mode=0o755)
            try:raise ValueError('SECRET')
            except ValueError as e:
                self.assertFalse(m.private_trace(e,'owner-config',{'log':str(public/'verdict.log')}))
            self.assertFalse((public/'diagnostic.trace').exists())
    def test_private_trace_fails_closed_on_existing_symlink(self):
        with tempfile.TemporaryDirectory() as d:
            private=pathlib.Path(d)/'private';private.mkdir(mode=0o700)
            destination=pathlib.Path(d)/'private.bin';destination.write_bytes(b'original')
            (private/'diagnostic.trace').symlink_to(destination)
            try:raise ValueError('SECRET')
            except ValueError as e:
                self.assertFalse(m.private_trace(e,'owner-config',{'log':str(private/'verdict.log')}))
            self.assertEqual(destination.read_bytes(),b'original')
    def test_error_type_is_allowlisted(self):
        Sneaky=type('SECRET_PATH_TOKEN', (Exception,), {})
        self.assertEqual(m.safe_error_type(Sneaky('SECRET')),'OtherError')
    def test_cleanup_first_failure(self):
        rc,r,out,trace,c=self.run_case('cleanup',True)
        self.assertEqual(rc,77);self.assertEqual(r['firstFailure']['stage'],'TerminateJobObject');self.assertFalse(r['cleanupVerified'])
if __name__=='__main__':unittest.main()
