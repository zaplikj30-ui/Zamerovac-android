/* N4-A fault-injection regression: a receipt is confirmed only when the
 * IndexedDB transaction commits, never when add()/put() merely returns.
 * Executes production MediaImportOwnership; only IndexedDB is simulated.
 * The fake atomically publishes staged changes on tx.oncomplete, not earlier.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('app/src/main/assets/media-import-ownership.js', 'utf8');

function transactionalIndexedDB() {
  const committed = new Map();
  let openFault = false, commitFault = null, opened = 0;
  const database = {
    objectStoreNames: {contains: name => name === 'imports'},
    createObjectStore() { throw Error('Unnecessary schema migration'); },
    close() {},
    transaction(name, mode) {
      assert.equal(name, 'imports');
      assert.ok(mode === 'readwrite' || mode === 'readonly');
      const staged = new Map(committed);
      let pending = 0, finished = false, operation = 'inspect';
      const tx = {
        error: null, oncomplete: null, onabort: null, onerror: null,
        abort() {
          if (finished) return;
          finished = true;
          queueMicrotask(() => tx.onabort?.());
        },
        objectStore(key) {
          assert.equal(key, 'imports');
          function request(op, fn) {
            const req = {result: undefined, error: null, onsuccess: null, onerror: null};
            ++pending;
            queueMicrotask(() => {
              if (finished) { --pending; return; }
              try {
                req.result = fn();
                req.onsuccess?.();
              } catch (error) {
                req.error = error;
                tx.error = error;
                finished = true;
                req.onerror?.();
                queueMicrotask(() => tx.onabort?.());
              } finally {
                --pending;
                if (pending === 0 && !finished) queueMicrotask(finish);
              }
            });
            return req;
          }
          return {
            add(value, id) {
              assert.equal(mode, 'readwrite');
              operation = 'reserve';
              return request('add', () => {
                if (staged.has(id)) throw Error('ConstraintError: duplicate owner');
                staged.set(id, {...value});
                return id;
              });
            },
            get(id) { return request('get', () => staged.get(id) && {...staged.get(id)}); },
            put(value, id) {
              assert.equal(mode, 'readwrite');
              operation = 'published';
              return request('put', () => { staged.set(id, {...value}); return id; });
            }
          };
        }
      };
      function finish() {
        if (pending || finished) return;
        if (mode === 'readwrite' && commitFault === operation) {
          commitFault = null;
          tx.error = Error('QuotaExceededError: commit interrupted');
          tx.abort();
          return;
        }
        finished = true;
        if (mode === 'readwrite') {
          committed.clear();
          for (const [id, value] of staged) committed.set(id, {...value});
        }
        tx.oncomplete?.();
      }
      return tx;
    }
  };
  return {
    committed,
    failNextOpen() { openFault = true; },
    failNextCommit(phase) {assert.ok(['reserve','published'].includes(phase)); commitFault = phase;},
    get openCount() { return opened; },
    open(name, version) {
      assert.equal(name, 'zamerovac-import-ownership');
      assert.equal(version, 1);
      ++opened;
      const req = {result: database, onupgradeneeded: null, onsuccess: null, onblocked: null};
      queueMicrotask(() => {
        if (openFault) { openFault = false; req.onblocked?.(); }
        else { req.onupgradeneeded?.(); req.onsuccess?.(); }
      });
      return req;
    }
  };
}

function browserSession(indexedDB) {
  const sandbox = {indexedDB, queueMicrotask};
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, {filename: 'media-import-ownership.js'});
  assert.ok(Object.isFrozen(sandbox.MediaImportOwnership));
  return sandbox.MediaImportOwnership;
}

(async () => {
  const indexedDB = transactionalIndexedDB();
  const importer = browserSession(indexedDB);
  const id = 'original_photo_01', owner = 'request_001';

  // An opening blocked by another client must not fabricate an ownership
  // receipt; a subsequent explicit user retry must be able to reopen.
  indexedDB.failNextOpen();
  await assert.rejects(importer.reserve(id, owner), /blokována/);
  assert.equal(indexedDB.committed.size, 0, 'Blocked open wrote a receipt');
  await importer.reserve(id, owner);
  assert.equal(indexedDB.openCount, 2, 'Blocked opening poisoned all retries');
  assert.equal((await importer.inspect(id)).phase, 'reserved');

  // A successful add() callback is not a durable receipt. Force the whole
  // transaction to abort at COMMIT, after the staged add has completed.
  indexedDB.failNextCommit('reserve');
  await assert.rejects(importer.reserve('original_photo_02', owner), /commit interrupted/);
  assert.equal(await importer.inspect('original_photo_02'), null,
    'Aborted reserve was reported as a durable receipt');
  assert.equal(indexedDB.committed.size, 1);
  await importer.reserve('original_photo_02', owner);
  assert.equal((await importer.inspect('original_photo_02')).phase, 'reserved');

  // An interrupted published() commit must preserve the reserved receipt.
  indexedDB.failNextCommit('published');
  await assert.rejects(importer.published(id, owner), /commit interrupted/);
  assert.equal((await importer.inspect(id)).phase, 'reserved',
    'Abort incorrectly promoted an unconfirmed imported file');
  await importer.published(id, owner);
  assert.equal((await importer.inspect(id)).phase, 'published');

  // Another request cannot claim an existing file or publish an absent one.
  await assert.rejects(importer.reserve(id, 'request_999'));
  await assert.rejects(importer.published('absent_photo_03', owner));
  await assert.rejects(importer.published('original_photo_02', 'request_999'));
  assert.equal((await importer.inspect('original_photo_02')).phase, 'reserved');
  assert.equal((await importer.inspect(id)).owner, owner);

  // Simulate WebView process restart with the original durable IndexedDB data.
  const reopened = browserSession(indexedDB);
  assert.equal((await reopened.inspect(id)).phase, 'published');
  assert.equal((await reopened.inspect('original_photo_02')).phase, 'reserved');
  assert.equal(indexedDB.committed.size, 2, 'Restart duplicated a media receipt');
  console.log('PASS media import: blocked open/retry, commit abort reserve/publish, exact owner, restart');
})().catch(error => { console.error(error); process.exitCode = 1; });
