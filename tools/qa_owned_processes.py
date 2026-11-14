"""Owned-process containment. Linux pidfds/subreaper; Windows private Job Object.

No caller-supplied PID is killed. Instances live in a dedicated supervisor with
no unrelated children. Windows children cannot run before Job assignment.
"""
import ctypes
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import time


_DIAGNOSTIC=json.loads((Path(__file__).with_name('qa-process-diagnostic.json')).read_text(encoding='utf-8'))
_NATIVE_STAGES=frozenset(_DIAGNOSTIC['win32Stages'])
_STAGES=frozenset(_DIAGNOSTIC['stages'])|_NATIVE_STAGES

class ScopeError(RuntimeError):
    def __init__(self,message,*,stage=None,win32_error=None):
        super().__init__(message)
        self.stage=stage
        self.win32_error=win32_error

def scope_diagnostic(error,fallback):
    stage=getattr(error,'stage',None) if isinstance(error,ScopeError) else None
    stage=stage if isinstance(stage,str) and stage in _STAGES else fallback if isinstance(fallback,str) and fallback in _STAGES else 'unknown'
    code=getattr(error,'win32_error',None) if isinstance(error,ScopeError) else None
    return {'stage':stage,'win32Error':code if stage in _NATIVE_STAGES and type(code) is int and 0<=code<=0xffffffff else None}

def _win_error(message,stage):
    # Read immediately after the failed API, before any cleanup can overwrite it.
    code=ctypes.get_last_error()
    return ScopeError(message+' WinError='+str(code),stage=stage,win32_error=code)

def _set_inheritable(handle,value):
    try:os.set_handle_inheritable(handle,value)
    except OSError as error:
        raise ScopeError('handle inheritance failed',stage='SetHandleInformation',
                         win32_error=getattr(error,'winerror',None)) from error


def proc_info(pid):
    try:
        root = Path('/proc') / str(pid)
        raw = (root / 'stat').read_text()
        f = raw[raw.rfind(')') + 2:].split()
        return {'pid': pid, 'ppid': int(f[1]), 'start': int(f[19]), 'uid': root.stat().st_uid}
    except (FileNotFoundError, ProcessLookupError):
        return None


