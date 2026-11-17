"""Synthetic X1 negatives: Python -O must not bypass PDF/ZIP validation.

Mocks only the parser interface; never calls a browser, native Android, HOME,
network, or customer file. The real pypdf/PyMuPDF runtime remains NOT RUN here.
"""
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import zipfile

SCRIPT = Path(__file__).resolve().parents[1]/'tools/check-customer-pdf.py'
STUB_PYPDF = """
class Image:
    image=type('Img',(),{'size':(160,90)})()
class Page:
    mediabox=[0,0,160,90]
    images=[Image()]
    def get(self,key): return None
    def extract_text(self):return ''
class Root(dict):
    def get(self,key):return None
class PdfReader:
    def __init__(self,source,strict=True):
        self.pages=[Page()]
        self.trailer={'/Root':Root()}
        self.metadata={}
"""
STUB_PYMUPDF = """
class Pixmap:
    width=160
    height=90
    def pixel(self,x,y):return (250,250,0)
class Page:
    def get_pixmap(self):return Pixmap()
class Doc:
    def __enter__(self):return self
    def __exit__(self,*args):pass
    def __len__(self):return 1
    def __iter__(self):return iter([Page()])
def open(stream,filetype):return Doc()
"""


class CloudPDFOptimizeTests(unittest.TestCase):
    def setUp(self):
        self.scratch=tempfile.TemporaryDirectory(prefix='cloud-pdf-synthetic-')
        self.addCleanup(self.scratch.cleanup)
        self.root=Path(self.scratch.name)
        (self.root/'pypdf.py').write_text(STUB_PYPDF)
        (self.root/'pymupdf.py').write_text(STUB_PYMUPDF)

    def invoke(self, args, optimize=False):
        env={**os.environ,'PYTHONPATH':str(self.root),'PYTHONDONTWRITEBYTECODE':'1'}
        env['PYTHONOPTIMIZE']='1' if optimize else '0'
        return subprocess.run([sys.executable,*(['-O'] if optimize else []),str(SCRIPT),*map(str,args)],
                              cwd=self.root,env=env,capture_output=True,text=True,timeout=20)

    def zip(self,name,entries):
        p=self.root/name
        with zipfile.ZipFile(p,'w',compression=zipfile.ZIP_DEFLATED) as z:
            for n,content in entries:z.writestr(n,content)
        return p

    def test_positive_mock_interface_for_one_synthetic_raster(self):
        p=self.zip('synthetic-valid.zip',[('image.pdf',b'%PDF MOCK TEST INPUT')])
        for opt in (False,True):
            out=self.invoke([p],opt)
            self.assertEqual(out.returncode,0,out.stderr)
            self.assertIn('OK: synthetic PDF fixture',out.stdout)

    def test_invalid_zip_is_blocked_under_python_O(self):
        mutations=[
            [],
            [('..\\escape.pdf',b'bad')],
            [('../escape.pdf',b'bad')],
            [('same.pdf',b'a'),('same.pdf',b'b')],
            [('other.txt',b'bad')],
            [('blank.pdf',b'')]
        ]
        for index,entries in enumerate(mutations):
            p=self.zip('negative-%s.zip'%index,entries)
            for opt in (False,True):
                out=self.invoke([p],opt)
                self.assertNotEqual(out.returncode,0,(index,opt,out.stdout))
                self.assertNotIn('OK:',out.stdout)
                self.assertNotIn(self.scratch.name,out.stderr)

    def test_no_args_or_symlink_cannot_claim_PASS_under_python_O(self):
        out=self.invoke([],True)
        self.assertNotEqual(out.returncode,0)
        valid=self.zip('valid.zip',[('image.pdf',b'good')])
        link=self.root/'alias.zip'
        try:link.symlink_to(valid)
        except (OSError,NotImplementedError):self.skipTest('symlink not supported here')
        out=self.invoke([link],True)
        self.assertNotEqual(out.returncode,0)
        self.assertNotIn('OK:',out.stdout)


    def native(self):
        # SOURCE-only model: never start the native JVM/Android or browser.
        import importlib.util
        from unittest import mock
        tools=SCRIPT.parent
        sys.path.insert(0,str(tools))
        self.addCleanup(lambda:sys.path.remove(str(tools)))
        spec=importlib.util.spec_from_file_location('cloud_native_synthetic',tools/'qa_cloud_native.py')
        module=importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module

    def make_native_fixtures(self):
        build=self.root/'product/app/build'
        build.mkdir(parents=True)
        for name in ('customer-pdf-1.zip','customer-pdf-3.zip','customer-pdf-multipage.zip'):
            (build/name).write_bytes(b'synthetic ZIP byte identity fixture')
        return self.root/'product',build

    def test_bound_current_run_sha_and_modified_same_mtime_block(self):
        import unittest.mock as mock
        from types import SimpleNamespace
        m=self.native()
        source,build=self.make_native_fixtures()
        started=1
        env={'RUNNER_TEMP':str(self.root),'GITHUB_RUN_ATTEMPT':'1',
             'GITHUB_RUN_ID':'123456','GITHUB_SHA':'c'*40,'QA_VALIDATOR_SHA':'b'*40}
        with mock.patch.dict(os.environ,env), mock.patch('subprocess.run',
                                                         return_value=SimpleNamespace(returncode=0)) as runner:
            m.bind_pdf_proof(source,started)
            self.assertEqual(m.fresh_pdf(source,started),3)
            self.assertEqual(runner.call_count,1)
            file=build/'customer-pdf-1.zip'
            old=file.stat()
            data=file.read_bytes()
            file.write_bytes(data[:-1]+(b'X' if data[-1:] != b'X' else b'Y'))
            os.utime(file,ns=(old.st_atime_ns,old.st_mtime_ns))
            with self.assertRaises(m.Blocked):
                m.fresh_pdf(source,started)
            self.assertEqual(runner.call_count,1,'changed ZIP must fail before parser launch')

    def test_missing_or_forged_run_proof_blocks_before_PDF(self):
        import unittest.mock as mock
        m=self.native()
        source,_=self.make_native_fixtures()
        env={'RUNNER_TEMP':str(self.root),'GITHUB_RUN_ATTEMPT':'1',
             'GITHUB_RUN_ID':'123456','GITHUB_SHA':'c'*40,'QA_VALIDATOR_SHA':'b'*40}
        with mock.patch.dict(os.environ,env), mock.patch('subprocess.run') as runner:
            with self.assertRaises(FileNotFoundError):
                m.fresh_pdf(source,1)
            m.bind_pdf_proof(source,1)
            with mock.patch.dict(os.environ,{'GITHUB_RUN_ID':'222'},clear=False):
                with self.assertRaises(m.Blocked):
                    m.fresh_pdf(source,1)
            proof=self.root/'zamerovac-cloud-pdf-proof.json'
            payload=__import__('json').loads(proof.read_text())
            payload['fixtures'][0]['sha256']='0'*64
            proof.write_text(__import__('json').dumps(payload))
            with self.assertRaises(m.Blocked):
                m.fresh_pdf(source,1)
            runner.assert_not_called()


