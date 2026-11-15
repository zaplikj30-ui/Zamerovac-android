"""H1: real unittest scheduling, STUB owners only. No hung/native owner is made."""
import hashlib
import json
import os
from pathlib import Path
import stat
import subprocess
import sys
import tempfile
import unittest
import qa_process_stop  # Admission preflight also applies to a targeted model run.

ROOT=Path(__file__).resolve().parents[1]
CHILD=r'''
import io,json,os,sys,tempfile,unittest
from pathlib import Path
from unittest import mock
root,base,mode=Path(sys.argv[1]),Path(sys.argv[2]),sys.argv[3]
sys.path.insert(0,str(root/'tests'))
import test_qa_process_supervisor as m
marker=base/'process-tests.blocked'
if hasattr(m,'process_stop'):m.process_stop.MARKER=marker
journal=base/'launches.json'
state=json.loads(journal.read_text()) if journal.exists() else {'launches':[],'later':False}
def save():journal.write_text(json.dumps(state))
if not journal.exists():save()
original_mkdtemp=tempfile.mkdtemp
def private_temp(*args,**kwargs):return original_mkdtemp(prefix='owned-',dir=base/'evidence')
owner_count=0
class Stub:
 def __init__(self,args,**kwargs):
  global owner_count
  self.owner='--config' in args
  state['launches'].append('owner' if self.owner else 'neighbour');save()
  self.returncode=None
  if not self.owner:
   if mode=='unknown-neighbour' and len(state['launches'])==1:raise OSError('stub launch state unknown')
   return
  owner_count+=1
  cfg=json.loads(Path(args[-1]).read_text());work=Path(cfg['cwd'])
  for i,role in enumerate(('leader','child','leaf')):
   (work/(role+'.json')).write_text(json.dumps({'pid':536870900+i,'ppid':0}))
  bad=mode if owner_count==1 else 'normal'
  self.bad=bad
  report={'event':'result','status':'PASS','reason':'normal','exitCode':0,
          'token':cfg['token'],'platform':sys.platform,'cleanupVerified':True,
          'cleanupEvidence':{'remainingProcesses':0},'error':None}
  if bad=='known-cleanup':report.update(status='BLOCKED',reason='crash',exitCode=7)
  if bad=='unknown-cleanup':report.update(cleanupVerified=False,error='ScopeError')
  if bad=='wrong-token':report['token']='c'*32
  if bad=='wrong-platform':report['platform']='unknown'
  text=json.dumps({'event':'ready'})+'\n'+json.dumps(report)+'\n'
  if bad=='duplicate':text+=json.dumps(report)+'\n'
  if bad=='communication':text='PRIVATE_PATH_TOKEN_PID invalid JSON\n'
  class Input(io.StringIO):
   def close(stream):
    if stream.closed:return
    super().close()
    if bad=='known-close':raise BrokenPipeError('known closed peer')
  self.stdin=Input();self.stdout=io.StringIO(text);self.stderr=io.StringIO()
 def poll(self):return self.returncode
 def wait(self,timeout=None):
  if self.owner and self.bad=='unknown-owner':raise m.subprocess.TimeoutExpired('stub',timeout)
  self.returncode=0;return 0
 def terminate(self):
  assert not self.owner,'must never terminate owner'
  self.returncode=0
class First(unittest.TestCase):
 def test_first(self):m.OwnedRunnerTests('test_normal_exit_with_detached_children').scenario('normal')
class Later(unittest.TestCase):
 def test_later(self):
  state['later']=True;save()
  m.OwnedRunnerTests('test_normal_exit_with_detached_children').scenario('normal')
with mock.patch.object(m.subprocess,'Popen',Stub), mock.patch.object(m.tempfile,'mkdtemp',private_temp), \
     mock.patch.object(m.shutil,'which',return_value=sys.executable), \
     mock.patch.object(m.os,'getsid',lambda pid:pid,create=True):
 suite=unittest.TestSuite([First('test_first'),Later('test_later')])
 # Explicitly no failfast. H1 must stop even across TestCase classes.
 result=unittest.TextTestRunner(stream=io.StringIO(),failfast=False).run(suite)
 (base/'summary.json').write_text(json.dumps({'testsRun':result.testsRun,'failures':len(result.failures),'errors':len(result.errors)}))
 sys.exit(0 if result.wasSuccessful() else 1)
'''


@unittest.skipUnless(sys.platform=='linux' and os.geteuid()!=0,
                     'Linux isolated stub interpreters; no Windows fault payload')
