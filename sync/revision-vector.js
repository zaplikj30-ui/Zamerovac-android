'use strict';

// A transport-independent building block, not a sync engine. A vector records
// observed per-device revisions; it must never be used as a last-writer clock.
const DEVICE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const MAX_DEVICES = 1024;

function validate(vector) {
  if (!vector || typeof vector !== 'object' || Array.isArray(vector) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(vector))) {
    throw new TypeError('Invalid revision vector');
  }
  const keys = Object.keys(vector);
  if (keys.length > MAX_DEVICES) throw new RangeError('Too many devices');
  for (const id of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(vector, id);
    if (!DEVICE_ID.test(id) || !descriptor || !('value' in descriptor) ||
        !Number.isSafeInteger(descriptor.value) || descriptor.value < 1) {
      throw new TypeError('Invalid device revision');
    }
  }
  return vector;
}

// 'before' and 'after' are strict causal order, 'concurrent' requires keeping
// both versions, including when one version represents deletion.
function compare(left, right) {
  validate(left); validate(right);
  let less = false, greater = false;
  for (const id of new Set([...Object.keys(left), ...Object.keys(right)])) {
    const a = Object.hasOwn(left, id) ? left[id] : 0;
    const b = Object.hasOwn(right, id) ? right[id] : 0;
    less ||= a < b;
    greater ||= a > b;
  }
  return less && greater ? 'concurrent' : less ? 'before' : greater ? 'after' : 'equal';
}

function merge(left, right) {
  validate(left); validate(right);
  const result = Object.create(null);
  for (const id of new Set([...Object.keys(left), ...Object.keys(right)])) {
    result[id] = Math.max(Object.hasOwn(left, id) ? left[id] : 0,
      Object.hasOwn(right, id) ? right[id] : 0);
  }
  return validate(result);
}

function advance(vector, deviceId) {
  validate(vector);
  if (typeof deviceId !== 'string' || !DEVICE_ID.test(deviceId)) throw new TypeError('Invalid device ID');
  const result = merge(vector, Object.create(null));
  const previous = Object.hasOwn(result, deviceId) ? result[deviceId] : 0;
  if (previous === Number.MAX_SAFE_INTEGER) throw new RangeError('Revision overflow');
  result[deviceId] = previous + 1;
  return validate(result);
}

module.exports = { compare, merge, advance };
