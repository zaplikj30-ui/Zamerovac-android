"""Future explicitly approved Windows->WSL disposable probes, never Gradle.

No workflow/installation/configuration changes. This command is NOT authorized
to run merely because the file exists. Linux invocation always blocks.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import queue
import re
import subprocess
import sys
import threading

from qa_owned_processes import require_windows_service_token

ROOT=Path(__file__).resolve().parents[1]
DISTRO='Zamerovac-Ubuntu-QA'
WSL=r'C:\Windows\System32\wsl.exe'


def require(ok,message):
    if not ok:raise RuntimeError(message)


def command(*args):return [WSL,'--distribution',DISTRO,'--exec',*map(str,args)]


def check_context(expected):
    require(sys.platform=='win32','Windows service host required; no WSL call from Linux')
    require_windows_service_token()
    require(bool(re.fullmatch('[a-f0-9]{40}',expected)),'literal approved QA SHA required')
    git=lambda *args:subprocess.check_output(['git',*args],cwd=ROOT,text=True,timeout=10).strip()
    require(git('rev-parse','HEAD')==expected and not git('status','--porcelain','--untracked-files=all'),'approved clean QA checkout required')
    for name in ('tools/home_qa_wsl_bridge.py','tools/home_process_tree_probe.py','tests/test_home_process_tree.py','tools/qa_owned_processes.py'):
        expected_blob=git('rev-parse',expected+':'+name)
        file=ROOT/name
        require(not file.is_symlink() and file.is_file(),'regular trusted WSL source required')
        data=file.read_bytes()
        require(hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()==expected_blob,'WSL source bytes differ from approved SHA')
    if os.environ.get('GITHUB_ACTIONS')=='true':
        for key,value in {'GITHUB_REPOSITORY':'zaplikj30-ui/Zamerovac-android','GITHUB_ACTOR':'zaplikj30-ui',
                          'GITHUB_TRIGGERING_ACTOR':'zaplikj30-ui','GITHUB_RUN_ATTEMPT':'1',
                          'GITHUB_EVENT_NAME':'push','GITHUB_REF':'refs/heads/qa/home-props-security-20261113',
                          'ZAMEROVAC_EXPECTED_QA_SHA':expected}.items():
            require(os.environ.get(key)==value,'owner-only run identity: '+key)
    uid=subprocess.check_output(command('id','-u'),text=True,timeout=10).strip()
    require(uid.isdecimal() and int(uid)>0,'existing nonroot default WSL user required')
    return int(uid)


def one_probe(linux_root,mode,uid):
    args=command('python3',linux_root+'/tools/home_process_tree_probe.py','--probe')
    if mode=='normal':args.append('--normal')
    proc=subprocess.Popen(args,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    messages=queue.Queue();stop=threading.Event();sender=None
    def read():
        for line in proc.stdout:messages.put(json.loads(line))
    reader=threading.Thread(target=read);reader.start()
    try:
        ready=messages.get(timeout=4)
        require(ready.get('event')=='ready','WSL probe did not establish owned identities: '+str(ready))
        members=ready['members'];leader=members[0]['pid']
        require(len(members)==3 and len({m['pid'] for m in members})==3 and
                all(m['uid']==uid and m['sid']==leader and m['pgid']==leader for m in members),'WSL PID/PGID ownership mismatch')
        if mode=='eof':proc.stdin.close()
        elif mode=='cancel':proc.stdin.write('QA_CANCEL\n');proc.stdin.flush()
        elif mode=='invalid':proc.stdin.write('wrong\n');proc.stdin.flush()
        elif mode in ('normal','timeout'):
            def heartbeat():
                while not stop.wait(.05):
                    try:proc.stdin.write('QA_ALIVE\n');proc.stdin.flush()
                    except (OSError,ValueError):return
            sender=threading.Thread(target=heartbeat);sender.start()
        result=messages.get(timeout=5);proc.wait(timeout=3)
        expected={'heartbeat':'heartbeat-timeout'}.get(mode,mode)
        require(proc.returncode==0 and result.get('status')=='PASS' and result.get('reason')==expected and
                result.get('cleanupVerified') is True and sorted(result['reaped'])==sorted(m['pid'] for m in members),'WSL cleanup failed: '+str(result))
        # Independent read-only kernel check after return; never signal a PID.
        verify="import os,sys;sys.exit(any(os.path.exists('/proc/'+p) for p in sys.argv[1:]))"
        subprocess.run(command('python3','-c',verify,*[m['pid'] for m in members]),check=True,timeout=5)
        return {'mode':mode,'status':'PASS','ready':ready,'result':result,'transport':'Windows->existing nonroot WSL'}
    finally:
        stop.set()
        if sender:sender.join(timeout=1)
        if proc.stdin and not proc.stdin.closed:
            try:proc.stdin.close()
            except BrokenPipeError:pass
        if proc.poll() is None:
            try:proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                # Only the retained OWN Windows client handle, never Linux PID
                # signalling. The Linux probe has independent heartbeat timeout.
                proc.terminate();proc.wait(timeout=3)
        reader.join(timeout=2)
        proc.stdout.close();proc.stderr.close()
        require(not reader.is_alive(),'WSL output transport did not close')


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--run-home',action='store_true')
    parser.add_argument('--expected-qa-sha',required=True)
    args=parser.parse_args()
    try:
        require(args.run_home,'separate owner authorization and --run-home required')
        uid=check_context(args.expected_qa_sha)
        linux_root=subprocess.check_output(command('wslpath','-u',ROOT),text=True,timeout=5).strip()
        require(linux_root.startswith('/mnt/') and '\n' not in linux_root,'reviewed mounted QA path required')
        # Explicit pure-Python process test file, NOT generic WSL discovery.
        subprocess.run(command('python3',linux_root+'/tests/test_home_process_tree.py','-v'),check=True,timeout=30)
        for mode in ('normal','eof','heartbeat','timeout','cancel','invalid'):
            print(json.dumps(one_probe(linux_root,mode,uid)),flush=True)
        print(json.dumps({'status':'PASS','kind':'Windows-WSL disposable probes','gradle':'NOT RUN'}))
        return 0
    except Exception as e:
        print(json.dumps({'status':'BLOCKED','error':str(e)}),flush=True);return 77


if __name__=='__main__':sys.exit(main())