class ProcessStopModels(unittest.TestCase):
    def model(self,mode,expected_exit,continued,*,preexisting=False):
        with tempfile.TemporaryDirectory(prefix='qa-h1-model-') as directory:
            base=Path(directory);(base/'evidence').mkdir()
            marker=base/'process-tests.blocked'
            if preexisting:marker.mkdir(mode=0o700)
            sentinel=base/'outside.bin';sentinel.write_bytes(b'unchanged\x00\xff')
            neighbour=subprocess.Popen([sys.executable,'-c','import time;time.sleep(15)'])
            try:
                command=[sys.executable,'-Werror::ResourceWarning','-c',CHILD,str(ROOT),str(base),mode]
                child=subprocess.run(command,capture_output=True,timeout=12)
                self.assertEqual(child.returncode,expected_exit,child.stderr.decode(errors='replace'))
                state=json.loads((base/'launches.json').read_text())
                self.assertEqual(state['later'],continued)
                expected=[] if preexisting else ['neighbour'] if mode=='unknown-neighbour' else ['neighbour','owner']*(2 if continued else 1)
                self.assertEqual(state['launches'],expected)
                self.assertIsNone(neighbour.poll(),'unrelated real process touched')
                self.assertEqual(sentinel.read_bytes(),b'unchanged\x00\xff')
                self.assertNotIn(b'PRIVATE_PATH_TOKEN_PID',child.stdout+child.stderr)
                if continued:
                    self.assertEqual(child.stderr,b'')
                    self.assertFalse(marker.exists())
                    summary=json.loads((base/'summary.json').read_text())
                    self.assertEqual(summary,dict(testsRun=2,failures=1 if mode=='known-cleanup' else 0,errors=0))
                    self.assertEqual(list((base/'evidence').iterdir()),[])
                else:
                    self.assertTrue(marker.is_dir())
                    self.assertEqual(stat.S_IMODE(marker.stat().st_mode),0o700)
                    for f in marker.iterdir():self.assertEqual(stat.S_IMODE(f.stat().st_mode),0o600)
                    before={str(p.relative_to(base)):hashlib.sha256(p.read_bytes()).hexdigest()
                            for p in base.rglob('*') if p.is_file()}
                    retry=subprocess.run(command,capture_output=True,timeout=12)
                    self.assertEqual(retry.returncode,78)
                    after={str(p.relative_to(base)):hashlib.sha256(p.read_bytes()).hexdigest()
                           for p in base.rglob('*') if p.is_file()}
                    self.assertEqual(before,after,'retry changed private evidence or launched again')
                    self.assertIsNone(neighbour.poll())
                    self.assertEqual(sentinel.read_bytes(),b'unchanged\x00\xff')
                    if not preexisting:
                        evidence=list((base/'evidence').iterdir())
                        self.assertEqual(len(evidence),1)
                        self.assertEqual(stat.S_IMODE(evidence[0].stat().st_mode),0o700)
                # Only redacted, machine-readable model observations.
                print(json.dumps({'model':mode,'exit':child.returncode,'continued':continued,
                                  'launches':len(state['launches']),'quarantined':not continued,
                                  'outsideAlive':True,'sentinelUnchanged':True}),flush=True)
            finally:
                neighbour.terminate();neighbour.wait(timeout=3)

    def test_normal_completion_continues(self):self.model('normal',0,True)
    def test_known_safe_cleanup_after_assertion_failure_continues(self):self.model('known-cleanup',1,True)
    def test_known_closed_channel_after_proved_cleanup_continues(self):self.model('known-close',0,True)
    def test_unknown_owner_stops_all_tests_and_retry(self):self.model('unknown-owner',78,False)
    def test_unknown_neighbour_launch_stops_before_owner(self):self.model('unknown-neighbour',78,False)
    def test_unknown_cleanup_stops_all_tests_and_retry(self):self.model('unknown-cleanup',78,False)
    def test_unknown_communication_stops_all_tests_and_retry(self):
        for mode in ('communication','wrong-token','wrong-platform','duplicate'):
            with self.subTest(mode=mode):self.model(mode,78,False)
    def test_preexisting_quarantine_stops_before_first_launch(self):self.model('normal',78,False,preexisting=True)

    def test_fresh_discovery_rejects_quarantine_before_any_test_body(self):
        with tempfile.TemporaryDirectory(prefix='qa-h1-discovery-') as directory:
            base=Path(directory)
            marker=base/'process-tests.blocked';marker.mkdir(mode=0o700)
            script=r'''
import io,sys,unittest
from pathlib import Path
from unittest import mock
base,root=Path(sys.argv[1]),Path(sys.argv[2])
class Earlier(unittest.TestCase):
 def test_must_not_run(self):(base/'unexpected-launch').write_text('unsafe')
original_lstat=Path.lstat
def observation(path,*args,**kwargs):
 if str(path)=='/tmp/zamerovac-qa-process-tests-'+str(os.geteuid())+'.blocked':
  return original_lstat(base/'process-tests.blocked',*args,**kwargs)
 return original_lstat(path,*args,**kwargs)
import os
with mock.patch.object(Path,'lstat',observation):
 suite=unittest.TestSuite([Earlier('test_must_not_run'),
  unittest.defaultTestLoader.discover(str(root/'tests'),pattern='test_qa_process_supervisor.py')])
 unittest.TextTestRunner(stream=io.StringIO(),failfast=False).run(suite)
'''
            p=subprocess.run([sys.executable,'-c',script,str(base),str(ROOT)],capture_output=True,timeout=10)
            self.assertEqual(p.returncode,78)
            self.assertFalse((base/'unexpected-launch').exists())
            self.assertIn(b'PROCESS_TESTS_BLOCKED_STOP_NO_RETRY',p.stderr)
            self.assertTrue(marker.is_dir())

    def test_unavailable_admission_storage_prevents_every_launch(self):
        with tempfile.TemporaryDirectory(prefix='qa-h1-storage-') as directory:
            script=r'''
import sys
from pathlib import Path
from unittest import mock
base,root=Path(sys.argv[1]),Path(sys.argv[2]);sys.path.insert(0,str(root/'tests'))
import test_qa_process_supervisor as m
m.process_stop.MARKER=base/'absent-parent'/'stop'
def forbidden(*args,**kwargs):(base/'unexpected-launch').write_text('unsafe');raise AssertionError('launch')
with mock.patch.object(m.subprocess,'Popen',forbidden):
 m.OwnedRunnerTests('test_normal_exit_with_detached_children').scenario('normal')
'''
            base=Path(directory)
            p=subprocess.run([sys.executable,'-c',script,str(base),str(ROOT)],capture_output=True,timeout=10)
            self.assertEqual(p.returncode,78)
            self.assertFalse((base/'unexpected-launch').exists())


if __name__=='__main__':unittest.main()
