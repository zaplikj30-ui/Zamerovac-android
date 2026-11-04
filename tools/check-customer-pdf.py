"""Validate/render synthetic PDFs produced by native tests, never customer files.
Usage: python3 tools/check-customer-pdf.py path/to/customer-pdf-1.zip ...
Requires pypdf, pymupdf; intended for the development workspace.
"""
import io
import sys
import zipfile
import fitz
from pypdf import PdfReader

for path in sys.argv[1:]:
    with zipfile.ZipFile(path) as archive:
        names = archive.namelist()
        assert names and all(name.endswith('.pdf') and '/' not in name for name in names)
        for name in names:
            data = archive.read(name)
            reader = PdfReader(io.BytesIO(data), strict=True)
            assert len(reader.pages) == 1
            page = reader.pages[0]
            assert [float(x) for x in page.mediabox] == [0, 0, 160, 90]
            assert not page.get('/Annots')
            assert not reader.trailer['/Root'].get('/AcroForm')
            assert not reader.trailer['/Root'].get('/Names')
            assert not reader.metadata
            assert page.extract_text() == ''
            assert len(page.images) == 1
            assert page.images[0].image.size == (160, 90)
            with fitz.open(stream=data, filetype='pdf') as document:
                pixmap = document[0].get_pixmap()
                assert pixmap.width == 160 and pixmap.height == 90
                red, green, blue = pixmap.pixel(80, 45)[:3]
                assert red > 245 and green > 245 and blue < 10
    print(f'OK: {path}: {len(names)} PDFs, strict parser, image-only, correct aspect, rendered yellow fixture')
