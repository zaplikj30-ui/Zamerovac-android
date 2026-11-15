"""HOME4 fail-closed contracts. No downloads, installs, publication or PID kills."""
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import xml.etree.ElementTree as ET


class Blocked(RuntimeError):
    pass


def demand(condition, phase):
    if not condition:raise Blocked(phase)  # phase is code-owned, never an OS message.


def read_json(path):
    def pairs(items):
        result={}
        for key,value in items:
            demand(key not in result,'duplicate-json-key');result[key]=value
        return result
    return json.loads(checked_bytes(Path(path),4*1024*1024).decode('utf8'),object_pairs_hook=pairs)


def checked_bytes(path, limit=32*1024*1024):
    path=Path(path)
    for entry in (path,*path.parents):
        meta=entry.lstat()
        demand(not stat.S_ISLNK(meta.st_mode) and not getattr(meta,'st_file_attributes',0)&0x400,'redirected-path')
    fd=os.open(path,os.O_RDONLY|getattr(os,'O_NOFOLLOW',0))
    try:
        before=os.fstat(fd);named=path.lstat()
        demand(stat.S_ISREG(before.st_mode) and before.st_nlink==1 and before.st_ino!=0,'file-identity')
        demand((before.st_dev,before.st_ino)==(named.st_dev,named.st_ino) and 0<=before.st_size<=limit,'file-size-or-identity')
        blocks=[];length=0
        while length<=limit:
            block=os.read(fd,min(1024*1024,limit+1-length))
            if not block:break
            blocks.append(block);length+=len(block)
        after=os.fstat(fd);last=path.lstat()
        signature=lambda x:(x.st_dev,x.st_ino,x.st_size,x.st_mtime_ns)
        demand(length==before.st_size and signature(before)==signature(after)==signature(last),'file-changed')
        return b''.join(blocks)
    finally:os.close(fd)


def sha(data):return hashlib.sha256(data).hexdigest()


def binding(env, source, validator):
    demand(bool(re.fullmatch('[a-f0-9]{40}',source or '')) and bool(re.fullmatch('[a-f0-9]{40}',validator or '')),'binding-sha')
    expected={'GITHUB_ACTIONS':'true','GITHUB_REPOSITORY':'zaplikj30-ui/Zamerovac-android',
              'GITHUB_EVENT_NAME':'workflow_dispatch','GITHUB_REF':'refs/heads/main',
              'GITHUB_ACTOR':'zaplikj30-ui','GITHUB_TRIGGERING_ACTOR':'zaplikj30-ui','GITHUB_RUN_ATTEMPT':'1'}
    demand(all(env.get(k)==v for k,v in expected.items()),'owner-main-manual-first-attempt')
    event=env.get('GITHUB_SHA','')
    demand(bool(re.fullmatch('[a-f0-9]{40}',event)) and env.get('HOME4_APPROVED_MAIN_SHA')==event,'event-sha')
    demand(bool(re.fullmatch('[1-9][0-9]{0,19}',env.get('GITHUB_RUN_ID',''))),'run-id')
    return dict(sourceSha=source,validatorSha=validator,eventSha=event,runId=env['GITHUB_RUN_ID'],attempt=1)


def verify_manifest(root, files):
    root=Path(root)
    demand(bool(files),'empty-file-manifest')
    for name,digest in files.items():
        demand(isinstance(name,str) and name and not name.startswith(('/','\\')) and '\\' not in name
               and ':' not in name and all(x not in ('','.','..') for x in name.split('/')),'manifest-path')
        demand(bool(re.fullmatch('[a-f0-9]{64}',digest or '')),'unverified-hash')
        demand(sha(checked_bytes(root/name,512*1024*1024))==digest,'content-hash')


