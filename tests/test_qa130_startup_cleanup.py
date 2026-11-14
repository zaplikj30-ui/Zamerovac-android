"""Calls the real imported QA supervisor, with owned-scope API fault injections."""
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import sys
import tempfile
import types
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
class ScopeError(RuntimeError):
    def __init__(self,msg,stage=None,win32_error=None):
        super().__init__(msg)
        self.stage=stage
        self.win32_error=win32_error

def diagnostic(error,stage):
    return dict(stage=getattr(error,'stage',None) or stage,
                win32Error=getattr(error,'win32_error',None))

sys.modules.setdefault('qa_owned_processes',types.SimpleNamespace(new_scope=None,ScopeError=ScopeError,scope_diagnostic=diagnostic))
sys.modules.setdefault('qa_browser_lock',types.SimpleNamespace(BrowserLock=object))
spec=importlib.util.spec_from_file_location('qa130_exact_supervisor',ROOT/'tools/qa_process_supervisor.py')
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class FakeScope:
    def __init__(self,mode,verified=True):
        self.mode,self.verified=mode,verified
        self.observed=[];self.calls=[]
    def start(self,*args):
        self.calls.append('start')
        if self.mode=='worker-start':raise ScopeError('synthetic OS error',stage='CreateProcessW',win32_error=5)
        return {'pid':42,'backend':'model'}
    def poll(self):
        self.calls.append('poll')
        return 1 if self.mode=='tap-fail' else 0
    def cleanup(self):
        self.calls.append('cleanup')
        return True
    def verify_empty(self):
        self.calls.append('verify_empty')
        return self.verified
    def close(self):
        self.calls.append('close')

class StartupCleanup(unittest.TestCase):
    def run_supervisor(self,mode,verified=True):
        with tempfile.TemporaryDirectory() as d:
            scope=FakeScope(mode,verified)
            cfg={'command':[sys.executable], 'cwd':d, 'log':str(Path(d)/('missing-parent' if mode=='verdict-open' else 'ok')/'log'),
                 'timeout':1,'heartbeatTimeout':1,'token':'a'*32}
            if mode!='verdict-open':Path(cfg['log']).parent.mkdir()
            buffer=io.StringIO()
            with patch.object(module,'new_scope',return_value=scope),patch('resource.setrlimit'),patch.object(module.threading.Thread,'start',return_value=None),contextlib.redirect_stdout(buffer):
                rc=module.supervise(cfg)
            reports=[json.loads(l) for l in buffer.getvalue().splitlines()]
            return rc,reports[-1],scope.calls
    def test_pre_worker_file_open_failure_requires_real_owned_cleanup(self):
        rc,report,calls=self.run_supervisor('verdict-open')
        self.assertEqual(rc,77)
        self.assertEqual(report['status'],'BLOCKED')
        self.assertTrue(report['cleanupVerified'])
        self.assertEqual(report['cleanupEvidence']['remainingProcesses'],0)
        self.assertEqual(report['diagnostic']['stage'],'verdict-open')
        self.assertEqual(calls,['cleanup','verify_empty','close'])
    def test_failed_create_process_cleanup_and_win32_metadata(self):
        rc,report,calls=self.run_supervisor('worker-start')
        self.assertEqual(rc,77)
        self.assertEqual(report['diagnostic'],dict(stage='CreateProcessW',win32Error=5))
        self.assertEqual(report['reason'],'startup-error')
        self.assertTrue(report['cleanupVerified'])
        self.assertEqual(calls,['start','cleanup','verify_empty','close'])
    def test_unverified_cleanup_never_passes(self):
        rc,report,calls=self.run_supervisor('worker-start',False)
        self.assertEqual(rc,77)
        self.assertIs(report['cleanupVerified'],False)
        self.assertIsNone(report['cleanupEvidence']['remainingProcesses'])
    def test_genuine_worker_fail_is_not_early_startup(self):
        rc,report,calls=self.run_supervisor('tap-fail')
        self.assertEqual(rc,77)
        self.assertEqual(report['reason'],'crash')
        self.assertEqual(report['diagnostic']['stage'],'worker-result')
        self.assertTrue(report['cleanupVerified'])
        self.assertEqual(calls,['start','poll','cleanup','verify_empty','close'])
if __name__=='__main__':unittest.main()
