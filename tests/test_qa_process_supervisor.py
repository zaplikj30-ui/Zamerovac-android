"""Real runner containment, including detached Node descendants; never WSL."""
import importlib.util
import json
import os
from pathlib import Path
import queue
import shutil
import signal
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from unittest import mock
import qa_process_stop as process_stop

ROOT=Path(__file__).resolve().parents[1]
TOOLS=ROOT/'tools'
FIXTURE=r'''
const fs=require('fs'),cp=require('child_process'),path=require('path');
const [role,dir,mode,preparationDelay='0',preparationFault='']=process.argv.slice(2);
process.on('SIGTERM',()=>{});
// Test-only finite delay: reproduce slow fixture preparation, never a native hang.
if(role==='leader')Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,Number(preparationDelay));
if(role!=='leaf'){
 const p=cp.spawn(process.execPath,[__filename,role==='leader'?'child':'leaf',dir,mode,'0',preparationFault],
  {detached:process.platform!=='win32',stdio:'ignore'});p.unref();
}
fs.writeFileSync(path.join(dir,role+'.tmp'),JSON.stringify({pid:process.pid,ppid:process.ppid}));
fs.renameSync(path.join(dir,role+'.tmp'),path.join(dir,role+(role==='leaf'&&preparationFault==='withhold-leaf'?'-withheld':'')+'.json'));
if(role==='leader'&&['normal','crash'].includes(mode)){
 const t=setInterval(()=>{if(fs.existsSync(path.join(dir,'begin'))){clearInterval(t);setTimeout(()=>process.exit(mode==='normal'?0:7),150)}},10);
}
setTimeout(()=>process.exit(0),6000);
'''


# Test-only preparation barrier. LinuxScope still creates/contains the complete
# tree. The UNCHANGED supervisor starts its .8/.35 timers on return from start().
# Move the existing 2s fixture wait here, before ready; never pause its runtime
# clocks or extend their limits. Any incomplete preparation raises into the
# supervisor's existing start-failure cleanup. No Windows entrypoint uses this.
PREPARED_START=r'''
original_start=s.start
def prepared_start(command,cwd,log):
 owner=original_start(command,cwd,log)
 deadline=time.monotonic()+2
 while True:
  if s.poll() is not None or time.monotonic()>=deadline:
   raise p.ScopeError('fixture preparation incomplete')
  if all((Path(cwd)/(role+'.json')).exists() for role in ('leader','child','leaf')):
   return owner
  time.sleep(.01)
s.start=prepared_start
'''


def safe_verdict(report):
    """Only fixed technical values; never include tokens, PIDs, paths or logs."""
    reasons={'normal','crash','timeout','cancel','eof','heartbeat-timeout',
             'communication-error','startup-error'}
    report=report if isinstance(report,dict) else {}
    cleanup=report.get('cleanupEvidence')
    cleanup=cleanup if isinstance(cleanup,dict) else {}
    reason=report.get('reason')
    remaining=cleanup.get('remainingProcesses')
    return {'status':report.get('status') if report.get('status') in ('PASS','BLOCKED') else 'unknown',
            'reason':reason if isinstance(reason,str) and reason in reasons else 'unknown',
            'cleanupVerified':report.get('cleanupVerified') is True,
            'ownedEmpty':type(remaining) is int and remaining==0}


@unittest.skipUnless(sys.platform=='linux' and shutil.which('node') and os.geteuid()!=0,
                     'Linux process proof; native Windows fault testing requires separate isolated approval')