class LinuxScope:
    def __init__(self):
        if sys.platform != 'linux' or os.geteuid() == 0:
            raise ScopeError('nonroot Linux required')
        if not hasattr(os, 'pidfd_open') or not hasattr(signal, 'pidfd_send_signal'):
            raise ScopeError('kernel/Python pidfd support required')
        if ctypes.CDLL(None, use_errno=True).prctl(36, 1, 0, 0, 0):
            raise ScopeError('subreaper unavailable')
        # Feature names alone are insufficient under a restricted kernel.
        # Probe our own handle without starting any workload or changing state.
        fd=None
        try:
            fd=os.pidfd_open(os.getpid())
            signal.pidfd_send_signal(fd,0)
        except OSError as e:
            raise ScopeError('usable pidfd signals required before spawn: '+str(e)) from e
        finally:
            if fd is not None:os.close(fd)
        self.child = None
        self.fds = {}
        self.observed = []

    def start(self, command, cwd, log):
        self.child = subprocess.Popen(command, cwd=cwd, stdin=subprocess.DEVNULL,
                                      stdout=log, stderr=log, start_new_session=True)
        self.capture()
        return {'pid': self.child.pid, 'backend': 'linux-pidfd-subreaper'}

    def capture(self):
        all_processes = {}
        for p in Path('/proc').iterdir():
            if p.name.isdecimal():
                info = proc_info(int(p.name))
                if info:
                    all_processes[info['pid']] = info
        owned = {os.getpid()}
        pending = []
        while True:
            new = [p for p in all_processes.values() if p['ppid'] in owned and p['pid'] not in owned]
            if not new:
                break
            pending.extend(new)
            owned.update(p['pid'] for p in new)
        errors=[]
        for p in pending:
            key = (p['pid'], p['start'])
            if key in self.fds:
                continue
            # Snapshot PPIDs alone are insufficient: an intermediate child may
            # be reaped by its parent and its numeric PID reused during /proc
            # enumeration. Revalidate the live ancestry, including starttimes.
            chain=[];current=p;seen=set()
            while current and current['pid']!=os.getpid() and current['pid'] not in seen:
                seen.add(current['pid']);chain.append(current)
                current=proc_info(current['ppid'])
            if not current or current['pid']!=os.getpid() or any(proc_info(n['pid'])!=n for n in chain):
                continue
            if p['uid'] != os.geteuid():
                errors.append('descendant ownership changed');continue
            try:
                fd = os.pidfd_open(p['pid'])
            except ProcessLookupError:
                continue
            if any(proc_info(n['pid'])!=n for n in chain):
                os.close(fd)
                continue
            self.fds[key] = fd
            self.observed.append(p)
        if errors:raise ScopeError('; '.join(errors))
        return pending

    def send(self, sig):
        errors=[]
        try:self.capture()
        except ScopeError as e:errors.append(str(e))
        for fd in tuple(self.fds.values()):
            try:
                signal.pidfd_send_signal(fd, sig)
            except ProcessLookupError:
                pass
            except OSError as e:errors.append(str(e))
        if errors:raise ScopeError('; '.join(errors))

    def poll(self):
        self.capture()
        return self.child.poll()

    def cleanup(self):
        # TERM gives cooperative processes a chance; then freeze each verified
        # descendant before KILL so newly detached sessions cannot evade a group.
        errors=[]
        try:self.send(signal.SIGTERM)
        except ScopeError as e:errors.append(str(e))
        time.sleep(.12)
        deadline = time.monotonic() + 2
        while time.monotonic() < deadline:
            for sig in (signal.SIGSTOP,signal.SIGKILL):
                try:self.send(sig)
                except ScopeError as e:errors.append(str(e))
            self.child.poll()
            try:
                while os.waitpid(-1, os.WNOHANG)[0]:
                    pass
            except ChildProcessError:
                pass
            try:remaining=self.capture()
            except ScopeError as e:errors.append(str(e));remaining=True
            if not remaining:
                if errors:raise ScopeError('primary cleanup error: '+errors[0])
                return True
            time.sleep(.01)
        raise ScopeError('owned descendants not fully reaped')

    def close(self):
        # A failed primary cleanup remains a failure even if recovery succeeds.
        try:
            if self.child:
                LinuxScope.cleanup(self)
        finally:
            for fd in self.fds.values():
                os.close(fd)
            self.fds.clear()

    def verify_empty(self):
        return not self.capture()


