"""Strictly validate *synthetic* native PDF ZIP fixtures; never open customer data.

All security checks use explicit exceptions (also under python -O/PYTHONOPTIMIZE).
The bounds limit untrusted archive allocation before invoking the two PDF parsers.
"""
import io
from pathlib import Path
import sys
import zipfile

import pymupdf as fitz
from pypdf import PdfReader

MAX_ARCHIVE_BYTES = 16 * 1024 * 1024
MAX_ENTRIES = 16
MAX_PDF_BYTES = 8 * 1024 * 1024
MAX_TOTAL_PDF_BYTES = 32 * 1024 * 1024


class FixtureError(ValueError):
    """Content, count or byte bounds did not match the approved fixture."""


def require(condition, reason):
    if not condition:
        raise FixtureError(reason)


def inspect_fixture(path):
    path = Path(path)
    stat = path.lstat()
    require(path.is_file() and not path.is_symlink() and 0 < stat.st_size <= MAX_ARCHIVE_BYTES,
            'invalid or oversized synthetic PDF archive')
    multiple = 'multipage' in path.name
    expected_pages = 3 if multiple else 1
    width, height = (100, 60) if multiple else (160, 90)
    with zipfile.ZipFile(path) as archive:
        entries = archive.infolist()
        require(0 < len(entries) <= MAX_ENTRIES, 'invalid PDF ZIP entry count')
        seen = set()
        total = 0
        for info in entries:
            name = info.filename
            require(name.endswith('.pdf') and name not in ('.pdf', '..pdf')
                    and '/' not in name and '\\' not in name and '\x00' not in name,
                    'invalid PDF ZIP filename')
            require(name.casefold() not in seen, 'duplicate PDF ZIP name')
            seen.add(name.casefold())
            # Ordinary file entries only; no symlinks, special files or encrypted ZIP members.
            unix_type = (info.external_attr >> 16) & 0o170000
            require(unix_type in (0, 0o100000) and not info.is_dir()
                    and (info.flag_bits & 1) == 0,
                    'unsafe PDF ZIP entry type')
            require(0 < info.file_size <= MAX_PDF_BYTES
                    and 0 < info.compress_size <= MAX_ARCHIVE_BYTES,
                    'PDF ZIP member byte limit')
            total += info.file_size
            require(total <= MAX_TOTAL_PDF_BYTES, 'PDF ZIP aggregate byte limit')
            with archive.open(info) as member:
                data = member.read(MAX_PDF_BYTES + 1)
                require(len(data) == info.file_size and not member.read(1),
                        'PDF ZIP member size changed')
            reader = PdfReader(io.BytesIO(data), strict=True)
            require(len(reader.pages) == expected_pages, 'incorrect PDF page count')
            for page in reader.pages:
                require([float(x) for x in page.mediabox] == [0, 0, width, height],
                        'incorrect PDF page dimensions')
                require(not page.get('/Annots') and page.extract_text() == '',
                        'PDF contains annotations or text')
                require(len(page.images) == 1 and page.images[0].image.size == (width, height),
                        'PDF raster must be a single expected-size original image')
            require(not reader.trailer['/Root'].get('/AcroForm')
                    and not reader.trailer['/Root'].get('/Names')
                    and not reader.metadata,
                    'PDF contains interactive data or metadata')
            with fitz.open(stream=data, filetype='pdf') as document:
                require(len(document) == expected_pages, 'renderer page count changed')
                for page in document:
                    pixmap = page.get_pixmap()
                    require(pixmap.width == width and pixmap.height == height,
                            'renderer pixel dimensions changed')
                    red, green, blue = pixmap.pixel(width // 2, height // 2)[:3]
                    require(red > 245 and blue < 10
                            and (green < 10 if multiple else green > 245),
                            'renderer fixture pixel color mismatch')
    return len(entries)


def main(paths):
    require(len(paths) > 0 and len(paths) <= 3, 'expected one to three synthetic ZIP fixtures')
    for path in paths:
        count = inspect_fixture(path)
        # Do not publish caller-provided path, PDF metadata, ZIP entry names or content.
        print(f'OK: synthetic PDF fixture: {count} PDFs, strict parse/render verified')


if __name__ == '__main__':
    try:
        main(sys.argv[1:])
    except Exception as error:
        # Public Actions output must not disclose filesystem paths or PDF contents.
        print(f'BLOCKED synthetic PDF validation: {type(error).__name__}', file=sys.stderr)
        sys.exit(1)
