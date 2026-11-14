"""Dedicated bounded owner of one Node/Chromium tree. No WSL invocation."""
import argparse
import json
import os
from pathlib import Path
import queue
import signal
import stat
import sys
import threading
import time
import traceback

from qa_owned_processes import new_scope, ScopeError, scope_diagnostic
from qa_browser_lock import BrowserLock

# Diagnostic detail is opt-in and never travels on stdout/stderr. The public
# failure fields below contain only allowlisted technical values.
ERROR_TYPES = frozenset(('ScopeError','OSError','FileNotFoundError',
    'PermissionError','TimeoutError','ValueError','TypeError','KeyError',
    'RuntimeError','NotImplementedError','AssertionError','OtherError'))
def safe_error_type(exc):
    name=type(exc).__name__
    return name if name in ERROR_TYPES else 'OtherError'

def private_trace(exc,stage,config):
    """Only create ephemeral, content-redacted frames in an owner-only POSIX temp.

    Windows ACLs cannot be verified with Python mode bits: fail closed there.
    The existing gate always deletes this per-attempt private TEMP at exit.
    """
    if sys.platform!='linux':return False
    parent=Path(config['log']).parent
    try:
        meta=parent.lstat()
        if (not stat.S_ISDIR(meta.st_mode) or meta.st_uid!=os.geteuid() or
                stat.S_IMODE(meta.st_mode)!=0o700):return False
        flags=os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW
        fd=os.open(str(parent/'diagnostic.trace'),flags,0o600)
        try:
            # No exception message, source lines, arguments, locals or full paths.
            frames=[]
            for frame,line in traceback.walk_tb(exc.__traceback__):
                frames.append({'module':Path(frame.f_code.co_filename).name[:80],
                               'function':frame.f_code.co_name[:80],'line':line})
            payload=json.dumps({'stage':stage,'type':safe_error_type(exc),
                'frames':frames[-24:]},ensure_ascii=True).encode('ascii')
            if len(payload)>8192:payload=b'{"status":"trace-overflow"}'
            if os.write(fd,payload)!=len(payload):return False
        finally:os.close(fd)
        return True
    except (OSError,ValueError,TypeError):return False


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
    first_error=None
    first_stage=None
    cleanup_error_type=None
    detail_enabled=os.environ.get('ZAMEROVAC_DIAGNOSTICS')=='1'
    def retain(exc,at):
        nonlocal first_error,first_stage
        if first_error is None:
            first_error,first_stage=exc,at
    def note_secondary(exc):
        nonlocal cleanup_error_type
        # Only the first DISTINCT cleanup failure follows the primary cause.
        if first_error is not None and exc is not first_error and cleanup_error_type is None:
            cleanup_error_type=safe_error_type(exc)
    def read_input():
        try:
            buffer=b''
            while True:
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
            try:messages.put_nowait('input-error')
            except queue.Full:pass
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
            resource.setrlimit(resource.RLIMIT_CORE,(0,0))
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
                except queue.Empty:pass
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
        retain(e,stage)
        error=safe_error_type(e)  # Never transmit arbitrary exception messages.
        diagnostic=scope_diagnostic(e,stage)
        # WindowsJob.start can fail during both its native operation and its
        # independent handle/attribute cleanup. Preserve first failure here.
        if scope is not None and stage=='worker-start':
            internal=getattr(scope,'start_cleanup_error_type',None)
            if internal is not None and cleanup_error_type is None:
                cleanup_error_type=internal if internal in ERROR_TYPES else 'OtherError'
        if scope is not None and stage in ('verdict-open','worker-start'):
            try:
                scope.cleanup()
                cleanup=scope.verify_empty() is True and not getattr(scope,'start_cleanup_error_type',None)
            except BaseException as secondary:
                cleanup=False
                note_secondary(secondary)
    finally:
        if scope:
            try:scope.close()
            except BaseException as e:
                cleanup=False
                if first_error is None:
                    retain(e,'scope-close')
                    diagnostic=scope_diagnostic(e,'scope-close')
                    error=safe_error_type(e)
                note_secondary(e)
        if browser_lock:
            try:browser_lock.close()
            except BaseException as e:
                cleanup=False
                if first_error is None:
                    retain(e,'scope-close')
                    diagnostic=scope_diagnostic(e,'scope-close')
                    error=safe_error_type(e)
                note_secondary(e)
        for sig,handler in old.items():signal.signal(sig,handler)
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
    if detail_enabled and result['status']!='PASS':
        first_diag=scope_diagnostic(first_error,first_stage) if first_error else result['diagnostic']
        result['firstFailure']={'stage':first_diag['stage'],'win32Error':first_diag['win32Error'],
                                'errorType':safe_error_type(first_error) if first_error else 'OtherError'}
        result['cleanupErrorType']=cleanup_error_type
        result['privateTracebackWritten']=private_trace(first_error,first_stage,config) if first_error else False
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
        result={'event':'result','status':'BLOCKED','cleanupVerified':False,
                'error':safe_error_type(e),'diagnostic':scope_diagnostic(e,'owner-config')}
        if os.environ.get('ZAMEROVAC_DIAGNOSTICS')=='1':
            result['firstFailure']={**result['diagnostic'],'errorType':safe_error_type(e)}
            result['privateTracebackWritten']=False
        print(json.dumps(result),flush=True)
        return 77


if __name__=='__main__':sys.exit(main())
