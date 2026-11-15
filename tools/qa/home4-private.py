"""Read-only Windows directory ACL check. No ACL/account/service changes."""
import ctypes as c
from ctypes import wintypes as w
import json
import os
from pathlib import Path
import sys
import stat


def private(path):
    if sys.platform!='win32':raise ValueError('private-platform')
    sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
    from qa_owned_processes import require_windows_service_token
    require_windows_service_token()
    path=Path(path)
    if not path.is_absolute() or not path.is_dir():raise ValueError('private-root')
    for p in (path,*path.parents):
        s=p.lstat()
        if stat.S_ISLNK(s.st_mode):raise ValueError('private-redirect')
        if getattr(s,'st_file_attributes',0)&0x400:raise ValueError('private-reparse')
    if os.path.normcase(str(path.resolve(strict=True)))!=os.path.normcase(str(path.absolute())):raise ValueError('private-canonical')
    a=c.WinDLL('advapi32',use_last_error=True);k=c.WinDLL('kernel32',use_last_error=True)
    a.GetNamedSecurityInfoW.argtypes=[w.LPWSTR,w.DWORD,w.DWORD,c.POINTER(c.c_void_p),c.c_void_p,c.POINTER(c.c_void_p),c.c_void_p,c.POINTER(c.c_void_p)];a.GetNamedSecurityInfoW.restype=w.DWORD
    a.ConvertSidToStringSidW.argtypes=[c.c_void_p,c.POINTER(w.LPWSTR)];a.ConvertSidToStringSidW.restype=w.BOOL
    a.GetAce.argtypes=[c.c_void_p,w.DWORD,c.POINTER(c.c_void_p)];a.GetAce.restype=w.BOOL
    a.OpenProcessToken.argtypes=[w.HANDLE,w.DWORD,c.POINTER(w.HANDLE)];a.OpenProcessToken.restype=w.BOOL
    a.GetTokenInformation.argtypes=[w.HANDLE,c.c_int,c.c_void_p,w.DWORD,c.POINTER(w.DWORD)];a.GetTokenInformation.restype=w.BOOL
    k.GetCurrentProcess.restype=w.HANDLE;k.CloseHandle.argtypes=[w.HANDLE];k.CloseHandle.restype=w.BOOL
    k.LocalFree.argtypes=[c.c_void_p];k.LocalFree.restype=c.c_void_p
    def demand(ok):
        if not ok:raise ValueError('private-api')
    def sid(pointer):
        text=w.LPWSTR();demand(a.ConvertSidToStringSidW(pointer,c.byref(text)))
        try:return text.value
        finally:demand(k.LocalFree(c.cast(text,c.c_void_p)) is None)
    token=w.HANDLE();demand(a.OpenProcessToken(k.GetCurrentProcess(),8,c.byref(token)))
    try:
        size=w.DWORD();a.GetTokenInformation(token,1,None,0,c.byref(size))
        demand(0<size.value<=65536)
        buffer=c.create_string_buffer(size.value);demand(a.GetTokenInformation(token,1,buffer,size,c.byref(size)))
        own=sid(c.cast(buffer,c.POINTER(c.c_void_p))[0])
    finally:demand(k.CloseHandle(token))
    owner=c.c_void_p();acl=c.c_void_p();descriptor=c.c_void_p()
    demand(a.GetNamedSecurityInfoW(str(path),1,5,c.byref(owner),None,c.byref(acl),None,c.byref(descriptor))==0)
    try:
        demand(sid(owner)==own and bool(acl.value))
        count=c.c_ushort.from_address(acl.value+4).value
        demand(0<count<100)
        own_access=False
        for i in range(count):
            ace=c.c_void_p();demand(a.GetAce(acl,i,c.byref(ace)))
            demand(c.c_ushort.from_address(ace.value+2).value>=12)
            kind=c.c_ubyte.from_address(ace.value).value
            demand(kind in (0,1))  # Unknown/object/callback ACEs fail closed.
            if kind==1:continue
            allowed=sid(c.c_void_p(ace.value+8))
            demand(allowed in (own,'S-1-5-18','S-1-5-32-544'))
            own_access=own_access or allowed==own
        demand(own_access)
    finally:demand(k.LocalFree(descriptor) is None)
    meta=path.lstat()
    return {'private':True,'dev':str(meta.st_dev),'ino':str(meta.st_ino)}


if __name__=='__main__':
    try:
        rows=[private(path) for path in sys.argv[1:]]
        if not rows:raise ValueError('private-input')
        print(json.dumps({'private':all(r['private'] for r in rows)}))
    except BaseException:print('{"private":false,"phase":"private-root-acl"}');sys.exit(78)
