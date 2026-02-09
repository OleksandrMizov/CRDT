'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { Dot } = require('../dot.js');

describe('Dot', () => {
  describe('Construction', () => {
    it('should create dot with id and counter', () => {
      const dot = new Dot('replica1', 5);
      assert.equal(dot.id, 'replica1');
      assert.equal(dot.counter, 5);
    });

    it('should create dot from string "id:counter"', () => {
      const dot = Dot.fromString('a:10');
      assert.equal(dot.id, 'a');
      assert.equal(dot.counter, 10);
    });

    it('should create dot from object literal', () => {
      const obj = { id: 'b', counter: 3 };
      const dot = Dot.toDot(obj);
      assert.ok(dot instanceof Dot);
      assert.equal(dot.id, 'b');
      assert.equal(dot.counter, 3);
    });

    it('should accept Dot instance in toDot', () => {
      const original = new Dot('c', 7);
      const dot = Dot.toDot(original);
      assert.equal(dot, original);
    });

    it('should reject null input', () => {
      assert.throws(() => Dot.toDot(null), {
        name: 'Error',
        message: /Invalid dot input/,
      });
    });

    it('should reject undefined input', () => {
      assert.throws(() => Dot.toDot(undefined), {
        name: 'Error',
        message: /Invalid dot input/,
      });
    });

    it('should reject empty object', () => {
      assert.throws(() => Dot.toDot({}), {
        name: 'Error',
        message: /Invalid dot input/,
      });
    });

    it('should reject invalid string format', () => {
      assert.throws(() => Dot.fromString('invalid'), Error);
    });

    it('should reject string with non-numeric counter', () => {
      assert.throws(() => Dot.fromString('a:b'), {
        name: 'Error',
        message: /Invalid dot format/,
      });
    });
  });

  describe('Comparison', () => {
    it('should compare dots with same id, different counters', () => {
      const dot1 = new Dot('a', 1);
      const dot2 = new Dot('a', 3);
      const result = Dot.compare(dot1, dot2);
      assert.ok(result < 0, 'dot1 should be less than dot2');
    });

    it('should compare dots with different ids', () => {
      const dot1 = new Dot('a', 5);
      const dot2 = new Dot('b', 3);
      const result = Dot.compare(dot1, dot2);
      assert.ok(result < 0, 'a should be less than b lexicographically');
    });

    it('should compare dots with same id and counter (equality)', () => {
      const dot1 = new Dot('a', 5);
      const dot2 = new Dot('a', 5);
      const result = Dot.compare(dot1, dot2);
      assert.equal(result, 0);
    });

    it('should handle reverse comparison', () => {
      const dot1 = new Dot('a', 3);
      const dot2 = new Dot('a', 1);
      const result = Dot.compare(dot1, dot2);
      assert.ok(result > 0, 'dot1 should be greater than dot2');
    });

    it('should compare dots with strings as input', () => {
      const result = Dot.compare('a:1', 'a:3');
      assert.ok(result < 0);
    });

    it('should compare dots with mixed formats', () => {
      const dot1 = new Dot('a', 1);
      const result = Dot.compare(dot1, 'a:3');
      assert.ok(result < 0);
    });

    it('should use lt() method correctly', () => {
      const dot1 = new Dot('a', 1);
      const dot2 = new Dot('a', 3);
      assert.equal(dot1.lt(dot2), true);
      assert.equal(dot2.lt(dot1), false);
    });

    it('should use lte() method correctly', () => {
      const dot1 = new Dot('a', 1);
      const dot2 = new Dot('a', 3);
      const dot3 = new Dot('a', 1);
      assert.equal(dot1.lte(dot2), true);
      assert.equal(dot1.lte(dot3), true);
      assert.equal(dot2.lte(dot1), false);
    });

    it('should use gt() method correctly', () => {
      const dot1 = new Dot('a', 3);
      const dot2 = new Dot('a', 1);
      assert.equal(dot1.gt(dot2), true);
      assert.equal(dot2.gt(dot1), false);
    });

    it('should use gte() method correctly', () => {
      const dot1 = new Dot('a', 3);
      const dot2 = new Dot('a', 1);
      const dot3 = new Dot('a', 3);
      assert.equal(dot1.gte(dot2), true);
      assert.equal(dot1.gte(dot3), true);
      assert.equal(dot2.gte(dot1), false);
    });
  });

  describe('Serialization', () => {
    it('should convert dot to string format', () => {
      const dot = new Dot('replica1', 42);
      assert.equal(dot.toString(), 'replica1:42');
    });

    it('should parse string back to dot', () => {
      const dot = Dot.fromString('x:100');
      assert.equal(dot.id, 'x');
      assert.equal(dot.counter, 100);
    });

    it('should support round-trip conversion', () => {
      const original = new Dot('test', 99);
      const dotStr = original.toString();
      const restored = Dot.fromString(dotStr);
      assert.equal(restored.id, original.id);
      assert.equal(restored.counter, original.counter);
    });

    it('should use static toString with Dot instance', () => {
      const dot = new Dot('a', 5);
      assert.equal(Dot.toString(dot), 'a:5');
    });

    it('should use static toString with string', () => {
      assert.equal(Dot.toString('b:10'), 'b:10');
    });

    it('should use static toString with object literal', () => {
      assert.equal(Dot.toString({ id: 'c', counter: 15 }), 'c:15');
    });
  });

  describe('isDotLikeObject', () => {
    it('should return true for valid dot-like object', () => {
      assert.equal(Dot.isDotLikeObject({ id: 'a', counter: 1 }), true);
    });

    it('should return false for object without id', () => {
      assert.equal(Dot.isDotLikeObject({ counter: 1 }), false);
    });

    it('should return false for object without counter', () => {
      assert.equal(Dot.isDotLikeObject({ id: 'a' }), false);
    });

    it('should return false for non-object', () => {
      assert.equal(Dot.isDotLikeObject('a:1'), false);
      assert.equal(Dot.isDotLikeObject(null), false);
      assert.equal(Dot.isDotLikeObject(undefined), false);
    });

    it('should return true for Dot instance', () => {
      const dot = new Dot('a', 1);
      assert.equal(Dot.isDotLikeObject(dot), true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle dots with special characters in id', () => {
      const dot = new Dot('replica-1_test', 5);
      assert.equal(dot.toString(), 'replica-1_test:5');
      const restored = Dot.fromString(dot.toString());
      assert.equal(restored.id, 'replica-1_test');
    });

    it('should handle large counter values', () => {
      const largeCounter = Number.MAX_SAFE_INTEGER - 1;
      const dot = new Dot('a', largeCounter);
      assert.equal(dot.counter, largeCounter);
    });

    it('should handle zero counter', () => {
      const dot = new Dot('a', 0);
      assert.equal(dot.counter, 0);
      assert.equal(dot.toString(), 'a:0');
    });

    it('should compare dots with same id prefix', () => {
      const dot1 = new Dot('replica', 1);
      const dot2 = new Dot('replica1', 1);
      const result = Dot.compare(dot1, dot2);
      assert.ok(result < 0, 'replica should be less than replica1');
    });
  });
});
