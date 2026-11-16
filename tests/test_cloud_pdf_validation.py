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


if __name__=='__main__':
    unittest.main()
