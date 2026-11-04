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
            multiple = 'multipage' in str(path)
            assert len(reader.pages) == (3 if multiple else 1)
            width, height = (100, 60) if multiple else (160, 90)
            for page in reader.pages:
                assert [float(x) for x in page.mediabox] == [0, 0, width, height]
                assert not page.get('/Annots')
                assert page.extract_text() == ''
                assert len(page.images) == 1
                assert page.images[0].image.size == (width, height)
            assert not reader.trailer['/Root'].get('/AcroForm')
            assert not reader.trailer['/Root'].get('/Names')
            assert not reader.metadata
            with fitz.open(stream=data, filetype='pdf') as document:
                for page in document:
                    pixmap = page.get_pixmap()
                    assert pixmap.width == width and pixmap.height == height
                    red, green, blue = pixmap.pixel(width//2, height//2)[:3]
                    assert red > 245 and blue < 10
                    assert green < 10 if multiple else green > 245
    print(f'OK: {path}: {len(names)} PDFs, strict parser, image-only, correct aspect and rendered fixture colors')
