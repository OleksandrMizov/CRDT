'use strict';

const crypto = require('node:crypto');

class DeltaORSet {
  #added;
  #removed;

  constructor({ added = {}, removed = {} } = {}) {
    this.#added = { ...added };
    this.#removed = { ...removed };
  }

  add(item, tag = crypto.randomUUID()) {
    const result = new DeltaORSet();
    const added = this.#added[item] || [];
    result.#added[item] = new Set([...added, tag]);
    return result;
  }

  remove(item) {
    const result = new DeltaORSet();
    const added = this.#added[item];

    if (!added) return result;

    const removed = this.#removed[item] || [];
    result.#removed[item] = new Set([...removed, ...added]);

    return result;
  }

  join(delta) {
    for (const [item, tags] of Object.entries(delta.added)) {
      const added = this.#added[item] || [];
      this.#added[item] = new Set([...added, ...tags]);
    }

    for (const [item, tags] of Object.entries(delta.removed)) {
      const removed = this.#removed[item] || [];
      this.#removed[item] = new Set([...removed, ...tags]);
    }

    return this;
  }

  get value() {
    const result = [];
    for (const item of Object.keys(this.#added)) {
      const addTags = this.#added[item] || new Set();
      const remTags = this.#removed[item] || new Set();
      for (const tag of addTags) {
        if (!remTags.has(tag)) {
          result.push(item);
          break;
        }
      }
    }
    return result;
  }

  get added() {
    return this.#added;
  }

  get removed() {
    return this.#removed;
  }
}

// Usage
console.log('--------------------------------');
console.log('Delta CRDT OR-Set');
console.log('--------------------------------');

console.log('Replica 0');
const set0 = new DeltaORSet();
const delta01 = set0.add('a');
set0.join(delta01);
const delta02 = set0.add('b');
set0.join(delta02);
const delta03 = set0.remove('a');
console.log({ delta03 });
set0.join(delta03);
console.log({ id0: set0.value });
console.log({ id0: set0.added });
console.log({ id0: set0.removed });

console.log('Replica 1');
const set1 = new DeltaORSet();
const delta11 = set1.add('b');
set1.join(delta11);
const delta12 = set1.add('c');
set1.join(delta12);
const delta13 = set1.remove('b');
set1.join(delta13);
const delta14 = set1.add('c');
set1.join(delta14);
const delta15 = set1.remove('b');
set1.join(delta15);
console.log({ id1: set1.value });

console.log('Sync');
set0.join(set1);
set1.join(set0);
console.log({ id0Added: set0.added });
console.log({ id0Removed: set0.removed });
console.log({ id1Added: set1.added });
console.log({ id1Removed: set1.removed });

console.log('Get value');
console.log({ id0: set0.value });
console.log({ id1: set1.value });
