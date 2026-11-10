/* N4-A deterministic fault-injection model for MediaImportOwnership.
 * Models staged writes, atomic COMMIT/abort and serialized transactions on
 * the same IndexedDB object store; NOT a real browser or disk persistence test.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('app/src/main/assets/media-import-ownership.js', 'utf8');

function transactionalIndexedDB() {
  const committed = new Map();
  const waiting = [];
  let active = null, openFault = false, commitFault = null, opened = 0;
  let heldError = null;
  function startNext() {
    if (active || !waiting.length) return;
    active = waiting.shift();
    queueMicrotask(() => active.start());
  }
  const database = {
    objectStoreNames: {contains: name => name === 'imports'},
    createObjectStore() { throw Error('Unnecessary schema migration'); },
    close() {},
    transaction(name, mode) {
      assert.equal(name, 'imports');
      assert.ok(mode === 'readwrite' || mode === 'readonly');
      // A queued write MUST read committed state when it starts, not when
      // transaction() is called. This model conservatively queues reads too.
      let staged, started = false, finished = false, scheduled = false;
      let operation = 'inspect';
      const requests = [];
      const slot = {start() { started = true; staged = new Map(committed); pump(); }};
      function release() {
        assert.equal(active, slot, 'A transaction released someone else\'s lock');
        active = null;
        startNext();
      }
      const tx = {
        error: null, oncomplete: null, onabort: null, onerror: null,
        abort() {
          if (finished) return;
          finished = true;
          queueMicrotask(() => { try { tx.onabort?.(); } finally { release(); } });
        },
        objectStore(key) {
          assert.equal(key, 'imports');
          function request(fn) {
            const req = {result: undefined, error: null, onsuccess: null, onerror: null};
            requests.push({req, fn});
            pump();
            return req;
          }
          return {
            add(value, id) {
              assert.equal(mode, 'readwrite');
              operation = 'reserve';
              return request(() => {
                if (staged.has(id)) throw Error('ConstraintError: duplicate owner');
                staged.set(id, {...value});
                return id;
              });
            },
            get(id) { return request(() => staged.get(id) && {...staged.get(id)}); },
            put(value, id) {
              assert.equal(mode, 'readwrite');
              operation = 'published';
              return request(() => { staged.set(id, {...value}); return id; });
            }
          };
        }
      };
      function requestError(req, error) {
        req.error = error;
        tx.error = error;
        const event = {type: 'error', target: req, bubbles: true};
        // IndexedDB request errors bubble to the transaction before auto-abort.
        try { req.onerror?.(event); tx.onerror?.(event); }
        finally {
          const pause = heldError;
          heldError = null;
          if (pause) {
            pause.observed();
            pause.resume.then(() => queueMicrotask(() => tx.abort()));
          } else queueMicrotask(() => tx.abort());
        }
      }
      function pump() {
        if (!started || finished || scheduled) return;
        scheduled = true;
        queueMicrotask(() => {
          scheduled = false;
          if (finished) return;
          const item = requests.shift();
          if (!item) { finish(); return; }
          try { item.req.result = item.fn(); }
          catch (error) { requestError(item.req, error); return; }
          try { item.req.onsuccess?.(); }
          catch (error) { tx.error = error; tx.abort(); return; }
          pump(); // Includes requests queued by onsuccess (get -> put).
        });
      }
      function finish() {
        if (finished || requests.length) return;
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
        try { tx.oncomplete?.(); } finally { release(); }
      }
      waiting.push(slot);
      startNext();
      return tx;
    }
  };
  return {
    committed,
    failNextOpen() { openFault = true; },
    failNextCommit(phase) {assert.ok(['reserve', 'published'].includes(phase)); commitFault = phase;},
    holdNextRequestErrorAbort() {
      assert.equal(heldError, null);
      let observed, resumeAbort;
      const whenError = new Promise(resolve => { observed = resolve; });
      const resume = new Promise(resolve => { resumeAbort = resolve; });
      heldError = {observed, resume};
      return {whenError, resumeAbort};
    },
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

  indexedDB.failNextOpen();
  await assert.rejects(importer.reserve(id, owner), /blokována/);
  assert.equal(indexedDB.committed.size, 0, 'Blocked open wrote a receipt');
  await importer.reserve(id, owner);
  assert.equal(indexedDB.openCount, 2, 'Blocked opening poisoned all retries');
  assert.equal((await importer.inspect(id)).phase, 'reserved');

  indexedDB.failNextCommit('reserve');
  await assert.rejects(importer.reserve('original_photo_02', owner), /commit interrupted/);
  assert.equal(await importer.inspect('original_photo_02'), null,
    'Aborted reserve was reported as a durable receipt');
  assert.equal(indexedDB.committed.size, 1);
  await importer.reserve('original_photo_02', owner);
  assert.equal((await importer.inspect('original_photo_02')).phase, 'reserved');

  indexedDB.failNextCommit('published');
  await assert.rejects(importer.published(id, owner), /commit interrupted/);
  assert.equal((await importer.inspect(id)).phase, 'reserved',
    'Abort incorrectly promoted an unconfirmed imported file');
  await importer.published(id, owner);
  assert.equal((await importer.inspect(id)).phase, 'published');

  await assert.rejects(importer.reserve(id, 'request_999'));
  await assert.rejects(importer.published('absent_photo_03', owner));
  await assert.rejects(importer.published('original_photo_02', 'request_999'));
  assert.equal((await importer.inspect('original_photo_02')).phase, 'reserved');
  assert.equal((await importer.inspect(id)).owner, owner);

  // Parallel readwrite on the same store must not lose either receipt.
  const distinct = await Promise.allSettled([
    importer.reserve('parallel_photo_01', 'parallel_owner_01'),
    importer.reserve('parallel_photo_02', 'parallel_owner_02')
  ]);
  assert.deepEqual(distinct.map(result => result.status), ['fulfilled', 'fulfilled']);
  assert.equal((await importer.inspect('parallel_photo_01')).owner, 'parallel_owner_01');
  assert.equal((await importer.inspect('parallel_photo_02')).owner, 'parallel_owner_02');
  assert.equal(indexedDB.committed.size, 4, 'Concurrent writes overwrote durable receipts');

  // Competing owners on one photo: exactly one write can commit.
  const same = await Promise.allSettled([
    importer.reserve('contested_photo_01', 'competing_owner_01'),
    importer.reserve('contested_photo_01', 'competing_owner_02')
  ]);
  assert.deepEqual(same.map(result => result.status), ['fulfilled', 'rejected']);
  assert.equal((await importer.inspect('contested_photo_01')).owner, 'competing_owner_01');
  assert.equal(indexedDB.committed.size, 5);

  // A failed COMMIT must never erase an earlier successful writer.
  indexedDB.failNextCommit('reserve');
  const concurrentAbort = await Promise.allSettled([
    importer.reserve('aborted_photo_01', 'parallel_owner_01'),
    importer.reserve('surviving_photo_01', 'parallel_owner_02')
  ]);
  assert.deepEqual(concurrentAbort.map(result => result.status), ['rejected', 'fulfilled']);
  assert.equal(await importer.inspect('aborted_photo_01'), null);
  assert.equal((await importer.inspect('surviving_photo_01')).owner, 'parallel_owner_02');
  assert.equal((await importer.inspect(id)).phase, 'published');
  assert.equal(indexedDB.committed.size, 6);

  // Request error -> transaction.onerror must reject BEFORE tx.onabort.
  // Holding auto-abort exposes a missing onerror handler (rather than masking
  // it with the eventual onabort rejection).
  const gate = indexedDB.holdNextRequestErrorAbort();
  const rejectedByError = importer.reserve('contested_photo_01', 'foreign_owner_01');
  await gate.whenError;
  let errorOutcome = 'pending';
  rejectedByError.then(() => { errorOutcome = 'fulfilled'; },
    () => { errorOutcome = 'rejected'; });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(errorOutcome, 'rejected', 'tx.onerror did not reject before auto-abort');
  gate.resumeAbort();
  await assert.rejects(rejectedByError, /ConstraintError/);
  assert.equal((await importer.inspect('contested_photo_01')).owner, 'competing_owner_01');

  // A new JS VM shares the fake in-memory Map. This is NOT disk-persistent
  // IndexedDB after a WebView/Android restart or device power loss.
  const reopened = browserSession(indexedDB);
  assert.equal((await reopened.inspect(id)).phase, 'published');
  assert.equal((await reopened.inspect('original_photo_02')).phase, 'reserved');
  assert.equal((await reopened.inspect('surviving_photo_01')).phase, 'reserved');
  assert.equal(indexedDB.committed.size, 6, 'VM restart duplicated a media receipt');
  console.log('PASS media import model: blocked/retry, commit abort, parallel receipts, owner, tx.onerror, VM restart');
})().catch(error => { console.error(error); process.exitCode = 1; });