def verify_inventory(profile, platform):
    demand(profile.get('schema')==1 and profile.get('verified') is True,'inventory-unverified')
    demand(profile.get('platform')==platform and profile.get('dependencyNetwork')=='forbidden','inventory-platform-network')
    required={'python','git','jdk','gradle','androidSdk','robolectric','pdf'} if platform=='linux' else {'python','git','jdk','node','chromium','playwright','wsl'}
    demand(set(profile.get('components',{}))==required,'inventory-components')
    for name,item in profile['components'].items():
        demand(item.get('version') not in (None,'','UNKNOWN') and Path(item.get('root','')).is_absolute(),'inventory-identity')
        root=Path(item['root']);actual=set()
        for base,dirs,names in os.walk(root,followlinks=False):
            for n in dirs+names:demand(not (Path(base)/n).is_symlink(),'inventory-redirection')
            actual.update((Path(base)/n).relative_to(root).as_posix() for n in names)
        demand(actual==set(item.get('files',{})),'inventory-file-registry')
        verify_manifest(root,item.get('files',{}))
    demand(profile['components']['jdk']['version'].startswith('17.'),'jdk-version')
    if platform=='linux':demand(profile['components']['gradle']['version']=='8.10.2','gradle-version')
    if platform=='win32':demand(profile['components']['playwright']['version']=='1.62.1','playwright-version')


def classify_records(cases, raw_exit, contract):
    expected={n for group in contract['xml'].values() for n in group}
    names=[c['id'] for c in cases]
    demand(len(contract['xml'])==64 and len(expected)==513 and len(contract['critical'])==49 and len(set(contract['critical']))==49
           and set(contract['critical'])<=expected,'jvm-registry')
    demand(len(names)==513 and len(set(names))==513 and set(names)==expected,'jvm-case-registry')
    demand(type(raw_exit) is int and raw_exit==1,'raw-gradle-exit')
    failures=contract['expectedRawFailures']
    demand(len(failures)==2,'diagnostic-registry')
    for c in cases:
        if c['id'] in failures:
            demand(c['status']=='FAIL' and c['message']==failures[c['id']]['message']
                   and c['type']==failures[c['id']]['type'],'diagnostic-assertion')
        else:demand(c['status']=='PASS','unexpected-jvm-result')
    return {'rawGradle':{'status':'FAIL','exit':1,'pass':511,'fail':2,'error':0,'skip':0},
            'productAcceptance':'PASS','releaseMapping':'BLOCKED','previewMapping':'BLOCKED'}


def junit_cases(directory, started_ns, contract, source_root=None):
    directory=Path(directory)
    entries=sorted(directory.iterdir())
    binary=directory/'binary'
    if binary in entries:
        demand(binary.is_dir() and not binary.is_symlink(),'xml-binary-redirection')
        allowed={'output.bin','output.bin.idx','results.bin'}
        demand({p.name for p in binary.iterdir()}<=allowed,'xml-binary-registry')
        for p in binary.iterdir():checked_bytes(p)
    paths=[p for p in entries if p!=binary]
    demand({p.name for p in paths}==set(contract['xml']) and len(paths)==len(contract['xml']),'xml-file-registry')
    if source_root is not None:verify_manifest(source_root,contract['testSources'])
    cases=[]
    for p in paths:
        demand(p.lstat().st_mtime_ns>=started_ns,'stale-xml')
        data=checked_bytes(p)
        demand(b'<!DOCTYPE' not in data.upper() and b'<!ENTITY' not in data.upper() and b'\x00' not in data,'xml-dtd-or-encoding')
        root=ET.fromstring(data.decode('utf8'))
        demand(root.tag=='testsuite','xml-root')
        rows=[]
        for c in root:
            demand(c.tag in ('testcase','properties','system-out','system-err'),'xml-unknown-element')
            if c.tag!='testcase':continue
            demand(c.get('classname')==root.get('name') and bool(c.get('name')),'xml-case-identity')
            nodes=[n for n in c if n.tag in ('failure','error','skipped')]
            demand(len(nodes)<=1 and all(n.tag in ('failure','error','skipped','system-out','system-err') for n in c),'xml-case-structure')
            node=nodes[0] if nodes else None
            state={'failure':'FAIL','error':'ERROR','skipped':'SKIP'}.get(node.tag,'PASS') if node is not None else 'PASS'
            rows.append({'id':c.get('classname')+'.'+c.get('name'),'status':state,
                         'message':node.get('message','') if node is not None else '',
                         'type':node.get('type','') if node is not None else ''})
        demand(len(rows)==len(contract['xml'][p.name]) and {c['id'] for c in rows}==set(contract['xml'][p.name]),'xml-method-registry')
        counts={'tests':len(rows),'failures':sum(c['status']=='FAIL' for c in rows),
                'errors':sum(c['status']=='ERROR' for c in rows),'skipped':sum(c['status']=='SKIP' for c in rows)}
        demand(all(root.get(k)==str(v) for k,v in counts.items()),'xml-summary')
        cases+=rows
    demand(sorted(p.name for p in directory.iterdir() if p!=binary)==sorted(contract['xml']),'xml-directory-changed')
    return cases


