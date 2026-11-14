"""Dedicated bounded owner of one Node/Chromium tree. No WSL invocation."""
import argparse
import json
import os
from pathlib import Path
import queue
import signal
import sys
import threading
import time

from qa_owned_processes import new_scope, ScopeError, scope_diagnostic
from qa_browser_lock import BrowserLock


def supervise(config):
    scope=None
    browser_lock=None
    reason='startup-error'
    code=None
    cleanup=False
    error=None
    diagnostic=None
    stage='owner-config'
    cancelled=[]
    old={}
    messages=queue.Queue(maxsize=32)
    def read_input():
        try:
            buffer=b''
            while True:
                # Raw fd reads avoid a daemon thread holding BufferedReader's
                # lock during CPython finalization (which can abort the owner).
                data=os.read(sys.stdin.fileno(),128)
                if not data:
                    messages.put('eof',timeout=.1)
                    return
                buffer+=data
                while b'\n' in buffer:
                    line,buffer=buffer.split(b'\n',1)
                    messages.put(line.decode('ascii',errors='replace').rstrip('\r'),timeout=.1)
                if len(buffer)>128:
                    messages.put('input-error',timeout=.1);return
        except Exception:
            try: messages.put_nowait('input-error')
            except queue.Full: pass
    try:
        command=config['command'];cwd=config['cwd'];log=Path(config['log'])
        if (not isinstance(command,list) or not command or
                any(not isinstance(x,str) or '\0' in x for x in command) or
                not Path(command[0]).is_absolute() or not Path(cwd).is_dir() or
                not .1<=config['timeout']<=480 or not .1<=config['heartbeatTimeout']<=10 or
                not isinstance(config['token'],str) or len(config['token'])!=32):
            raise ScopeError('invalid owned worker configuration')
        stage='owner-signals'
        for sig in (signal.SIGINT,signal.SIGTERM):
            old[sig]=signal.signal(sig,lambda signum,frame:cancelled.append(signum))
        if hasattr(signal,'SIGHUP'):
            old[signal.SIGHUP]=signal.signal(signal.SIGHUP,lambda signum,frame:cancelled.append(signum))
        if config.get('browser'):
            browser_lock=BrowserLock()
        if sys.platform=='linux':
            import resource
            resource.setrlimit(resource.RLIMIT_CORE,(0,0))  # Own process/children only, no system setting.
        stage='scope-create'
        scope=new_scope()
        os.environ['ZAMEROVAC_SUPERVISOR_PID']=str(os.getpid())
        os.environ['ZAMEROVAC_SCOPE']='windows-private-job' if sys.platform=='win32' else 'linux-pidfd-subreaper'
        stage='verdict-open'
        with log.open('xb',buffering=0) as output:
            stage='worker-start'
            owner=scope.start(command,cwd,output)
            print(json.dumps({'event':'ready',**owner,'token':config['token']}),flush=True)
            threading.Thread(target=read_input,daemon=True).start()
            started=last=time.monotonic()
            stage='worker-run'
            while True:
                now=time.monotonic()
                if cancelled:
                    reason='cancel';break
                try:
                    message=messages.get_nowait()
                    if message=='CANCEL '+config['token']:
                        reason='cancel';break
                    if message!='ALIVE '+config['token']:
                        reason='eof' if message=='eof' else 'communication-error';break
                    last=now
                except queue.Empty:
                    pass
                code=scope.poll()
                if code is not None:
                    reason='normal' if code==0 else 'crash';break
                if now-started>config['timeout']:
                    reason='timeout';break
                if now-last>config['heartbeatTimeout']:
                    reason='heartbeat-timeout';break
                time.sleep(.02)
            stage='worker-cleanup'
            scope.cleanup()
            cleanup=scope.verify_empty()
            if not cleanup:
                raise ScopeError('cleanup returned with surviving owned processes')
    except BaseException as e:
        error=type(e).__name__+': '+str(e)
        diagnostic=scope_diagnostic(e,stage)
    finally:
        if scope:
            try:
                scope.close()
            except BaseException as e:
                cleanup=False;error=(error or '')+'; emergency cleanup: '+str(e)
                if diagnostic is None:diagnostic=scope_diagnostic(e,'scope-close')
        if browser_lock:
            browser_lock.close()
        for sig,handler in old.items():
            signal.signal(sig,handler)
    result={'event':'result','token':config.get('token'),'status':'PASS' if
            reason=='normal' and code==0 and cleanup and error is None else 'BLOCKED',
            'reason':reason,'exitCode':code,'cleanupVerified':cleanup,'error':error,
            'processes':scope.observed if scope else [],'platform':sys.platform}
    result['cleanupEvidence']={'method':'Windows Job active-process query' if sys.platform=='win32' else 'Linux pidfd + subreaper + /proc',
                               'remainingProcesses':0 if cleanup else None}
    result['diagnostic']=diagnostic if error is not None else None if result['status']=='PASS' else scope_diagnostic(None,{
        'crash':'worker-result','timeout':'worker-timeout','cancel':'worker-cancel',
        'eof':'owner-channel','heartbeat-timeout':'owner-channel','communication-error':'owner-channel',
    }.get(reason,stage))
    print(json.dumps(result),flush=True)
    return 0 if result['status']=='PASS' else 77


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config',type=Path,required=True)
    opts=parser.parse_args()
    try:
        if opts.config.is_symlink() or not opts.config.is_file():
            raise ScopeError('owned regular config required')
        return supervise(json.loads(opts.config.read_text(encoding='utf-8')))
    except BaseException as e:
        print(json.dumps({'event':'result','status':'BLOCKED','cleanupVerified':False,'error':str(e),
                          'diagnostic':scope_diagnostic(e,'owner-config')}),flush=True)
        return 77


if __name__=='__main__':
    sys.exit(main())