class OwnedRunnerTests(unittest.TestCase):
    def scenario(self, mode, preparation_delay=0, preparation_fault=''):
        # Unknown owner/cleanup => retain private evidence, STOP, never PID kill.
        admission=process_stop.claim()
        try:
            temporary=Path(tempfile.mkdtemp(prefix='qa-owned-runner-'))
            admission.retain_evidence(temporary)
        except BaseException:process_stop.abort()
        proc=neighbour=reader=sender=None
        stop=threading.Event()
        final_reports=[];read_errors=[];members=[]
        completed=False;owner_attempted=False;neighbour_attempted=False
        token='a'*32
        try:
            work=temporary/'work';work.mkdir()
            sentinel=temporary/'outside.bin';sentinel.write_bytes(b'unchanged\x00\xff')
            neighbour_attempted=True
            neighbour=subprocess.Popen([sys.executable,'-c','import time;time.sleep(12)'])
            script=work/'fixture.cjs';script.write_text(FIXTURE)
            config={'command':[str(Path(shutil.which('node')).resolve()),str(script),'leader',str(work),mode,str(preparation_delay),preparation_fault],
                    'cwd':str(work),'log':str(work/'node.log'),'token':token,'timeout':.8,'heartbeatTimeout':.35}
            cfg=work/'config.json';cfg.write_text(json.dumps(config))
            behavior={
                'ineffective':'s.cleanup=lambda:True',
                'cleanup-error':"s.cleanup=lambda:(_ for _ in ()).throw(p.ScopeError('injected cleanup error'))",
                'close-error':"old_close=s.close\ndef bad_close():\n old_close();raise p.ScopeError('injected close error')\ns.close=bad_close"}.get(mode,'')
            wrapper=("import sys,time;from pathlib import Path;sys.path.insert(0,sys.argv.pop(1));import qa_process_supervisor as p\n"
                     "factory=p.new_scope\ndef make():\n s=factory()\n "+behavior.replace('\n','\n ')+
                     '\n '+PREPARED_START.strip().replace('\n','\n ')+
                     "\n return s\np.new_scope=make\nsys.exit(p.main())")
            command=[sys.executable,'-c',wrapper,str(TOOLS),'--config',str(cfg)]
            owner_attempted=True
            proc=subprocess.Popen(command,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
            messages=queue.Queue()
            def read():
                try:
                    for line in proc.stdout:
                        report=json.loads(line)
                        if not isinstance(report,dict):raise ValueError('invalid fixture report')
                        if report.get('event')=='result':final_reports.append(report)
                        messages.put(report)
                except (OSError,ValueError):
                    read_errors.append(True)
                    messages.put({'event':'fixture-protocol-error'})
            reader=threading.Thread(target=read,daemon=True);reader.start()
            ready=messages.get(timeout=3)
            if preparation_fault:
                result=ready
                roles=('leader','child','leaf-withheld')
                self.assertEqual(safe_verdict(result),dict(status='BLOCKED',reason='startup-error',cleanupVerified=True,ownedEmpty=True))
                self.assertEqual(result['diagnostic']['stage'],'worker-start')
                self.assertEqual(result['error'],'ScopeError')
            else:
                self.assertEqual(ready.get('event'),'ready',safe_verdict(ready))
                # Start heartbeats at ready, before assertions or scenario action.
                proc.stdin.write('ALIVE '+token+'\n');proc.stdin.flush()
                def beat():
                    while not stop.wait(.03):
                        try:proc.stdin.write('ALIVE '+token+'\n');proc.stdin.flush()
                        except (OSError,ValueError):return
                sender=threading.Thread(target=beat);sender.start()
                roles=('leader','child','leaf')
                self.assertTrue(all((work/(r+'.json')).exists() for r in roles),
                                'ready published before complete fixture tree')
                members=[json.loads((work/(r+'.json')).read_text())['pid'] for r in roles]
                self.assertEqual(len(set(members)),3)
                self.assertNotEqual(os.getsid(members[0]),os.getsid(members[1]),
                                    'must test a detached Chromium-like session')
                (work/'begin').write_text('begin')
                if mode not in ('normal','crash','timeout'):
                    stop.set();sender.join(timeout=1)
                    self.assertFalse(sender.is_alive(),'fixture heartbeat did not stop')
                if mode=='cancel':
                    proc.stdin.write('CANCEL '+token+'\n');proc.stdin.flush()
                elif mode=='signal':
                    proc.send_signal(signal.SIGTERM)
                elif mode=='invalid':
                    proc.stdin.write('wrong\n');proc.stdin.flush()
                elif mode not in ('heartbeat','normal','crash','timeout'):
                    proc.stdin.close()
                result=messages.get(timeout=5)
                reason={'normal':'normal','crash':'crash','timeout':'timeout','cancel':'cancel',
                        'signal':'cancel','heartbeat':'heartbeat-timeout','invalid':'communication-error'}.get(mode,'eof')
                self.assertEqual(result['reason'],reason,safe_verdict(result))
                if mode in ('ineffective','cleanup-error','close-error'):
                    self.assertTrue(result['error'],safe_verdict(result))
                    self.assertFalse(result['cleanupVerified'],safe_verdict(result))
                else:
                    self.assertTrue(result['cleanupVerified'],safe_verdict(result))
                    self.assertEqual(result['cleanupEvidence']['remainingProcesses'],0)
                if mode in ('normal','crash'):
                    self.assertEqual(result['exitCode'],0 if mode=='normal' else 7)
            proc.wait(timeout=4)
            self.assertEqual(result['event'],'result')
            self.assertEqual(result['token'],token)
            self.assertEqual(result['platform'],sys.platform)
            self.assertEqual(result['status'],'PASS' if mode=='normal' and not preparation_fault else 'BLOCKED',safe_verdict(result))
            self.assertEqual(proc.returncode,0 if mode=='normal' and not preparation_fault else 77)
            members=[json.loads((work/(r+'.json')).read_text())['pid'] for r in roles]
            self.assertEqual(len(set(members)),3)
            for pid in members:
                self.assertFalse(Path('/proc',str(pid)).exists(),'surviving/zombie owned process')
            self.assertIsNone(neighbour.poll(),'process outside owned tree was touched')
            self.assertEqual(sentinel.read_bytes(),b'unchanged\x00\xff')
            completed=True
            print(json.dumps({'mode':'preparation-failure' if preparation_fault else mode,
                              **safe_verdict(result),'outsideProcess':'alive','sentinel':'unchanged'}),flush=True)
        finally:
            channel_cleanup=True
            stopped=False
            try:
                stop.set()
                if sender:sender.join(timeout=1)
                if proc and proc.stdin and not proc.stdin.closed:
                    try:proc.stdin.close()
                    except BrokenPipeError:pass  # Only safe if independent owner/cleanup proof below succeeds.
                    except OSError:channel_cleanup=False
                if proc and proc.poll() is None:
                    # EOF requests existing containment/cleanup. Unknown => STOP.
                    try:proc.wait(timeout=5)
                    except subprocess.TimeoutExpired:pass
                if reader:reader.join(timeout=1)
                stopped=proc is not None and proc.poll() is not None and reader is not None and not reader.is_alive()
                if stopped:proc.stdout.close();proc.stderr.close()
            except BaseException:channel_cleanup=False
            neighbour_stopped=not neighbour_attempted
            if neighbour:
                try:
                    neighbour.terminate();neighbour.wait(timeout=2);neighbour_stopped=True
                except BaseException:neighbour_stopped=False
            report=final_reports[0] if len(final_reports)==1 else {}
            protocol_known=(not read_errors and len(final_reports)==1 and report.get('event')=='result' and
                            report.get('platform')==sys.platform and report.get('token')==token)
            safe=(not owner_attempted or (stopped and protocol_known and
                  (completed or safe_verdict(report)['cleanupVerified'] and
                  safe_verdict(report)['ownedEmpty'])))
            if not safe or not channel_cleanup or not neighbour_stopped or (sender and sender.is_alive()):
                admission.block(ownerStopped=stopped,protocolKnown=protocol_known,
                                cleanupKnown=safe,neighbourStopped=neighbour_stopped,
                                senderStopped=not sender or not sender.is_alive(),channelCleanup=channel_cleanup)
            try:shutil.rmtree(temporary)
            except BaseException:admission.block(filesRemoved=False)
            admission.release_verified()

    def test_normal_exit_with_detached_children(self):self.scenario('normal')
    def test_crashed_node(self):self.scenario('crash')
    def test_eof(self):self.scenario('eof')
    def test_timeout(self):self.scenario('timeout')
    def test_cancel(self):self.scenario('cancel')
    @unittest.skipUnless(sys.platform=='linux','POSIX signals; Windows uses tokened cancel protocol')
    def test_signal_cancel(self):self.scenario('signal')
    def test_heartbeat_loss(self):self.scenario('heartbeat')
    def test_invalid_communication(self):self.scenario('invalid')
    def test_ineffective_primary_cleanup(self):self.scenario('ineffective')
    def test_cleanup_error(self):self.scenario('cleanup-error')
    def test_final_close_error(self):self.scenario('close-error')


@unittest.skipUnless(sys.platform=='linux' and shutil.which('node') and os.geteuid()!=0,
                     'Linux process proof; native Windows fault testing requires separate isolated approval')
class FixturePreparationTests(unittest.TestCase):
    scenario=OwnedRunnerTests.scenario

    def test_slow_tree_preparation_preserves_timeout_scenario(self):
        self.scenario('timeout',preparation_delay=1000)

    def test_slow_tree_cancel_and_cleanup_failures(self):
        for mode in ('cancel','cleanup-error','close-error'):
            with self.subTest(mode=mode):self.scenario(mode,preparation_delay=1000)

    def test_slow_tree_normal_crash_and_heartbeat_loss(self):
        for mode in ('normal','crash','heartbeat'):
            with self.subTest(mode=mode):self.scenario(mode,preparation_delay=1000)

    def test_incomplete_preparation_fails_closed_and_cleans_tree(self):
        self.scenario('cancel',preparation_fault='withhold-leaf')

    def test_missing_preparation_barrier_is_detected(self):
        # Deliberate test-only mutation, not a runtime switch. Reintroducing the
        # old ready-before-tree race must fail, with independently safe cleanup.
        with mock.patch(__name__+'.PREPARED_START',''):
            with self.assertRaisesRegex(AssertionError,'ready published before complete fixture tree'):
                self.scenario('timeout',preparation_delay=1000)


class FixtureDiagnosticModels(unittest.TestCase):
    def test_redaction_uses_constants_and_strict_cleanup_observations(self):
        self.assertEqual(safe_verdict({'status':'PASS','reason':'normal',
            'cleanupVerified':True,'cleanupEvidence':{'remainingProcesses':0}}),
            dict(status='PASS',reason='normal',cleanupVerified=True,ownedEmpty=True))
        secret='PRIVATE_PATH_TOKEN_PID'
        for record in (None,{'status':secret,'reason':secret,'cleanupVerified':1,
                        'cleanupEvidence':{'remainingProcesses':False},'token':secret},
                       {'reason':[],'cleanupEvidence':None}):
            report=safe_verdict(record)
            self.assertNotIn(secret,json.dumps(report))
            self.assertFalse(report['cleanupVerified'])
            self.assertFalse(report['ownedEmpty'])


if __name__=='__main__':unittest.main()