def validate_junit(directory, raw_exit, started_ns, contract, source_root=None):
    return classify_records(junit_cases(directory,started_ns,contract,source_root),raw_exit,contract)


def validate_partition(directory, filename, raw_exit, started_ns, contract, source_root):
    demand(filename in contract['xml'],'partition-registry')
    subset={**contract,'xml':{filename:contract['xml'][filename]}}
    rows=junit_cases(directory,started_ns,subset,source_root)
    failures=contract['expectedRawFailures']
    expected_exit=1 if any(r['id'] in failures for r in rows) else 0
    demand(type(raw_exit) is int and raw_exit==expected_exit,'partition-raw-exit')
    for r in rows:
        if r['id'] in failures:
            demand(r['status']=='FAIL' and r['message']==failures[r['id']]['message'] and r['type']==failures[r['id']]['type'],'partition-diagnostic')
        else:demand(r['status']=='PASS','partition-unexpected-result')
    return {'file':filename,'rawExit':raw_exit,'pass':sum(r['status']=='PASS' for r in rows),'fail':sum(r['status']=='FAIL' for r in rows)}


def validate_partitions(directory, results, started_ns, contract, source_root):
    demand(len(results)==64 and len({r['file'] for r in results})==64 and {r['file'] for r in results}==set(contract['xml']),'partition-completeness')
    for r in results:
        failures=sum(n in contract['expectedRawFailures'] for n in contract['xml'][r['file']])
        demand(type(r['rawExit']) is int and r['rawExit']==(1 if failures else 0) and r['fail']==failures and r['pass']==len(contract['xml'][r['file']])-failures,'partition-outcome')
    raw=[r for r in results if r['rawExit']==1]
    demand(len(raw)==1,'raw-failing-invocation')
    result=validate_junit(directory,raw[0]['rawExit'],started_ns,contract,source_root)
    result['rawGradle'].update(invocations=64,failedInvocations=1,exitSource=raw[0]['file'])
    return result


def exact_results(rows, expected, optional=()):
    names=[r['id'] for r in rows]
    demand(len(names)==len(set(names)) and set(names)==set(expected)|set(optional),'quick-registry')
    demand(all(r['status']=='PASS' if r['id'] in expected else r['status']=='NOT RUN' for r in rows),'quick-result')
    return {'required':len(expected),'pass':len(expected),'fail':0,'skip':0,'optionalNotRun':len(optional)}


def audit_source(root, files):
    """Tracked bytes plus a narrow allowlist of generated build data, no redirects."""
    verify_manifest(root,files)
    mutable=('app/build/','build/','.gradle/','tools/drive-config-checks/build/','tools/drive-config-checks/.gradle/')
    for base,dirs,names in os.walk(root,followlinks=False):
        for name in dirs+names:
            p=Path(base)/name;m=p.lstat()
            demand(not stat.S_ISLNK(m.st_mode) and not getattr(m,'st_file_attributes',0)&0x400,'native-source-redirection')
        for name in names:
            n=(Path(base)/name).relative_to(root).as_posix()
            demand(n in files or n=='tools/debug-signing.p12' or n.startswith(mutable),'native-unexpected-write')
