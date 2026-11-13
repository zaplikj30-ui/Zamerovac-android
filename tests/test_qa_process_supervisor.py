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

ROOT=Path(__file__).resolve().parents[1]
TOOLS=ROOT/'tools'
FIXTURE=r'''
const fs=require('fs'),cp=require('child_process'),path=require('path');
const [role,dir,mode]=process.argv.slice(2);
process.on('SIGTERM',()=>{});
if(role!=='leaf'){
 const p=cp.spawn(process.execPath,[__filename,role==='leader'?'child':'leaf',dir,mode],
  {detached:process.platform!=='win32',stdio:'ignore'});p.unref();
}
fs.writeFileSync(path.join(dir,role+'.tmp'),JSON.stringify({pid:process.pid,ppid:process.ppid}));
fs.renameSync(path.join(dir,role+'.tmp'),path.join(dir,role+'.json'));
if(role==='leader'&&['normal','crash'].includes(mode)){
 const t=setInterval(()=>{if(fs.existsSync(path.join(dir,'leaf.json'))){clearInterval(t);setTimeout(()=>process.exit(mode==='normal'?0:7),150)}},10);
}
setTimeout(()=>process.exit(0),6000);
'''


@unittest.skipUnless(sys.platform in ('linux','win32') and shutil.which('node') and
                     (sys.platform!='linux' or os.geteuid()!=0),'existing nonroot Linux/Windows Node required')
class OwnedRunnerTests(unittest.TestCase):
    def scenario(self, mode):
        with tempfile.TemporaryDirectory(prefix='qa-owned-runner-') as base:
            base=Path(base);work=base/'work';work.mkdir()
            sentinel=base/'outside.bin';sentinel.write_bytes(b'unchanged\x00\xff')
            neighbour=subprocess.Popen([sys.executable,'-c','import time;time.sleep(12)'])
            script=work/'fixture.cjs';script.write_text(FIXTURE)
            token='a'*32
            config={'command':[str(Path(shutil.which('node')).resolve()),str(script),'leader',str(work),mode],
                    'cwd':str(work),'log':str(work/'node.log'),'token':token,'timeout':.8,'heartbeatTimeout':.35}
            cfg=work/'config.json';cfg.write_text(json.dumps(config))
            command=[sys.executable,str(TOOLS/'qa_process_supervisor.py'),'--config',str(cfg)]
            if mode in ('ineffective','cleanup-error','close-error'):
                behavior={
                    'ineffective':'s.cleanup=lambda:True',
                    'cleanup-error':"s.cleanup=lambda:(_ for _ in ()).throw(p.ScopeError('injected cleanup error'))",
                    'close-error':"old_close=s.close\ndef bad_close():\n old_close();raise p.ScopeError('injected close error')\ns.close=bad_close"}[mode]
                wrapper=("import sys;sys.path.insert(0,sys.argv.pop(1));import qa_process_supervisor as p\n"
                         "factory=p.new_scope\ndef make():\n s=factory()\n "+behavior.replace('\n','\n ')+
                         "\n return s\np.new_scope=make\nsys.exit(p.main())")
                command=[sys.executable,'-c',wrapper,str(TOOLS),'--config',str(cfg)]
            proc=subprocess.Popen(command,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
            messages=queue.Queue()
            def read():
                for line in proc.stdout:
                    messages.put(json.loads(line))
            reader=threading.Thread(target=read,daemon=True);reader.start()
            stop=threading.Event();sender=None;members=[]
            try:
                ready=messages.get(timeout=3)
                self.assertEqual(ready.get('event'),'ready',ready)
                deadline=time.monotonic()+2
                while not all((work/(r+'.json')).exists() for r in ('leader','child','leaf')):
                    self.assertLess(time.monotonic(),deadline,'fixture failed to form complete tree')
                    time.sleep(.01)
                members=[json.loads((work/(r+'.json')).read_text())['pid'] for r in ('leader','child','leaf')]
                self.assertEqual(len(set(members)),3)
                if sys.platform=='linux':
                    self.assertNotEqual(os.getsid(members[0]),os.getsid(members[1]),'must test a detached Chromium-like session')
                if mode in ('normal','crash','timeout'):
                    def beat():
                        while not stop.wait(.03):
                            try:proc.stdin.write('ALIVE '+token+'\n');proc.stdin.flush()
                            except (OSError,ValueError):return
                    sender=threading.Thread(target=beat);sender.start()
                elif mode=='cancel':
                    proc.stdin.write('CANCEL '+token+'\n');proc.stdin.flush()
                elif mode=='signal':
                    proc.send_signal(signal.SIGTERM)
                elif mode=='invalid':
                    proc.stdin.write('wrong\n');proc.stdin.flush()
                elif mode!='heartbeat':
                    proc.stdin.close()
                result=messages.get(timeout=5)
                proc.wait(timeout=4)
                self.assertEqual(result['event'],'result')
                self.assertEqual(result['status'],'PASS' if mode=='normal' else 'BLOCKED',result)
                if mode in ('ineffective','cleanup-error','close-error'):
                    self.assertTrue(result['error'],result)
                else:
                    self.assertTrue(result['cleanupVerified'],result)
                self.assertIsNone(neighbour.poll(),'process outside owned tree was touched')
                self.assertEqual(sentinel.read_bytes(),b'unchanged\x00\xff')
                if sys.platform=='linux':
                    for pid in members:
                        self.assertFalse(Path('/proc',str(pid)).exists(),('surviving/zombie PID',pid,result))
                print(json.dumps({'mode':mode,'result':result,'fixturePids':members,'outsideProcess':'alive','sentinel':'unchanged'}),flush=True)
            finally:
                stop.set()
                if sender:sender.join(timeout=1)
                if proc.stdin and not proc.stdin.closed:
                    try:proc.stdin.close()
                    except BrokenPipeError:pass
                if proc.poll() is None:
                    try:proc.wait(timeout=5)
                    except subprocess.TimeoutExpired:proc.terminate();proc.wait(timeout=3)
                reader.join(timeout=1)
                proc.stdout.close();proc.stderr.close()
                neighbour.terminate();neighbour.wait(timeout=2)

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


if __name__=='__main__':unittest.main()
