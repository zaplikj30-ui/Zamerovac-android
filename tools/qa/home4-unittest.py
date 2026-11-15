"""Fixed unittest collection and individual outcomes. No WSL Node discovery."""
import contextlib
import os
import json
from pathlib import Path
import sys
import unittest


class Result(unittest.TestResult):
    def __init__(self):super().__init__();self.rows=[]
    def addSuccess(self,test):super().addSuccess(test);self.rows.append({'id':test.id(),'status':'PASS'})
    def addFailure(self,test,error):super().addFailure(test,error);self.rows.append({'id':test.id(),'status':'FAIL'})
    def addError(self,test,error):super().addError(test,error);self.rows.append({'id':test.id(),'status':'ERROR'})
    def addSkip(self,test,reason):super().addSkip(test,reason);self.rows.append({'id':test.id(),'status':'SKIP'})
    def addExpectedFailure(self,test,error):super().addExpectedFailure(test,error);self.rows.append({'id':test.id(),'status':'FAIL'})
    def addUnexpectedSuccess(self,test):super().addUnexpectedSuccess(test);self.rows.append({'id':test.id(),'status':'FAIL'})
    def addSubTest(self,test,subtest,error):
        super().addSubTest(test,subtest,error)
        if error is not None:self.rows.append({'id':test.id()+'::subtest','status':'FAIL'})


def collect(root):
    suite=unittest.defaultTestLoader.discover(str(Path(root)/'tests'),pattern='test_*.py')
    def flatten(node):
        for item in node:
            if isinstance(item,unittest.TestSuite):yield from flatten(item)
            else:yield item
    return list(flatten(suite))


def main():
    root=Path(__file__).resolve().parents[2]
    if sys.platform!='win32' or os.environ.get('HOME4_COMMAND_WORKER_PID')!=str(os.getppid()):return 78
    registry=json.loads((root/'tools/qa/home4-quick.json').read_text())['python']
    # Capture collection and test prints only in an owned, bounded private file.
    private=Path(os.environ['HOME4_PRIVATE_DIR'])/'python-private.log'
    class Bounded:
        def __init__(self,stream):self.stream=stream;self.size=0
        def write(self,value):
            self.size+=len(value.encode('utf8'))
            if self.size>16*1024*1024:os._exit(78)
            return self.stream.write(value)
        def flush(self):self.stream.flush()
    with private.open('x',encoding='utf8') as output:
        bounded=Bounded(output)
        with contextlib.redirect_stdout(bounded),contextlib.redirect_stderr(bounded):
            tests=collect(root)
    ids=[t.id() for t in tests]
    optional=registry['windowsNotRun'] if sys.platform=='win32' else []
    expected=registry['cases']
    if len(ids)!=len(set(ids)) or set(ids)!=set(expected):return 1
    suite=unittest.TestSuite(t for t in tests if t.id() not in optional)
    result=Result()
    # Test output is private inside the owned worker, never a public artifact.
    with private.open('a',encoding='utf8') as output:
        bounded.stream=output
        with contextlib.redirect_stdout(bounded),contextlib.redirect_stderr(bounded):suite.run(result)
    rows=result.rows+[{'id':i,'status':'NOT RUN'} for i in optional]
    print(json.dumps({'protocol':'home4-python-v1','complete':result.testsRun==len(expected)-len(optional),
                      'cases':rows,'counts':{'tests':result.testsRun,'fail':len(result.failures),'error':len(result.errors),'skip':len(result.skipped)}}))
    return 0 if result.wasSuccessful() else 1


if __name__=='__main__':sys.exit(main())
