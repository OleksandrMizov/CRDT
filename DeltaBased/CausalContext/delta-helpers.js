'use strict';

function join(left, right) {
  if (typeof left === 'number' && typeof right === 'number') {
    return Math.max(left, right);
  }
  if (left && typeof left.join === 'function') {
    const res = Object.create(Object.getPrototypeOf(left));
    Object.assign(res, left);
    res.join(right);
    return res;
  }
  throw new Error('Cannot join these types');
}

const DeltaHelpers = {
  join,
};

module.exports = { DeltaHelpers };
