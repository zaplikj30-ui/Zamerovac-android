"""Cloud-only native evidence: preserve raw #88 FAIL, exact 64/513 XML and fresh PDF.

Never change HOME4 contract or translate productAcceptance into Gradle PASS.
No customer data, network install, APK, artifact upload or partial PASS.
"""
import json
import os
from pathlib import Path
import sys
import time

from qa.home4_contract import read_json, validate_junit, Blocked

EXPECTED_SOURCE = '3886fcf80213e4693464d3f30104885c1c58f53e'
PDF_NAMES = {'customer-pdf-1.zip', 'customer-pdf-3.zip', 'customer-pdf-multipage.zip'}
MAX_PDF_ZIP_BYTES = 16 * 1024 * 1024


def demand(condition, reason):
    if not condition:
        raise Blocked(reason)


def path_check(root):
    source = Path(root).resolve(strict=True)
    demand(source.is_dir() and (source/'.git').exists(), 'native-source-directory')
    return source


def parse_started(raw):
    demand(raw.isdecimal() and len(raw) <= 20, 'native-start-time-format')
    when = int(raw)
    demand(0 < when <= time.time_ns(), 'native-start-time-out-of-range')
    return when


def raw_xml(source, started_ns, raw_exit):
    demand(raw_exit in (0, 1), 'untrusted-raw-gradle-exit')
    contract = read_json(Path(__file__).parent/'qa/home4-jvm.json')
    demand(contract['sourceSha'] == 'c7e71327d69bfe87f622ff6293422e2e15332a11',
           'unreviewed-JVM-contract')
    xml = source/'app/build/test-results/testPreviewUnitTest'
    result = validate_junit(xml, raw_exit, started_ns, contract, source)
    # Validation is not "Gradle PASS". Preserve the historical 511 PASS / 2 FAIL
    # as real raw failures; unexpected zero failures FAILS this frozen contract.
    demand(result['rawGradle']['status'] == 'FAIL'
           and result['rawGradle']['exit'] == 1
           and result['rawGradle']['pass'] == 511
           and result['rawGradle']['fail'] == 2
           and result['releaseMapping'] == 'BLOCKED',
           'raw-#88-not-preserved')
    return result


def fresh_pdf(source, started_ns):
    build = source/'app/build'
    files = sorted(build.glob('customer-pdf-*.zip'))
    demand({p.name for p in files} == PDF_NAMES
           and len(files) == len(PDF_NAMES), 'pdf-exact-fixture-registry')
    for p in files:
        st = p.lstat()
        demand(p.is_file() and not p.is_symlink()
               and 0 < st.st_size <= MAX_PDF_ZIP_BYTES
               and st.st_nlink == 1 and st.st_mtime_ns >= started_ns,
               'pdf-not-fresh-regular-bounded-file')
    # The evaluator's own explicit checks survive Python -O.
    from subprocess import run
    pdf = Path(__file__).resolve().parent.parent/'check-customer-pdf.py'
    executable = os.environ.get('ZAMEROVAC_PDF_PYTHON') or sys.executable
    result = run([executable, str(pdf), *map(str, files)],
                 stdin=-3, stdout=-3, stderr=-3, timeout=120, check=False)
    demand(result.returncode == 0, 'pdf-real-parser-renderer-failed')
    return 3


def main(argv):
    demand(len(argv) == 4, 'native-usage')
    mode, source_dir, start, raw_exit = argv
    source = path_check(source_dir)
    started_ns = parse_started(start)
    demand(mode in ('xml', 'pdf'), 'native-mode')
    if mode == 'xml':
        raw = int(raw_exit)
        actual = raw_xml(source, started_ns, raw)
        # Enables only independent PDF validation; current raw Gradle stays FAIL.
        output = os.environ.get('GITHUB_OUTPUT')
        if output:
            with open(output, 'a', encoding='ascii') as result:
                result.write('jvm_verified=true\n')
        print('RAW JVM: 64 XML / 513 named / 49 critical, 511 PASS + 2 FAIL #88, exit 1')
        print('RELEASE BLOCKED; raw Gradle FAIL preserved independently from PDF')
        return 1
    demand(raw_exit == '1', 'pdf-requires-verified-historical-raw-exit')
    total = fresh_pdf(source, started_ns)
    print(f'PDF: {total} fresh, bounded synthetic ZIP, strict independent parser/render')
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main(sys.argv[1:]))
    except BaseException as e:
        # Never publish private Gradle/PDF data, paths, exception text or customer files.
        print('BLOCKED native evidence: '+type(e).__name__, file=sys.stderr)
        sys.exit(78)
