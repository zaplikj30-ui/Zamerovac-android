'use strict';
const assert = require('node:assert/strict');
const { compare, merge, advance } = require('../sync/revision-vector');
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const original = advance({}, A);
const phone = advance(original, A);
const tablet = advance(original, B);
const desktop = advance(original, C);
assert.equal(compare(original, phone), 'before');
assert.equal(compare(phone, original), 'after');
assert.equal(compare(phone, phone), 'equal');
assert.equal(compare(phone, tablet), 'concurrent');
assert.equal(compare(tablet, desktop), 'concurrent');
// The same rule applies to a deletion versus a concurrent edit.
assert.equal(compare(advance(original, A), advance(original, B)), 'concurrent');
const joined = merge(merge(phone, tablet), desktop);
for (const revision of [phone, tablet, desktop]) assert.equal(compare(revision, joined), 'before');
assert.equal(compare(merge(phone, tablet), merge(tablet, phone)), 'equal');
assert.equal(compare(JSON.parse(JSON.stringify(joined)), joined), 'equal');
assert.equal(compare(original, { [A]: 1 }), 'equal');
assert.deepEqual({ ...original }, { [A]: 1 }); // inputs did not change
for (const bad of [null, [], { [A]: 0 }, { [A]: -1 }, { [A]: 1.1 },
  { [A]: Number.MAX_SAFE_INTEGER + 1 }, { __proto__: null, bad: 1 },
  JSON.parse('{"__proto__":1}'), { [A]: '1' }]) {
  assert.throws(() => compare(bad, {}));
}
const getter = {}; Object.defineProperty(getter, A, { enumerable: true, get() { throw Error('must not execute'); } });
assert.throws(() => compare(getter, {}), TypeError);
assert.throws(() => advance({ [A]: Number.MAX_SAFE_INTEGER }, A), RangeError);
assert.throws(() => advance({}, '__proto__'), TypeError);
console.log('revision vectors: positive, concurrent and invalid-input cases passed');
