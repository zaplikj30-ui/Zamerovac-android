"""Cloud-only native evidence: preserve raw #88 FAIL, exact 64/513 XML and fresh PDF.

Never change HOME4 contract or translate productAcceptance into Gradle PASS.
No customer data, network install, APK, artifact upload or partial PASS.
"""
import hashlib
import json
import os
import re
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


# A current JVM XML acceptance binds the exact synthetic ZIP byte identities
# to this owner/run/P/V/E. A fresh mtime alone is NOT origin evidence.
PDF_PROOF = 'zamerovac-cloud-pdf-proof.json'


def proof_context(started_ns):
    e = os.environ
    demand(e.get('GITHUB_RUN_ATTEMPT') == '1'
           and re.fullmatch(r'[1-9][0-9]{0,19}', e.get('GITHUB_RUN_ID') or '')
           and re.fullmatch(r'[a-f0-9]{40}', e.get('GITHUB_SHA') or '')
           and re.fullmatch(r'[a-f0-9]{40}', e.get('QA_VALIDATOR_SHA') or ''),
           'pdf-proof-event-identity')
    return {'runId':e['GITHUB_RUN_ID'], 'eventSha':e['GITHUB_SHA'],
            'validatorSha':e['QA_VALIDATOR_SHA'],
            'productSha':EXPECTED_SOURCE, 'startedNs':started_ns, 'rawExit':1}


def proof_path():
    root = Path(os.environ.get('RUNNER_TEMP') or '.')
    demand(root.is_absolute() and root.is_dir() and not root.is_symlink(),
           'pdf-proof-private-runner-temp')
    return root/PDF_PROOF


def pdf_rows(source, started_ns):
    build = source/'app/build'
    files = sorted(build.glob('customer-pdf-*.zip'))
    demand({p.name for p in files} == PDF_NAMES and len(files) == len(PDF_NAMES),
           'pdf-exact-fixture-registry')
    rows = []
    for p in files:
        st = p.lstat()
        demand(p.is_file() and not p.is_symlink()
               and 0 < st.st_size <= MAX_PDF_ZIP_BYTES
               and st.st_nlink == 1 and st.st_mtime_ns >= started_ns,
               'pdf-not-fresh-regular-bounded-file')
        digest = hashlib.sha256()
        with p.open('rb') as stream:
            for chunk in iter(lambda: stream.read(1024 * 1024), b''):
                digest.update(chunk)
        post = p.lstat()
        demand((st.st_dev, st.st_ino, st.st_size, st.st_mtime_ns) ==
               (post.st_dev, post.st_ino, post.st_size, post.st_mtime_ns),
               'pdf-fixture-changed-while-hashing')
        rows.append({'name':p.name, 'bytes':st.st_size,
                     'sha256':digest.hexdigest(), 'mtimeNs':st.st_mtime_ns})
    return rows


def bind_pdf_proof(source, started_ns):
    payload = {**proof_context(started_ns), 'fixtures':pdf_rows(source, started_ns)}
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, 'O_NOFOLLOW', 0)
    fd = os.open(proof_path(), flags, 0o600)
    with os.fdopen(fd, 'w', encoding='ascii') as output:
        json.dump(payload, output, sort_keys=True)


def fresh_pdf(source, started_ns):
    proof = proof_path()
    st = proof.lstat()
    demand(proof.is_file() and not proof.is_symlink() and st.st_nlink == 1
           and 0 < st.st_size <= 4096 and (st.st_mode & 0o077) == 0,
           'pdf-proof-file-identity')
    bound = read_json(proof)
    expected = {**proof_context(started_ns),
                'fixtures':pdf_rows(source, started_ns)}
    demand(bound == expected, 'pdf-not-bound-to-verified-current-JVM-run')
    files = [source/'app/build'/name for name in sorted(PDF_NAMES)]
    # The evaluator's own explicit checks survive Python -O.
    from subprocess import run
    pdf = Path(__file__).resolve().parent/'check-customer-pdf.py'
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
        # Bind the genuine 3 synthetic ZIP byte identities to this JVM run.
        # If fixtures are absent, keep the XML result independent but never
        # produce PDF proof or green PDF later.
        try:
            bind_pdf_proof(source, started_ns)
        except (Blocked, FileNotFoundError):
            pass
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
