"""Real contract functions with synthetic XML/files, no HOME, network or APK."""
from copy import deepcopy
import importlib.util
import json
import os
from pathlib import Path
import sys
import tempfile
import time
import unittest
import xml.etree.ElementTree as ET

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools/qa'))
from home4_contract import Blocked,binding,classify_records,validate_junit,verify_manifest,verify_inventory,exact_results,validate_partition,validate_partitions,checked_bytes
C=json.loads((ROOT/'tools/qa/home4-jvm.json').read_text())


def records():
    return [dict(id=n,status='FAIL' if n in C['expectedRawFailures'] else 'PASS',
                 message=C['expectedRawFailures'].get(n,{}).get('message',''),
                 type=C['expectedRawFailures'].get(n,{}).get('type',''))
            for group in C['xml'].values() for n in group]


class Home4Contract(unittest.TestCase):
    def test_I88_exact_positive_preserves_raw_FAIL_and_blocks_release_mapping(self):
        r=classify_records(records(),1,C)
        self.assertEqual(r['rawGradle'],dict(status='FAIL',exit=1,**{'pass':511,'fail':2,'error':0,'skip':0}))
        self.assertEqual(r['productAcceptance'],'PASS')
        self.assertEqual(r['releaseMapping'],'BLOCKED');self.assertEqual(r['previewMapping'],'BLOCKED')

    def test_registry_missing_duplicate_renamed_critical_or_extra_is_blocked(self):
        r=records()
        bad=[r[:-1],r+[r[0]],[r[0]]+r[1:-1]+[r[0]]]
        renamed=deepcopy(r);renamed[0]['id']='renamed.sameCount';bad.append(renamed)
        for row in bad:
            with self.assertRaises(Blocked):classify_records(row,1,C)
        c=deepcopy(C);c['critical'].pop()
        with self.assertRaises(Blocked):classify_records(r,1,c)

    def test_legacy_same_count_rename_counterexample_is_closed(self):
        spec=importlib.util.spec_from_file_location('legacy_ack',ROOT/'tools/sync-ack-acceptance.py')
        m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
        r=records();r[0]['id']='renamed.sameCount'
        self.assertEqual(m.classify(r,1)['product_acceptance']['status'],'PASS')
        with self.assertRaises(Blocked):classify_records(r,1,C)

    def test_wrong_assertion_type_message_PASS_SKIP_ERROR_and_third_FAIL_block(self):
        r=records();i=next(i for i,c in enumerate(r) if c['status']=='FAIL')
        for change in ({'status':'PASS'},{'status':'SKIP'},{'status':'ERROR'},
                       {'message':r[i]['message']+' other failure'},{'type':'OtherError'}):
            row=deepcopy(r);row[i].update(change)
            with self.assertRaises(Blocked):classify_records(row,1,C)
        r[0]['status']='FAIL'
        with self.assertRaises(Blocked):classify_records(r,1,C)
        for code in (0,2,None,True,'1'):
            with self.assertRaises(Blocked):classify_records(records(),code,C)

    def xml(self,base):
        for filename,ids in C['xml'].items():
            root=ET.Element('testsuite',name=ids[0].rsplit('.',1)[0],tests=str(len(ids)),failures=str(sum(n in C['expectedRawFailures'] for n in ids)),errors='0',skipped='0')
            for n in ids:
                case=ET.SubElement(root,'testcase',classname=n.rsplit('.',1)[0],name=n.rsplit('.',1)[1])
                if n in C['expectedRawFailures']:ET.SubElement(case,'failure',**C['expectedRawFailures'][n])
            ET.ElementTree(root).write(base/filename,encoding='utf8',xml_declaration=True)

    def test_XML_exact_fresh_positive_and_stale_or_forged_summary_block(self):
        with tempfile.TemporaryDirectory() as d:
            base=Path(d);started=time.time_ns();self.xml(base)
            self.assertEqual(validate_junit(base,1,started,C)['productAcceptance'],'PASS')
            first=next(base.iterdir());os.utime(first,ns=(started-1,started-1))
            with self.assertRaises(Blocked):validate_junit(base,1,started,C)
            self.xml(base);r=ET.parse(first);r.getroot().set('tests','999');r.write(first)
            with self.assertRaises(Blocked):validate_junit(base,1,started,C)

    def test_XML_extra_file_and_DTD_block(self):
        with tempfile.TemporaryDirectory() as d:
            base=Path(d);self.xml(base);(base/'extra.xml').write_text('<testsuite/>')
            with self.assertRaises(Blocked):validate_junit(base,1,0,C)
            (base/'extra.xml').unlink();first=next(base.iterdir());first.write_text('<!DOCTYPE x><testsuite/>')
            with self.assertRaises(Blocked):validate_junit(base,1,0,C)

    def test_real_file_aliases_and_source_tamper_block(self):
        with tempfile.TemporaryDirectory() as d:
            base=Path(d);file=base/'input';file.write_bytes(b'original');alias=base/'alias'
            os.link(file,alias)
            with self.assertRaises(Blocked):checked_bytes(file)
            alias.unlink()
            if os.name=='posix':
                alias.symlink_to(file)
                with self.assertRaises(Blocked):checked_bytes(alias)
                alias.unlink()
            verify_manifest(base,{'input':__import__('hashlib').sha256(b'original').hexdigest()})
            file.write_bytes(b'changed')
            with self.assertRaises(Blocked):verify_manifest(base,{'input':__import__('hashlib').sha256(b'original').hexdigest()})

    def test_partition_raw_exits_and_complete_registry_are_coupled(self):
        with tempfile.TemporaryDirectory() as d:
            base=Path(d);self.xml(base)
            c={**C,'testSources':{'AGENTS.md':__import__('hashlib').sha256((ROOT/'AGENTS.md').read_bytes()).hexdigest()}}
            rows=[]
            for name,ids in c['xml'].items():
                n=sum(i in c['expectedRawFailures'] for i in ids)
                rows.append(dict(file=name,rawExit=1 if n else 0,**{'pass':len(ids)-n,'fail':n}))
            self.assertEqual(validate_partitions(base,rows,0,c,ROOT)['rawGradle']['failedInvocations'],1)
            for bad in (rows[:-1],rows+[rows[0]],rows[:-1]+[rows[0]]):
                with self.assertRaises(Blocked):validate_partitions(base,bad,0,c,ROOT)
            bad=deepcopy(rows);bad[0]['rawExit']=1-bad[0]['rawExit']
            with self.assertRaises(Blocked):validate_partitions(base,bad,0,c,ROOT)
            name=next(iter(c['xml']));part=base/'single';part.mkdir();(part/name).write_bytes((base/name).read_bytes())
            raw=rows[0]['rawExit'];self.assertEqual(validate_partition(part,name,raw,0,c,ROOT)['rawExit'],raw)
            with self.assertRaises(Blocked):validate_partition(part,name,1-raw,0,c,ROOT)

    def test_standard_Gradle_binary_data_is_not_XML_and_unknown_data_block(self):
        with tempfile.TemporaryDirectory() as d:
            base=Path(d);self.xml(base);binary=base/'binary';binary.mkdir();(binary/'results.bin').write_bytes(b'data')
            self.assertEqual(validate_junit(base,1,0,C)['productAcceptance'],'PASS')
            (binary/'extra').write_bytes(b'unknown')
            with self.assertRaises(Blocked):validate_junit(base,1,0,C)

    def test_offline_missing_unverified_or_modified_cache_is_not_available(self):
        with tempfile.TemporaryDirectory() as d:
            base=Path(d);(base/'file').write_bytes(b'approved')
            import hashlib
            h=hashlib.sha256(b'approved').hexdigest();verify_manifest(base,{'file':h})
            for mapping in ({'file':None},{'file':'0'*64},{'absent':h},{'../file':h}):
                with self.assertRaises((Blocked,OSError)):verify_manifest(base,mapping)
            with self.assertRaises(Blocked):verify_inventory({'schema':1,'verified':False},'win32')
            components={k:dict(root=str(base),version='1.0',files={'file':h}) for k in ('python','git','jdk','gradle','androidSdk','robolectric','pdf')}
            components['jdk']['version']='17.0.17';components['gradle']['version']='8.10.2'
            profile=dict(schema=1,verified=True,platform='linux',dependencyNetwork='forbidden',components=components)
            verify_inventory(profile,'linux')
            (base/'extra').write_bytes(b'unknown')
            with self.assertRaises(Blocked):verify_inventory(profile,'linux')

    def test_owner_manual_main_first_attempt_and_precise_SHA(self):
        env=dict(GITHUB_ACTIONS='true',GITHUB_REPOSITORY='zaplikj30-ui/Zamerovac-android',GITHUB_EVENT_NAME='workflow_dispatch',GITHUB_REF='refs/heads/main',GITHUB_ACTOR='zaplikj30-ui',GITHUB_TRIGGERING_ACTOR='zaplikj30-ui',GITHUB_RUN_ATTEMPT='1',GITHUB_SHA='c'*40,HOME4_APPROVED_MAIN_SHA='c'*40,GITHUB_RUN_ID='123')
        self.assertEqual(binding(env,'a'*40,'b'*40)['attempt'],1)
        for key,value in dict(GITHUB_EVENT_NAME='push',GITHUB_REF='refs/pull/1/merge',GITHUB_ACTOR='other',GITHUB_TRIGGERING_ACTOR='other',GITHUB_RUN_ATTEMPT='2',HOME4_APPROVED_MAIN_SHA='d'*40,GITHUB_REPOSITORY='fork/repo').items():
            with self.assertRaises(Blocked):binding({**env,key:value},'a'*40,'b'*40)

    def test_quick_named_cases_and_required_zero_SKIP_FAIL(self):
        self.assertEqual(exact_results([dict(id='one',status='PASS'),dict(id='linux',status='NOT RUN')],['one'],['linux'])['pass'],1)
        for rows in ([],[dict(id='one',status='SKIP')],[dict(id='one',status='FAIL')],[dict(id='one',status='PASS')]*2):
            with self.assertRaises(Blocked):exact_results(rows,['one'])


if __name__=='__main__':unittest.main()
