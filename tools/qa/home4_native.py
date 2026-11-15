"""One fixed JVM partition (or probes), inside the existing Linux process scope."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time
from home4_contract import demand,read_json,checked_bytes,verify_inventory,verify_manifest,validate_partition


def tree_bytes(root):
    total=0
    for base,dirs,files in os.walk(root,followlinks=False):
        for name in dirs+files:demand(not (Path(base)/name).is_symlink(),'workspace-redirection')
        total+=sum((Path(base)/n).stat().st_size for n in files)
    return total


def command(args,cwd,env,private,name,timeout=360):
    with (private/(name+'.log')).open('xb',buffering=0) as log:
        child=subprocess.Popen(args,cwd=cwd,env=env,stdin=subprocess.DEVNULL,stdout=log,stderr=log)
        deadline=time.monotonic()+timeout
        while child.poll() is None:
            demand(time.monotonic()<deadline,'native-command-timeout')
            demand(log.tell()<=16*1024*1024 and tree_bytes(private)<=8*1024**3,'native-disk-log-limit')
            demand(shutil.disk_usage(private).free>=10*1024**3,'native-free-space')
            time.sleep(.2)
        demand(log.tell()<=16*1024*1024,'native-log-limit')
        return child.returncode
    # On failure the PAYLOAD exits; its existing owner contains/reaps the tree.


def run(cfg):
    demand(sys.platform=='linux' and os.geteuid()!=0 and os.environ.get('ZAMEROVAC_SCOPE')=='linux-pidfd-subreaper'
           and os.environ.get('ZAMEROVAC_SUPERVISOR_PID')==str(os.getppid()),'owned-wsl-required')
    profile=cfg['profile']['linux'];verify_inventory(profile,'linux')
    demand(os.geteuid()==cfg['profile']['wsl']['uid'] and os.environ.get('WSL_DISTRO_NAME')=='Zamerovac-Ubuntu-QA','wsl-user-distro')
    mem=int(next(x.split()[1] for x in Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemTotal:')))
    demand(mem<=4*1024**2 and len(os.sched_getaffinity(0))<=2,'wsl-actual-memory-cpu-cap')
    root=Path(cfg['linuxSource']);private=Path(cfg['linuxPrivate']);validator=Path(cfg['linuxValidator']);out=Path(cfg['windowsPrivateLinuxPath'])
    source=read_json(validator/'tools/qa/home4-source.json');verify_manifest(root,source['files'])
    demand(source['sourceSha']==cfg['binding']['sourceSha'],'native-source-binding')
    components=profile['components'];entry=lambda key:str(Path(components[key]['root'])/components[key]['entry'])
    env={**os.environ,'JAVA_HOME':components['jdk']['root'],'ANDROID_HOME':components['androidSdk']['root'],
         'ANDROID_SDK_ROOT':components['androidSdk']['root'],'GRADLE_USER_HOME':cfg['linuxGradleCache'],
         'HOME4_ROBOLECTRIC_INPUTS':components['robolectric']['root'],'TMPDIR':str(private),
         'PATH':str(Path(components['jdk']['root'])/'bin')+':'+os.environ['PATH']}
    packages=components['pdf'].get('packages',{})
    demand(set(packages)=={'pypdf','PyMuPDF'},'pdf-package-registry')
    identity="import json;from importlib import metadata;print(json.dumps({p:metadata.version(p) for p in ('pypdf','PyMuPDF')}))"
    demand(command([entry('pdf'),'-I','-c',identity],root,env,private,'pdf-identity',15)==0,'pdf-identity')
    demand(read_json(private/'pdf-identity.log')==packages,'pdf-package-version')
    gradle=[entry('gradle'),'--offline','--no-daemon','--max-workers=1','--no-build-cache','--console=plain',
            '-Dorg.gradle.java.installations.auto-download=false','-I',str(validator/'tools/qa/home4-offline.gradle'),'-Dorg.gradle.jvmargs=-Xmx1536m -XX:MaxMetaspaceSize=384m']
    group=cfg['group']
    if group=='probes':
        demand(command(gradle+['-p','tools/drive-config-checks','verify'],root,env,private,'drive-negative')==0,'drive-negative')
        # Existing allowlisted five Java probes, never generic WSL discovery.
        script="import sys;sys.path.insert(0,sys.argv[1]);import home_qa_gate;home_qa_gate.jdk_probes()"
        demand(command([entry('python'),'-c',script,str(root/'tools')],root,env,private,'jdk-probes')==0,'wsl-jdk-probes')
        result={'status':'PASS','driveNegative':True,'jdkProbes':5}
    else:
        contract=read_json(validator/'tools/qa/home4-jvm.json');demand(group in contract['xml'],'native-partition-registry')
        classname=group.removeprefix('TEST-').removesuffix('.xml');started=time.time_ns()
        raw=command(gradle+[':app:verifyDriveRegistration',':app:compilePreviewJavaWithJavac',':app:testPreviewUnitTest','--rerun','--tests',classname,'-PdriveRequireConfigured=true'],root,env,private,'jvm-partition')
        xml=root/'app/build/test-results/testPreviewUnitTest'
        result=validate_partition(xml,group,raw,started,contract,root)
        xml_out=out/'junit';xml_out.mkdir(exist_ok=True)
        with (xml_out/group).open('xb') as dest:dest.write(checked_bytes(xml/group))
        fixtures=sorted((root/'app/build').glob('customer-pdf-*.zip'))
        if fixtures:
            allowed={'customer-pdf-1.zip','customer-pdf-3.zip','customer-pdf-multipage.zip'}
            demand(all(p.name in allowed for p in fixtures),'pdf-fixture-registry')
            demand(command([entry('pdf'),str(root/'tools/check-customer-pdf.py'),*[str(p) for p in fixtures]],root,env,private,'pdf')==0,'pdf-render')
        result.update(status='PASS',pdfFixtures=[p.name for p in fixtures])
    verify_manifest(root,source['files']);verify_inventory(profile,'linux')
    result.update(binding=cfg['binding'],token=cfg['token'])
    with (out/(group+'.json')).open('x',encoding='utf8') as dest:json.dump(result,dest)
    return 0


if __name__=='__main__':
    try:sys.exit(run(read_json(sys.argv[1])))
    except BaseException as error:
        if isinstance(error,SystemExit):raise
        print('{"status":"BLOCKED","phase":"native-worker"}')
        sys.exit(1)
