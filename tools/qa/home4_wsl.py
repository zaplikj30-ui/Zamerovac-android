"""Narrow WSL transport to the EXISTING Linux owner; no replacement supervisor."""
import contextlib
import io
import json
import os
from pathlib import Path, PureWindowsPath
import shutil
import stat
import select
import sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
from home4_contract import demand,read_json,checked_bytes,verify_manifest,sha


def mapped(value, drives):
    p=PureWindowsPath(value)
    demand(p.is_absolute() and p.drive and p.root=='\\','wsl-mapped-path')
    base=drives.get(p.anchor.upper())
    demand(isinstance(base,str) and len(base)==6 and base.startswith('/mnt/') and base[-1].isalpha(),'wsl-drive-map')
    demand(all(x not in ('','.','..') for x in p.parts[1:]),'wsl-path-components')
    return Path(base).joinpath(*p.parts[1:])


def closed_tree(root, files):
    actual=set()
    for base,dirs,names in os.walk(root,followlinks=False):
        for n in dirs+names:demand(not (Path(base)/n).is_symlink(),'wsl-redirected-tree')
        actual.update((Path(base)/n).relative_to(root).as_posix() for n in names)
    demand(actual==set(files),'wsl-tree-manifest')
    verify_manifest(root,files)


def check_channel(token):
    pending=b''
    while pending or select.select([sys.stdin],[],[],0)[0]:
        demand(bool(select.select([sys.stdin],[],[],1)[0]),'wsl-preparation-channel')
        data=os.read(sys.stdin.fileno(),8192);demand(bool(data),'wsl-preparation-channel')
        pending+=data;demand(len(pending)<=8192,'wsl-preparation-channel')
        while b'\n' in pending:
            line,pending=pending.split(b'\n',1)
            demand(line.rstrip(b'\r').decode('ascii')=='ALIVE '+token,'wsl-preparation-channel')


def copy_manifest(source, target, files, budget, token=None):
    target.mkdir(mode=0o700)
    total=0
    for name,digest in files.items():
        if token is not None:check_channel(token)
        # Validation before reading also rejects traversal and link aliases.
        verify_manifest(source,{name:digest})
        file=source/name;size=file.stat().st_size;total+=size
        demand(total<=budget,'wsl-copy-budget')
        dest=target/name;dest.parent.mkdir(mode=0o700,parents=True,exist_ok=True)
        data=checked_bytes(file,512*1024**2);demand(sha(data)==digest,'wsl-copy-source-changed')
        demand(shutil.disk_usage(target).free>=len(data)+10*1024**3,'wsl-copy-free-space')
        with dest.open('xb') as out:out.write(data)
        dest.chmod(0o700 if os.access(file,os.X_OK) else 0o600)
    closed_tree(target,files)


def ext4_private(path):
    demand(path.is_absolute(),'wsl-private-absolute')
    for p in (path,*path.parents):demand(not p.is_symlink(),'wsl-private-redirection')
    s=path.lstat()
    demand(stat.S_ISDIR(s.st_mode) and s.st_uid==os.geteuid() and stat.S_IMODE(s.st_mode)==0o700,'wsl-private-owner-mode')
    mounts=[]
    for line in Path('/proc/self/mountinfo').read_text().splitlines():
        left,right=line.split(' - ',1);mount=left.split()[4]
        if str(path)==mount or str(path).startswith(mount.rstrip('/')+'/'):mounts.append((len(mount),right.split()[0]))
    demand(mounts and max(mounts)[1]=='ext4','wsl-private-ext4')
    demand(shutil.disk_usage(path).free>=12*1024**3,'wsl-private-space')


def run(config_file, owner_file):
    cfg=read_json(config_file);w=cfg['profile']['wsl'];drives=w['driveMap']
    demand(sys.platform=='linux' and os.geteuid()==w['uid'] and os.geteuid()>0 and os.environ.get('WSL_DISTRO_NAME')==w['distribution'],'wsl-existing-nonroot')
    demand('microsoft' in os.uname().release.lower() and 'wsl2' in os.uname().release.lower(),'wsl2-required')
    demand(w['containmentEvidence']['verified'] is True and w['diskEvidence']['verified'] is True,'wsl-runtime-proof-required')
    source=mapped(cfg['sourceRoot'],drives);validator=mapped(cfg['validatorRoot'],drives)
    verify_manifest(source,cfg['sourceFiles']);verify_manifest(validator,cfg['validatorFiles'])
    demand(sha(checked_bytes(mapped(cfg['profileFile'],drives)))==cfg['profileHash'],'wsl-profile-binding')
    base=Path(w['privateRoot']);ext4_private(base)
    demand(cfg['group'] in read_json(validator/'tools/qa/home4-jvm.json')['xml'] or cfg['group']=='probes','wsl-command-registry')
    private=base/('home4-'+cfg['token']+'-'+cfg['group'])
    private.mkdir(mode=0o700)  # Existing path means STOP, never reuse/reset.
    known=False
    try:
        copy_manifest(source,private/'source',cfg['sourceFiles'],256*1024**2,cfg['token'])
        copy_manifest(validator,private/'validator',cfg['validatorFiles'],256*1024**2,cfg['token'])
        cache=cfg['profile']['linux']['gradleCache']
        demand(all(n.startswith('caches/') for n in cache['files']),'wsl-cache-script-or-config')
        verify_manifest(Path(cache['root']),cache['files'])
        copy_manifest(Path(cache['root']),private/'gradle',cache['files'],6*1024**3,cfg['token'])
        cfg.update(linuxSource=str(private/'source'),linuxValidator=str(private/'validator'),linuxPrivate=str(private),linuxGradleCache=str(private/'gradle'),windowsPrivateLinuxPath=str(mapped(cfg['privateDir'],drives)))
        work=private/'payload.json';work.write_text(json.dumps(cfg));work.chmod(0o600)
        sys.path.insert(0,str(private/'validator/tools'))
        import qa_process_supervisor as owner
        check_channel(cfg['token'])
        owner_config=read_json(owner_file)
        owner_config.update(command=[w['python'],str(private/'validator/tools/qa/home4_native.py'),str(work)],cwd=str(private),log=str(private/'owner.log'),timeout=400)
        public=io.StringIO()
        with contextlib.redirect_stdout(public):code=owner.supervise(owner_config)
        lines=[json.loads(line) for line in public.getvalue().splitlines()]
        demand(len(lines)==2 and lines[0]['event']=='ready' and lines[1]['event']=='result','wsl-owner-protocol')
        result=lines[-1]
        demand(code==0 and result['status']=='PASS' and result['cleanupVerified'] is True and result['cleanupEvidence']['remainingProcesses']==0,'wsl-owner-cleanup')
        verify_manifest(source,cfg['sourceFiles']);verify_manifest(validator,cfg['validatorFiles']);verify_manifest(Path(cache['root']),cache['files'])
        shutil.rmtree(private);demand(not private.exists(),'wsl-private-cleanup');known=True
        # Do not forward a PASS until the owner AND private workspace are gone.
        for line in lines:print(json.dumps(line),flush=True)
        return 0
    finally:
        # Unknown scope or cleanup is quarantined. No PID kill, retry or reset.
        if not known:pass


if __name__=='__main__':
    try:sys.exit(run(sys.argv[1],sys.argv[2]))
    except BaseException as e:
        if isinstance(e,SystemExit):raise
        print('{"event":"result","status":"BLOCKED","cleanupVerified":false,"diagnostic":{"stage":"owner-protocol","win32Error":null}}',flush=True)
        sys.exit(77)
