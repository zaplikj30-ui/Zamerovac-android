"""Validate all fresh, bound partition reports and all 513 actual JVM results."""
import json
import os
from pathlib import Path
import sys
from home4_contract import demand,read_json,validate_partitions


def run(cfg):
    demand(sys.platform=='win32' and os.environ.get('HOME4_COMMAND_WORKER_PID')==str(os.getppid()),'owned-finalizer-required')
    validator=Path(cfg['validatorRoot']);private=Path(cfg['privateDir'])
    contract=read_json(validator/'tools/qa/home4-jvm.json');rows=[];pdf=[]
    for name in contract['xml']:
        r=read_json(private/(name+'.json'))
        demand(r['binding']==cfg['binding'] and r['token']==cfg['token'] and r['status']=='PASS','partition-binding')
        rows.append(r);pdf+=r['pdfFixtures']
    demand(sorted(pdf)==['customer-pdf-1.zip','customer-pdf-3.zip','customer-pdf-multipage.zip'],'native-pdf-complete')
    probes=read_json(private/'probes.json')
    demand(probes['binding']==cfg['binding'] and probes['token']==cfg['token'] and probes['driveNegative'] is True and probes['jdkProbes']==5 and probes['status']=='PASS','native-probes')
    result=validate_partitions(private/'junit',rows,int(cfg['startedNs']),contract,Path(cfg['sourceRoot']))
    return {**result,'status':'PASS','binding':cfg['binding'],'pdfFixtures':3,'jdkProbes':5}


if __name__=='__main__':
    try:print(json.dumps(run(read_json(sys.argv[1]))))
    except BaseException:print('{"status":"BLOCKED","phase":"native-finalize"}');sys.exit(1)