if __name__=='__main__':
    unittest.main()


class CloudRuntimeContractTests(unittest.TestCase):
    def test_cloud_lock_change_detection_retains_fd_and_home_write_guard(self):
        import importlib.util
        from unittest import mock
        import types
        tools = SCRIPT.parent
        spec = importlib.util.spec_from_file_location('diag_lock_under_test', tools/'qa_browser_lock.py')
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        import hashlib
        with tempfile.TemporaryDirectory(prefix='diag-lock-model-') as d:
            file = Path(d)/'model';file.write_bytes(b'\x7fELF-not-executed')
            profile = {'path':str(file),'sha256':hashlib.sha256(file.read_bytes()).hexdigest()}
            fake = types.SimpleNamespace(verified_runtime=lambda:{'chromium':profile})
            with mock.patch.dict(sys.modules, {'qa_cloud_runtime':fake}), mock.patch.dict(os.environ, {'ZAMEROVAC_QA_MODE':'cloud','ZAMEROVAC_CLOUD_RUNTIME_FILE':str(Path(d)/'runtime.json'),'CHROMIUM_PATH':str(file)}):
                lock=module.BrowserLock();self.assertIsNotNone(lock.fd);lock.close();self.assertIsNone(lock.fd)
                del os.environ['ZAMEROVAC_CLOUD_RUNTIME_FILE']
                with self.assertRaises(RuntimeError):module.BrowserLock()

    def test_cloud_checked_file_rejects_aliases_and_links_before_execution(self):
        import importlib.util
        spec=importlib.util.spec_from_file_location('diag_runtime_under_test', SCRIPT.parent/'qa_cloud_runtime.py')
        module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory(prefix='diag-runtime-files-') as d:
            p=Path(d)/'entry';p.write_bytes(b'original')
            self.assertEqual(module.checked(p),b'original')
            link=Path(d)/'link';link.symlink_to(p)
            with self.assertRaises(RuntimeError):module.checked(link)
            hard=Path(d)/'hard';os.link(p,hard)
            with self.assertRaises(RuntimeError):module.checked(p)
            self.assertEqual(p.read_bytes(),b'original')
