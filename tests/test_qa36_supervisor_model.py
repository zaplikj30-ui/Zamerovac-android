"""QA36: real Python supervisor flow, FAKE scope. No CreateProcessW, worker, or service changes."""
import contextlib
import importlib
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest import mock

TOOLS=Path(__file__).resolve().parents[1]/'tools'
sys.path.insert(0,str(TOOLS))
supervisor=importlib.import_module('qa_process_supervisor')
from qa_owned_processes import ScopeError

class FakeJob:
    observed=[]
    def __init__(self,stage='CreateProcessW',code=87,secondary=None,unverified=False):
        self.stage=stage
        self.code=code
        self.start_cleanup_error_type=secondary
        self.start_cleanup_unverified=unverified
        self.calls=[]
    def start(self,*args):
        self.calls.append('start')
        raise ScopeError('SECRET_ACCOUNT_PATH',stage=self.stage,win32_error=self.code)
    def cleanup(self):
        self.calls.append('cleanup')
        return True
    def verify_empty(self):
        self.calls.append('verify_empty')
        return True
    def close(self):
        self.calls.append('close')

class SupervisorFailureModels(unittest.TestCase):
    def run_model(self,scope):
        with tempfile.TemporaryDirectory() as temp:
            folder=Path(temp)
            config={'command':[sys.executable], 'cwd':temp,'log':str(folder/'evidence.log'),
                    'timeout':1,'heartbeatTimeout':1,'token':'c'*32}
            capture=io.StringIO()
            env=dict(os.environ)
            with mock.patch.dict(os.environ,{'ZAMEROVAC_DIAGNOSTICS':'1'}):
                with mock.patch.object(supervisor,'new_scope',return_value=scope):
                    with contextlib.redirect_stdout(capture):
                        if sys.platform=='linux':
                            import resource
                            with mock.patch.object(resource,'setrlimit'):
                                rc=supervisor.supervise(config)
                        else:
                            rc=supervisor.supervise(config)
            output=capture.getvalue()
            report=json.loads(output.splitlines()[-1])
            return rc,report,scope.calls,output

    def test_first_native_failure_and_later_restore_failure_are_distinct(self):
        rc,r,c,out=self.run_model(FakeJob(secondary='ScopeError',unverified=True))
        self.assertEqual(rc,77)
        self.assertEqual(r['status'],'BLOCKED')
        self.assertEqual(r['firstFailure']['stage'],'CreateProcessW')
        self.assertEqual(r['firstFailure']['win32Error'],87)
        self.assertEqual(r['cleanupErrorType'],'ScopeError')
        self.assertFalse(r['cleanupVerified'])
        self.assertIsNone(r['cleanupEvidence']['remainingProcesses'])
        self.assertEqual(c,['start','cleanup','verify_empty','close'])
        self.assertNotIn('SECRET_ACCOUNT_PATH',out)

    def test_isolated_thread_close_failure_is_primary_not_secondary(self):
        rc,r,c,out=self.run_model(FakeJob(stage='CloseWorkerThreadHandle',code=5,unverified=True))
        self.assertEqual(rc,77)
        self.assertEqual(r['firstFailure']['stage'],'CloseWorkerThreadHandle')
        self.assertEqual(r['firstFailure']['win32Error'],5)
        self.assertIsNone(r['cleanupErrorType'])
        self.assertFalse(r['cleanupVerified'])
        self.assertNotIn('SECRET_ACCOUNT_PATH',out)

    def test_primary_create_failure_with_proved_empty_scope_is_distinguished(self):
        rc,r,c,out=self.run_model(FakeJob())
        self.assertEqual(rc,77)
        self.assertEqual(r['status'],'BLOCKED')
        self.assertTrue(r['cleanupVerified'])
        self.assertEqual(r['cleanupEvidence']['remainingProcesses'],0)
        self.assertIsNone(r['cleanupErrorType'])
        self.assertNotIn('SECRET_ACCOUNT_PATH',out)

if __name__=='__main__':unittest.main()
