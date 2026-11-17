"""Hold the reviewed executable against writes/replacement through worker exit.

Windows FILE_SHARE_READ excludes write/delete while the native handle is held.
Linux checks ordinary account write access and byte identity, retaining an fd.
Cloud hosted sudo means those observations are NOT an immutability guarantee.
"""
import ctypes
import hashlib
import json
import os
from pathlib import Path
import sys


class BrowserLock:
    def __init__(self):
        self.fd=None
        self.win_handles=[];self.kernel=None
        if os.environ.get('ZAMEROVAC_QA_MODE') == 'cloud':
            from qa_cloud_runtime import verified_runtime
            profile = verified_runtime()['chromium']
        else:
            profile=json.loads((Path(__file__).parent/'qa-browser-profiles.json').read_text())[sys.platform]
        file=Path(os.environ.get('CHROMIUM_PATH',''))
        if str(file)!=profile['path'] or not file.is_absolute():
            raise RuntimeError('unapproved browser lock path')
        for part in (file,*file.parents):
            if part.is_symlink() or (hasattr(part,'is_junction') and part.is_junction()):
                raise RuntimeError('redirected browser lock path')
        if file.resolve()!=file:
            raise RuntimeError('browser lock resolves elsewhere')
        if sys.platform=='win32':
            from ctypes import wintypes as w
            import msvcrt
            k=ctypes.WinDLL('kernel32',use_last_error=True)
            k.CreateFileW.argtypes=[w.LPCWSTR,w.DWORD,w.DWORD,ctypes.c_void_p,w.DWORD,w.DWORD,w.HANDLE]
            k.CreateFileW.restype=w.HANDLE
            k.CloseHandle.argtypes=[w.HANDLE];k.CloseHandle.restype=w.BOOL
            k.GetFileInformationByHandle.argtypes=[w.HANDLE,ctypes.c_void_p];k.GetFileInformationByHandle.restype=w.BOOL
            self.kernel=k
            try:
                # Deny DELETE on every directory in the chain as well. Locking
                # only the final file does not protect against a parent rename.
                for parent in reversed(file.parents):
                    handle=k.CreateFileW(str(parent),0x80,3,None,3,0x02200000,None)
                    if handle==ctypes.c_void_p(-1).value:raise RuntimeError('cannot hold Chromium directory identity')
                    self.win_handles.append(handle)
                    info=(ctypes.c_uint32*13)()
                    if not k.GetFileInformationByHandle(handle,ctypes.byref(info)) or info[0]&0x400 or not info[0]&0x10:
                        raise RuntimeError('Chromium directory is redirected or unavailable')
                handle=k.CreateFileW(str(file),0x80000000,1,None,3,0x00200000,None)
                if handle==ctypes.c_void_p(-1).value:raise RuntimeError('cannot lock reviewed Chromium against write/delete')
                self.win_handles.append(handle)
                info=(ctypes.c_uint32*13)()
                if not k.GetFileInformationByHandle(handle,ctypes.byref(info)) or info[0]&0x400:
                    raise RuntimeError('Chromium file is redirected')
                self.fd=msvcrt.open_osfhandle(handle,os.O_RDONLY|os.O_BINARY)
                self.win_handles.pop()  # CRT descriptor now owns the native handle.
            except BaseException:
                self.close()
                raise
        elif sys.platform=='linux':
            if not (os.environ.get('ZAMEROVAC_QA_MODE') == 'cloud' and os.environ.get('ZAMEROVAC_CLOUD_RUNTIME_FILE')) and any(os.access(p,os.W_OK) for p in (file,*file.parents)):
                raise RuntimeError('Chromium install must not be writable by test account')
            self.fd=os.open(file,os.O_RDONLY|os.O_NOFOLLOW)
        else:
            raise RuntimeError('unsupported browser lock platform')
        try:
            before=os.fstat(self.fd);hash_value=hashlib.sha256()
            while True:
                block=os.read(self.fd,1024*1024)
                if not block:break
                hash_value.update(block)
            after=os.fstat(self.fd)
            if (before.st_ino,before.st_dev,before.st_size,before.st_mtime_ns)!=(after.st_ino,after.st_dev,after.st_size,after.st_mtime_ns) or hash_value.hexdigest()!=profile['sha256']:
                raise RuntimeError('browser lock identity changed or hash mismatch')
        except BaseException:
            self.close();raise

    def close(self):
        if self.fd is not None:
            os.close(self.fd);self.fd=None
        errors=[]
        for handle in reversed(self.win_handles):
            if not self.kernel.CloseHandle(handle):errors.append('close Chromium path lock failed')
        self.win_handles.clear()
        if errors:raise RuntimeError(errors[0])
