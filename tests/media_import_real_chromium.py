#!/usr/bin/env python3
"""Opt-in browser regression: real Chromium IndexedDB transactions & restart.

Run on a trusted checkout only. Uses a fresh temporary localhost origin and a
throw-away browser profile. NEVER uses the user's production browser profile.
Not an Android file picker, power-loss, or source-byte preservation test.
"""
from __future__ import annotations

from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Thread
import os
import sys

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OWNER = ROOT / 'app/src/main/assets/media-import-ownership.js'


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


def main() -> int:
    if not OWNER.is_file():
        print('BLOCKED: real production media-import-ownership.js missing', file=sys.stderr)
        return 2
    # Browsers need a normal secure-enough origin for IndexedDB, never file://.
    with TemporaryDirectory(prefix='qa-media-browser-') as profile:
        server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT / 'app/src/main/assets')))
        Thread(target=server.serve_forever, daemon=True).start()
        url = f'http://127.0.0.1:{server.server_port}/media-import-ownership.js'
        home = f'http://127.0.0.1:{server.server_port}/'
        try:
            with sync_playwright() as p:
                for session in range(2):
                    context = p.chromium.launch_persistent_context(
                        user_data_dir=profile, headless=True,
                        executable_path=os.environ.get('CHROMIUM_BIN', '/usr/bin/chromium'),
                        args=['--disable-dev-shm-usage'],
                    )
                    page = context.new_page()
                    page.goto(home)
                    page.add_script_tag(url=url)
                    if session == 0:
                        results = page.evaluate(r'''async () => {
                          const api = MediaImportOwnership;
                          const same = (a,b) => JSON.stringify(a)===JSON.stringify(b);
                          function check(x,message){if(!x)throw Error(message)}
                          const was = await api.inspect('image_100');
                          check(was === null, 'fresh private profile already has photo');
                          await api.reserve('image_100','request_100');
                          check((await api.inspect('image_100')).phase==='reserved','not reserved');
                          await api.published('image_100','request_100');
                          check(same(await api.inspect('image_100'),{owner:'request_100',phase:'published'}),'published mismatch');
                          const both=await Promise.allSettled([
                            api.reserve('photo_201','request_201'),api.reserve('photo_202','request_202')]);
                          check(both.every(r=>r.status==='fulfilled'),'concurrent distinct commits failed');
                          check((await api.inspect('photo_201')).owner==='request_201','lost receipt 201');
                          check((await api.inspect('photo_202')).owner==='request_202','lost receipt 202');
                          const compete=await Promise.allSettled([
                            api.reserve('photo_203','request_203'),api.reserve('photo_203','request_204')]);
                          check(compete.filter(r=>r.status==='fulfilled').length===1,'duplicate ownership');
                          check((await api.inspect('photo_203')).owner==='request_203','first owner not preserved');
                          try {await api.published('image_100','foreign_owner');throw Error('stolen publish succeeded');}
                          catch(e){check(!/stolen publish succeeded/.test(String(e)),String(e));}
                          try {await api.reserve('../bad','request_100');throw Error('traversal accepted');}
                          catch(e){check(!/traversal accepted/.test(String(e)),String(e));}
                          // Intercept REAL IndexedDB add success and synchronously abort the actual tx.
                          // This is a real browser rollback, not an in-memory fake store.
                          let abortAdd = true;
                          const origAdd=IDBObjectStore.prototype.add;
                          IDBObjectStore.prototype.add=function(...args){
                            const req=origAdd.apply(this,args);
                            if(abortAdd){abortAdd=false;const tx=this.transaction;
                              req.addEventListener('success',()=>tx.abort(),{once:true});}
                            return req;
                          };
                          let rejected = false;
                          try {await api.reserve('photo_abort_01','request_205');}
                          catch(e){rejected=true;}
                          IDBObjectStore.prototype.add=origAdd;
                          check(rejected,'aborted reserve falsely reported success');
                          check(await api.inspect('photo_abort_01')===null,'aborted receipt on disk');
                          await api.reserve('photo_pending_01','request_206');
                          let abortPut=true;
                          const origPut=IDBObjectStore.prototype.put;
                          IDBObjectStore.prototype.put=function(...args){
                            const req=origPut.apply(this,args);
                            if(abortPut){abortPut=false;const tx=this.transaction;
                              req.addEventListener('success',()=>tx.abort(),{once:true});}
                            return req;
                          };
                          rejected=false;
                          try {await api.published('photo_pending_01','request_206');}
                          catch(e){rejected=true;}
                          IDBObjectStore.prototype.put=origPut;
                          check(rejected,'aborted publish falsely succeeded');
                          check((await api.inspect('photo_pending_01')).phase==='reserved',
                                'abort published a reserved receipt');
                          return ['real commit', '2 concurrent', 'contested owner',
                                  'invalid owner/path', 'abort add', 'abort put'];
                        }''')
                        print('PASS real IndexedDB Chromium:', ', '.join(results))
                    else:
                        result = page.evaluate(r'''async () => {
                          const a=await MediaImportOwnership.inspect('image_100');
                          const b=await MediaImportOwnership.inspect('photo_201');
                          const c=await MediaImportOwnership.inspect('photo_202');
                          const d=await MediaImportOwnership.inspect('photo_abort_01');
                          const e=await MediaImportOwnership.inspect('photo_pending_01');
                          if(a?.phase!=='published'||b?.phase!=='reserved'||c?.phase!=='reserved'||
                             d!==null||e?.phase!=='reserved') throw Error('Disk persistence / aborted transaction changed on Chromium restart');
                          return 'disk-backed receipts survived whole Chromium process restart';
                        }''')
                        print('PASS browser-process restart:', result)
                    context.close()
        finally:
            server.shutdown()
            server.server_close()
    return 0


if __name__ == '__main__':
    sys.exit(main())
