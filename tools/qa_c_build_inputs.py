"""Read-only gate for pinned Node 26.13.0 Windows x64 build inputs.

POSIX-only descriptor-relative walk, refusing symlinks in every component.
Windows paths are deliberately BLOCKED until native file handling is verified.
No download, extraction, compiler, addon load, runtime probe or network access.
ARTIFACTS_VERIFIED attests these files only, never a toolchain or native build.
"""
import hashlib
import json
import os
from pathlib import Path
import stat
import sys

PINS={
    'headers':'9b3fad89be6bb3ffc5057afcbceaf58a9489d67846fdb243eaf44947167a1a1b',
    'node-lib':'caad0090dc3add94c06abd01e395e8ec0f1586c10071bda1f99480445d695f6f',
    'node-exe':'14319838b3f355e0398c13569a90270bce4fc68f25189f58c59b03dadae0e6d5',
}
MAX_BYTES=256*1024*1024

class InputBlocked(RuntimeError):
    def __init__(self,reason):
        super().__init__(reason)
        self.reason=reason

def reparse(meta):
    return stat.S_ISLNK(meta.st_mode) or bool(getattr(meta,'st_file_attributes',0)&0x400)

def directory_identity(meta):return (meta.st_dev,meta.st_ino,meta.st_mode)

def identity(meta):
    return (meta.st_dev,meta.st_ino,meta.st_mode,meta.st_size,
            meta.st_mtime_ns,meta.st_ctime_ns,meta.st_nlink)

def verify_file(label,value):
    if label not in PINS:raise InputBlocked('unknown-artifact')
    opened=[]
    try:
        if os.name!='posix' or not hasattr(os,'O_NOFOLLOW') or not hasattr(os,'O_DIRECTORY'):
            raise InputBlocked('platform-unverified')
        path=Path(value)
        if '..' in path.parts:raise InputBlocked('parent-traversal')
        path=path.absolute()
        if path.anchor!='/' or len(path.parts)>128:raise InputBlocked('unsupported-path')
        directory_flags=os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW|getattr(os,'O_CLOEXEC',0)
        parent=os.open(path.anchor,directory_flags);opened.append(parent)
        ancestry=[]
        for component in path.parts[1:-1]:
            meta=os.stat(component,dir_fd=parent,follow_symlinks=False)
            if reparse(meta):raise InputBlocked('reparse-or-symlink')
            if not stat.S_ISDIR(meta.st_mode):raise InputBlocked('not-directory')
            next_parent=os.open(component,directory_flags,dir_fd=parent);opened.append(next_parent)
            if directory_identity(os.fstat(next_parent))!=directory_identity(meta):
                raise InputBlocked('changed-directory')
            ancestry.append((parent,component,directory_identity(meta)))
            parent=next_parent
        name=path.parts[-1]
        named=os.stat(name,dir_fd=parent,follow_symlinks=False)
        if reparse(named):raise InputBlocked('reparse-or-symlink')
        if not stat.S_ISREG(named.st_mode):raise InputBlocked('not-regular')
        if named.st_nlink!=1:raise InputBlocked('not-unique-file')
        if not 0<named.st_size<=MAX_BYTES:raise InputBlocked('size-limit')
        flags=os.O_RDONLY|os.O_NOFOLLOW|getattr(os,'O_CLOEXEC',0)
        fd=os.open(name,flags,dir_fd=parent);opened.append(fd)
        before=os.fstat(fd)
        if identity(before)!=identity(named):raise InputBlocked('changed-file')
        digest=hashlib.sha256();length=0
        while True:
            block=os.read(fd,65536)
            if not block:break
            length+=len(block)
            if length>MAX_BYTES:raise InputBlocked('size-limit')
            digest.update(block)
        after=os.fstat(fd);last=os.stat(name,dir_fd=parent,follow_symlinks=False)
        if (identity(before)!=identity(after) or identity(before)!=identity(last) or
                length!=before.st_size or reparse(last)):
            raise InputBlocked('changed-file')
        for ancestor,component,expected in ancestry:
            if directory_identity(os.stat(component,dir_fd=ancestor,follow_symlinks=False))!=expected:
                raise InputBlocked('changed-directory')
        actual=digest.hexdigest()
        if actual!=PINS[label]:raise InputBlocked('hash-mismatch')
        return {'artifact':label,'status':'PASS','sha256':actual,'bytes':length}
    except InputBlocked:raise
    except (OSError,ValueError,TypeError):raise InputBlocked('io-error') from None
    finally:
        close_failed=False
        for fd in reversed(opened):
            try:os.close(fd)
            except OSError:close_failed=True
        if close_failed:raise InputBlocked('close-error') from None

def main(args=None):
    args=list(sys.argv[1:] if args is None else args)
    report={'status':'BLOCKED','target':'Node26.13.0-Windows-x64',
            'build':'NOT_RUN','nativeLoad':'NOT_RUN','artifacts':[]}
    try:
        values={}
        if len(args)!=6:raise InputBlocked('arguments')
        for i in range(0,len(args),2):
            key=args[i]
            if key not in ('--headers','--node-lib','--node-exe') or key in values:
                raise InputBlocked('arguments')
            values[key]=args[i+1]
        if len(values)!=3:raise InputBlocked('arguments')
        for key in ('headers','node-lib','node-exe'):
            report['artifacts'].append(verify_file(key,values['--'+key]))
        report['status']='ARTIFACTS_VERIFIED'
    except InputBlocked as error:report['reason']=error.reason
    print(json.dumps(report,sort_keys=True))
    return 0 if report['status']=='ARTIFACTS_VERIFIED' else 1

if __name__=='__main__':sys.exit(main())