def require_windows_service_token():
    if sys.platform!='win32':raise ScopeError('Windows service token required',stage='token-platform')
    from ctypes import wintypes as w
    k=ctypes.WinDLL('kernel32',use_last_error=True)
    advapi=ctypes.WinDLL('advapi32',use_last_error=True)
    k.GetCurrentProcess.argtypes=[];k.GetCurrentProcess.restype=w.HANDLE
    k.CloseHandle.argtypes=[w.HANDLE];k.CloseHandle.restype=w.BOOL
    advapi.OpenProcessToken.argtypes=[w.HANDLE,w.DWORD,ctypes.POINTER(w.HANDLE)];advapi.OpenProcessToken.restype=w.BOOL
    advapi.GetTokenInformation.argtypes=[w.HANDLE,ctypes.c_int,ctypes.c_void_p,w.DWORD,ctypes.POINTER(w.DWORD)];advapi.GetTokenInformation.restype=w.BOOL
    advapi.DuplicateToken.argtypes=[w.HANDLE,ctypes.c_int,ctypes.POINTER(w.HANDLE)];advapi.DuplicateToken.restype=w.BOOL
    advapi.CreateWellKnownSid.argtypes=[ctypes.c_int,ctypes.c_void_p,ctypes.c_void_p,ctypes.POINTER(w.DWORD)];advapi.CreateWellKnownSid.restype=w.BOOL
    advapi.CheckTokenMembership.argtypes=[w.HANDLE,ctypes.c_void_p,ctypes.POINTER(w.BOOL)];advapi.CheckTokenMembership.restype=w.BOOL
    advapi.GetUserNameW.argtypes=[w.LPWSTR,ctypes.POINTER(w.DWORD)];advapi.GetUserNameW.restype=w.BOOL
    token=w.HANDLE();impersonation=w.HANDLE()
    # Windows SCM can give a NON-admin service HIGH integrity. TokenElevation
    # is therefore not proof of effective administrative membership.
    if not advapi.OpenProcessToken(k.GetCurrentProcess(),0x000A,ctypes.byref(token)):  # QUERY | DUPLICATE
        raise _win_error('cannot verify current Windows token','OpenProcessToken')
    try:
        elevation_type=w.DWORD();returned=w.DWORD()
        if not advapi.GetTokenInformation(token,18,ctypes.byref(elevation_type),ctypes.sizeof(elevation_type),ctypes.byref(returned)):
            raise _win_error('cannot query Windows linked-token type','GetTokenInformation')
        # Reject linked UAC admin tokens (Full OR Limited); only a default,
        # unlinked service token can enter this dedicated QA boundary.
        if elevation_type.value!=1:
            raise ScopeError('linked administrator token not permitted',stage='token-admin')
        sid=ctypes.create_string_buffer(68)  # SECURITY_MAX_SID_SIZE
        sid_size=w.DWORD(ctypes.sizeof(sid))
        if not advapi.CreateWellKnownSid(26,None,sid,ctypes.byref(sid_size)):  # WinBuiltinAdministratorsSid
            raise _win_error('cannot construct administrator SID','CreateWellKnownSid')
        # CheckTokenMembership requires an impersonation token; explicitly
        # duplicate THIS process token, not the calling thread's identity.
        if not advapi.DuplicateToken(token,2,ctypes.byref(impersonation)):  # SecurityImpersonation
            raise _win_error('cannot duplicate service token for query','DuplicateToken')
        admin=w.BOOL()
        if not advapi.CheckTokenMembership(impersonation,sid,ctypes.byref(admin)):
            raise _win_error('cannot check enabled administrator membership','CheckTokenMembership')
        # Disabled and deny-only Administrator SIDs cannot grant allow-ACEs.
        # A token that actually enables Administrators must never start QA.
        if admin.value:
            raise ScopeError('enabled administrator token not permitted',stage='token-admin')
    finally:
        close_error=None
        if impersonation.value and not k.CloseHandle(impersonation):
            close_error=_win_error('close duplicated token failed','CloseImpersonationTokenHandle')
        if token.value and not k.CloseHandle(token):
            if close_error is None:close_error=_win_error('close token query handle failed','CloseTokenHandle')
        if close_error is not None:raise close_error
    user=ctypes.create_unicode_buffer(256);length=w.DWORD(256)
    if not advapi.GetUserNameW(user,ctypes.byref(length)):
        raise _win_error('cannot query Windows account','GetUserNameW')
    if user.value.casefold()!='zamerovacqa':
        raise ScopeError('existing ZamerovacQA service token required',stage='token-account')


