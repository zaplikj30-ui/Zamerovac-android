"""Owned Windows preflight of the approved, already installed dependency set."""
import json
import os
from pathlib import Path
import subprocess
import sys
from home4_contract import demand,read_json,verify_inventory,verify_manifest,verify_runtime_evidence


def run(cfg):
    demand(sys.platform=='win32' and os.environ.get('HOME4_COMMAND_WORKER_PID')==str(os.getppid()),'owned-preflight-required')
    profile=cfg['profile'];verify_runtime_evidence(profile,cfg['binding'],cfg['phase'])
    verify_inventory(profile,'win32')
    verify_manifest(Path(cfg['validatorRoot']),read_json(Path(cfg['validatorRoot'])/'tools/qa/home4-quick.json')['testSources'])
    for key,args,prefix in (('node',['--version'],'v'),('python',['--version'],'Python '),('git',['--version'],'git version ')):
        component=profile['components'][key]
        demand(component.get('entry') in component['files'],'tool-entry')
        executable=str(Path(component['root'])/component['entry'])
        result=subprocess.run([executable,*args],stdin=subprocess.DEVNULL,capture_output=True,text=True,timeout=15,check=True)
        demand(result.stdout.strip()==prefix+component['version'] and not result.stderr,'tool-version')
    return {'status':'PASS','binding':cfg['binding'],'inventoryVerified':True}


if __name__=='__main__':
    try:print(json.dumps(run(read_json(sys.argv[1]))))
    except BaseException:print('{"status":"BLOCKED","phase":"inventory-preflight"}');sys.exit(1)