class WindowsJob:
    def __init__(self):
        if sys.platform != 'win32':
            raise ScopeError('Windows Job runtime required')
        from ctypes import wintypes as w
        self.w = w
        self.k = ctypes.WinDLL('kernel32', use_last_error=True)
        require_windows_service_token()
        size = ctypes.c_size_t
        class Basic(ctypes.Structure):
            _fields_ = [('processTime',ctypes.c_longlong),('jobTime',ctypes.c_longlong),
                        ('flags',w.DWORD),('minWorking',size),('maxWorking',size),
                        ('activeLimit',w.DWORD),('affinity',size),('priority',w.DWORD),('scheduling',w.DWORD)]
        class Limits(ctypes.Structure):
            _fields_ = [('basic',Basic),('io',ctypes.c_ulonglong*6),('processMemory',size),
                        ('jobMemory',size),('peakProcess',size),('peakJob',size)]
        class Accounting(ctypes.Structure):
            _fields_ = [('times',ctypes.c_longlong*4),('faults',w.DWORD),('total',w.DWORD),
                        ('active',w.DWORD),('terminated',w.DWORD)]
        class Startup(ctypes.Structure):
            _fields_ = [('cb',w.DWORD),('reserved',w.LPWSTR),('desktop',w.LPWSTR),('title',w.LPWSTR),
                        ('x',w.DWORD),('y',w.DWORD),('width',w.DWORD),('height',w.DWORD),
                        ('charsX',w.DWORD),('charsY',w.DWORD),('fill',w.DWORD),('flags',w.DWORD),
                        ('show',w.WORD),('reservedBytes',w.WORD),('reservedPtr',ctypes.c_void_p),
                        ('stdin',w.HANDLE),('stdout',w.HANDLE),('stderr',w.HANDLE)]
        class StartupEx(ctypes.Structure):
            _fields_ = [('startup',Startup),('attributes',ctypes.c_void_p)]
        class Process(ctypes.Structure):
            _fields_ = [('process',w.HANDLE),('thread',w.HANDLE),('pid',w.DWORD),('tid',w.DWORD)]
        self.Accounting,self.StartupEx,self.Process = Accounting,StartupEx,Process
        signatures = {
          'CreateJobObjectW':([ctypes.c_void_p,w.LPCWSTR],w.HANDLE),
          'SetInformationJobObject':([w.HANDLE,ctypes.c_int,ctypes.c_void_p,w.DWORD],w.BOOL),
          'QueryInformationJobObject':([w.HANDLE,ctypes.c_int,ctypes.c_void_p,w.DWORD,ctypes.c_void_p],w.BOOL),
          'AssignProcessToJobObject':([w.HANDLE,w.HANDLE],w.BOOL),
          'TerminateJobObject':([w.HANDLE,w.UINT],w.BOOL),
          'TerminateProcess':([w.HANDLE,w.UINT],w.BOOL),
          'GetExitCodeProcess':([w.HANDLE,ctypes.POINTER(w.DWORD)],w.BOOL),
          'WaitForSingleObject':([w.HANDLE,w.DWORD],w.DWORD),
          'ResumeThread':([w.HANDLE],w.DWORD),
          'CloseHandle':([w.HANDLE],w.BOOL),
          'InitializeProcThreadAttributeList':([ctypes.c_void_p,w.DWORD,w.DWORD,ctypes.POINTER(size)],w.BOOL),
          'UpdateProcThreadAttribute':([ctypes.c_void_p,w.DWORD,size,ctypes.c_void_p,size,ctypes.c_void_p,ctypes.c_void_p],w.BOOL),
          'DeleteProcThreadAttributeList':([ctypes.c_void_p],None),
          'CreateProcessW':([w.LPCWSTR,w.LPWSTR,ctypes.c_void_p,ctypes.c_void_p,w.BOOL,w.DWORD,ctypes.c_void_p,w.LPCWSTR,ctypes.c_void_p,ctypes.POINTER(Process)],w.BOOL),
          'GetProcessTimes':([w.HANDLE,ctypes.c_void_p,ctypes.c_void_p,ctypes.c_void_p,ctypes.c_void_p],w.BOOL),
          'QueryFullProcessImageNameW':([w.HANDLE,w.DWORD,w.LPWSTR,ctypes.POINTER(w.DWORD)],w.BOOL)}
        for name,(args,result) in signatures.items():
            fn=getattr(self.k,name);fn.argtypes=args;fn.restype=result
        self.job=self.k.CreateJobObjectW(None,None)
        self.process=None
        if not self.job:
            raise _win_error('CreateJobObject failed','CreateJobObjectW')
        limits=Limits();limits.basic.flags=0x2000  # KILL_ON_JOB_CLOSE; never BREAKAWAY.
        if not self.k.SetInformationJobObject(self.job,9,ctypes.byref(limits),ctypes.sizeof(limits)):
            failure=_win_error('Job kill-on-close unavailable','SetInformationJobObject')
            self.close();raise failure
        self.observed=[]

    def demand(self, ok, message):
        if not ok:
            stage={
              'initialize handle list':'InitializeProcThreadAttributeList',
              'restrict inherited handles':'UpdateProcThreadAttribute',
              'create suspended owned worker':'CreateProcessW',
              'assign private job before resume':'AssignProcessToJobObject',
              'worker image identity':'QueryFullProcessImageNameW',
              'worker creation identity':'GetProcessTimes','resume owned worker':'ResumeThread',
              'read worker exit':'GetExitCodeProcess','terminate owned job':'TerminateJobObject',
              'verify job empty':'QueryInformationJobObject',
            }.get(message)
            if stage:raise _win_error(message,stage)
            # A failed logical comparison has no GetLastError contract.
            raise ScopeError(message,stage='worker-image-check' if message=='worker executable changed' else 'unknown')

    def start(self, command, cwd, log):
        import msvcrt
        w=self.w;k=self.k;startup=self.StartupEx();startup.startup.cb=ctypes.sizeof(startup)
        info=self.Process();size=ctypes.c_size_t()
        k.InitializeProcThreadAttributeList(None,1,0,ctypes.byref(size))
        attributes=ctypes.create_string_buffer(size.value)
        self.demand(k.InitializeProcThreadAttributeList(attributes,1,0,ctypes.byref(size)),'initialize handle list')
        null=open(os.devnull,'rb')
        handles=(w.HANDLE*2)(msvcrt.get_osfhandle(null.fileno()),msvcrt.get_osfhandle(log.fileno()))
        try:
            for handle in handles:
                _set_inheritable(handle,True)
            self.demand(k.UpdateProcThreadAttribute(attributes,0,0x20002,handles,ctypes.sizeof(handles),None,None),'restrict inherited handles')
            startup.attributes=ctypes.cast(attributes,ctypes.c_void_p)
            startup.startup.flags=0x100
            startup.startup.stdin, startup.startup.stdout, startup.startup.stderr=handles[0],handles[1],handles[1]
            cmd=ctypes.create_unicode_buffer(subprocess.list2cmdline(command))
            self.demand(k.CreateProcessW(command[0],cmd,None,None,True,0x08080004,None,str(cwd),ctypes.byref(startup),ctypes.byref(info)),'create suspended owned worker')
            self.process=info.process
            try:
                self.demand(k.AssignProcessToJobObject(self.job,self.process),'assign private job before resume')
                image=ctypes.create_unicode_buffer(32768);length=w.DWORD(len(image))
                self.demand(k.QueryFullProcessImageNameW(self.process,0,image,ctypes.byref(length)),'worker image identity')
                self.demand(Path(image.value).resolve()==Path(command[0]).resolve(),'worker executable changed')
                times=[ctypes.c_ulonglong() for _ in range(4)]
                self.demand(k.GetProcessTimes(self.process,*[ctypes.byref(t) for t in times]),'worker creation identity')
                self.demand(k.ResumeThread(info.thread)!=0xffffffff,'resume owned worker')
                self.observed=[{'pid':info.pid,'creationTime':times[0].value,'sameToken':True}]
                return {'pid':info.pid,'creationTime':times[0].value,'backend':'windows-private-job'}
            except BaseException:
                k.TerminateProcess(self.process,77)  # Own retained handle, never a PID lookup.
                k.WaitForSingleObject(self.process,2000)
                raise
            finally:
                k.CloseHandle(info.thread)
        finally:
            for handle in handles:
                _set_inheritable(handle,False)
            null.close();k.DeleteProcThreadAttributeList(attributes)

    def poll(self):
        code=self.w.DWORD();self.demand(self.k.GetExitCodeProcess(self.process,ctypes.byref(code)),'read worker exit')
        return None if code.value==259 else code.value

    def cleanup(self):
        self.demand(self.k.TerminateJobObject(self.job,77),'terminate owned job')
        deadline=time.monotonic()+2
        while time.monotonic()<deadline:
            info=self.Accounting()
            self.demand(self.k.QueryInformationJobObject(self.job,1,ctypes.byref(info),ctypes.sizeof(info),None),'verify job empty')
            if info.active==0:
                return True
            time.sleep(.01)
        raise ScopeError('owned Windows job still contains processes',stage='job-not-empty')

    def close(self):
        errors=[]
        diagnostic=None
        if self.job:
            if not self.k.CloseHandle(self.job):
                diagnostic=_win_error('close private job failed','CloseJobHandle')
                errors.append(str(diagnostic))
            self.job=None
        if self.process:
            waited=self.k.WaitForSingleObject(self.process,2000)
            if waited!=0:
                if diagnostic is None:diagnostic=_win_error('owned worker wait failed','WaitForSingleObject') if waited==0xffffffff else ScopeError('owned worker did not stop',stage='WaitForSingleObject')
                errors.append('owned worker did not stop')
            if not self.k.CloseHandle(self.process):
                if diagnostic is None:diagnostic=_win_error('close worker handle failed','CloseWorkerHandle')
                errors.append('close worker handle failed')
            self.process=None
        if errors:raise ScopeError('; '.join(errors),stage=diagnostic.stage,win32_error=diagnostic.win32_error)

    def verify_empty(self):
        info=self.Accounting()
        self.demand(self.k.QueryInformationJobObject(self.job,1,ctypes.byref(info),ctypes.sizeof(info),None),'verify job empty')
        return info.active==0


def new_scope():
    if sys.platform=='linux':
        return LinuxScope()
    if sys.platform=='win32':
        return WindowsJob()
    raise ScopeError('unsupported process containment platform')
