'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { DotKernel } = require('../dot-kernel.js');
const { DotContext } = require('../dot-context.js');
const { Dot } = require('../dot.js');

// Helper function to create test kernel
function createKernel(data, context = null) {
  const kernel = new DotKernel(context);
  for (const [dotStr, value] of Object.entries(data)) {
    kernel.dataStorage.set(dotStr, value);
    kernel.sharedContext.insertDot(dotStr);
  }
  return kernel;
}

describe('DotKernel', () => {
  describe('Constructor & Context Management', () => {
    it('should create kernel with own base context', () => {
      const kernel = new DotKernel();
      assert.ok(kernel.sharedContext === kernel.contextBase);
      assert.ok(kernel.sharedContext instanceof DotContext);
    });

    it('should create kernel with shared context', () => {
      const externalCtx = new DotContext();
      const kernel = new DotKernel(externalCtx);
      assert.ok(kernel.sharedContext === externalCtx);
      assert.ok(kernel.contextBase !== externalCtx);
    });

    it('should allow multiple kernels to share same context', () => {
      const sharedCtx = new DotContext();
      const kernel1 = new DotKernel(sharedCtx);
      const kernel2 = new DotKernel(sharedCtx);

      kernel1.add('a', 'value1');

      assert.ok(kernel1.sharedContext === kernel2.sharedContext);
      assert.equal(sharedCtx.compactCausalContext.get('a'), 1);
    });

    it('should initialize with empty data storage', () => {
      const kernel = new DotKernel();
      assert.equal(kernel.dataStorage.size, 0);
    });
  });

  describe('add()', () => {
    it('should add value with new dot', () => {
      const kernel = new DotKernel();
      kernel.add('replicaA', 'value1');
      assert.ok(kernel.dataStorage.has('replicaA:1'));
      assert.equal(kernel.dataStorage.get('replicaA:1'), 'value1');
    });

    it('should return delta kernel with just the added dot', () => {
      const kernel = new DotKernel();
      const delta = kernel.add('a', 'val');
      assert.equal(delta.dataStorage.size, 1);
      assert.ok(delta.dataStorage.has('a:1'));
      assert.equal(delta.dataStorage.get('a:1'), 'val');
      assert.equal(delta.sharedContext.dotIn({ id: 'a', counter: 1 }), true);
    });

    it('should increment counter for same replica', () => {
      const kernel = new DotKernel();
      kernel.add('a', 'v1');
      kernel.add('a', 'v2');
      assert.ok(kernel.dataStorage.has('a:1'));
      assert.ok(kernel.dataStorage.has('a:2'));
      assert.equal(kernel.dataStorage.get('a:1'), 'v1');
      assert.equal(kernel.dataStorage.get('a:2'), 'v2');
    });

    it('should update shared context', () => {
      const sharedCtx = new DotContext();
      const kernel = new DotKernel(sharedCtx);
      kernel.add('a', 'val');
      assert.equal(sharedCtx.compactCausalContext.get('a'), 1);
    });

    it('should handle multiple replicas independently', () => {
      const kernel = new DotKernel();
      kernel.add('a', 'x');
      kernel.add('b', 'y');
      kernel.add('a', 'z');
      assert.equal(kernel.dataStorage.get('a:1'), 'x');
      assert.equal(kernel.dataStorage.get('b:1'), 'y');
      assert.equal(kernel.dataStorage.get('a:2'), 'z');
    });

    it('should add complex values', () => {
      const kernel = new DotKernel();
      const obj = { key: 'value', nested: { data: 123 } };
      kernel.add('a', obj);
      assert.deepEqual(kernel.dataStorage.get('a:1'), obj);
    });

    it('should add null values', () => {
      const kernel = new DotKernel();
      kernel.add('a', null);
      assert.equal(kernel.dataStorage.get('a:1'), null);
    });
  });

  describe('dotAdd()', () => {
    it('should add value and return dot', () => {
      const kernel = new DotKernel();
      const dot = kernel.dotAdd('a', 'val');
      assert.ok(dot instanceof Dot);
      assert.equal(dot.id, 'a');
      assert.equal(dot.counter, 1);
      assert.equal(kernel.dataStorage.get('a:1'), 'val');
    });

    it('should not return delta kernel', () => {
      const kernel = new DotKernel();
      const result = kernel.dotAdd('a', 'val');
      assert.ok(!(result instanceof DotKernel));
      assert.ok(result instanceof Dot);
    });

    it('should increment counter like add()', () => {
      const kernel = new DotKernel();
      const dot1 = kernel.dotAdd('a', 'v1');
      const dot2 = kernel.dotAdd('a', 'v2');
      assert.equal(dot1.counter, 1);
      assert.equal(dot2.counter, 2);
    });
  });

  describe('rmv()', () => {
    describe('Remove by value', () => {
      it('should remove all matching dots', () => {
        const kernel = createKernel({
          'a:1': 'x',
          'b:1': 'x',
          'c:1': 'y',
        });
        kernel.rmv('x');
        assert.ok(!kernel.dataStorage.has('a:1'));
        assert.ok(!kernel.dataStorage.has('b:1'));
        assert.ok(kernel.dataStorage.has('c:1'));
      });

      it('should return delta with removed dots in context', () => {
        const kernel = createKernel({ 'a:1': 'x' });
        const delta = kernel.rmv('x');
        assert.equal(delta.sharedContext.dotIn({ id: 'a', counter: 1 }), true);
        assert.equal(delta.dataStorage.size, 0);
      });

      it('should not remove if value not found', () => {
        const kernel = createKernel({ 'a:1': 'x' });
        const delta = kernel.rmv('y');
        assert.ok(kernel.dataStorage.has('a:1'));
        assert.equal(delta.dataStorage.size, 0);
      });

      it('should handle complex value comparison', () => {
        const obj = { key: 'value' };
        const kernel = createKernel({ 'a:1': obj });
        kernel.rmv({ key: 'value' });
        assert.ok(!kernel.dataStorage.has('a:1'));
      });
    });

    describe('Remove by dot', () => {
      it('should remove specific dot', () => {
        const kernel = createKernel({ 'a:1': 'x', 'a:2': 'y' });
        kernel.rmv({ id: 'a', counter: 1 });
        assert.ok(!kernel.dataStorage.has('a:1'));
        assert.ok(kernel.dataStorage.has('a:2'));
      });

      it('should handle not found gracefully', () => {
        const kernel = createKernel({ 'a:1': 'x' });
        const delta = kernel.rmv({ id: 'b', counter: 1 });
        assert.ok(kernel.dataStorage.has('a:1'));
        assert.equal(delta.dataStorage.size, 0);
      });

      it('should remove by dot-like object with string keys', () => {
        const kernel = createKernel({ 'a:1': 'x', 'a:2': 'y' });
        kernel.rmv({ id: 'a', counter: 1 });
        assert.ok(!kernel.dataStorage.has('a:1'));
        assert.ok(kernel.dataStorage.has('a:2'));
      });

      it('should accept Dot instance', () => {
        const kernel = createKernel({ 'a:1': 'x', 'a:2': 'y' });
        const dot = new Dot('a', 1);
        kernel.rmv(dot);
        assert.ok(!kernel.dataStorage.has('a:1'));
        assert.ok(kernel.dataStorage.has('a:2'));
      });
    });

    describe('Remove all', () => {
      it('should remove all dots', () => {
        const kernel = createKernel({ 'a:1': 'x', 'b:1': 'y', 'a:2': 'z' });
        kernel.rmv();
        assert.equal(kernel.dataStorage.size, 0);
      });

      it('should remember all removed dots in delta', () => {
        const kernel = createKernel({ 'a:1': 'x', 'b:1': 'y' });
        const delta = kernel.rmv();
        assert.equal(delta.sharedContext.dotIn({ id: 'a', counter: 1 }), true);
        assert.equal(delta.sharedContext.dotIn({ id: 'b', counter: 1 }), true);
      });

      it('should handle empty kernel', () => {
        const kernel = new DotKernel();
        const delta = kernel.rmv();
        assert.equal(kernel.dataStorage.size, 0);
        assert.equal(delta.dataStorage.size, 0);
      });
    });
  });

  describe('join()', () => {
    it('should merge disjoint dot sets', () => {
      const k1 = createKernel({ 'a:1': 'x' });
      const k2 = createKernel({ 'b:1': 'y' });
      k1.join(k2);
      assert.ok(k1.dataStorage.has('a:1'));
      assert.ok(k1.dataStorage.has('b:1'));
      assert.equal(k1.dataStorage.get('a:1'), 'x');
      assert.equal(k1.dataStorage.get('b:1'), 'y');
    });

    it('should keep dots present in both kernels', () => {
      const k1 = createKernel({ 'a:1': 'x' });
      const k2 = createKernel({ 'a:1': 'x' });
      k1.join(k2);
      assert.ok(k1.dataStorage.has('a:1'));
      assert.equal(k1.dataStorage.size, 1);
    });

    it('should remove dots known by other context (observed remove)', () => {
      const k1 = createKernel({ 'a:1': 'x' });
      const k2 = new DotKernel();
      k2.sharedContext.insertDot({ id: 'a', counter: 1 });
      k1.join(k2);
      assert.ok(!k1.dataStorage.has('a:1'));
    });

    it('should add dots from other not in this context', () => {
      const k1 = new DotKernel();
      const k2 = createKernel({ 'b:5': 'new' });
      k1.join(k2);
      assert.ok(k1.dataStorage.has('b:5'));
      assert.equal(k1.dataStorage.get('b:5'), 'new');
    });

    it('should not import dots this context already knows', () => {
      const k1 = new DotKernel();
      k1.sharedContext.insertDot({ id: 'a', counter: 3 });
      const k2 = createKernel({ 'a:3': 'x' });
      k1.join(k2);
      assert.ok(!k1.dataStorage.has('a:3'));
    });

    it('should join contexts', () => {
      const k1 = new DotKernel();
      k1.sharedContext.compactCausalContext.set('a', 3);
      const k2 = new DotKernel();
      k2.sharedContext.compactCausalContext.set('a', 5);
      k1.join(k2);
      assert.equal(k1.sharedContext.compactCausalContext.get('a'), 5);
    });

    it('should be idempotent', () => {
      const k1 = createKernel({ 'a:1': 'x' });
      const k2 = createKernel({ 'b:1': 'y' });
      k1.join(k2);
      const size1 = k1.dataStorage.size;
      k1.join(k2);
      const size2 = k1.dataStorage.size;
      assert.equal(size1, size2);
    });

    it('should handle self-join gracefully', () => {
      const k1 = createKernel({ 'a:1': 'x' });
      const before = k1.dataStorage.size;
      k1.join(k1);
      assert.equal(k1.dataStorage.size, before);
    });

    it('should use sorted iteration', () => {
      const k1 = createKernel({ 'b:1': 'y', 'a:1': 'x' });
      const k2 = createKernel({ 'c:1': 'z' });
      k1.join(k2);
      assert.equal(k1.dataStorage.size, 3);
    });

    it('should handle complex concurrent scenario', () => {
      const k1 = new DotKernel();
      k1.add('a', 'v1');
      k1.add('a', 'v2');

      const k2 = new DotKernel();
      k2.add('a', 'v3');

      k1.join(k2);

      // k1 has (a:1) and (a:2) with CC[a]=2
      // k2 has (a:1) with CC[a]=1
      // When joining, k2's (a:1) is already known by k1's context
      assert.ok(k1.dataStorage.has('a:1'));
      assert.ok(k1.dataStorage.has('a:2'));
      // k2's (a:1) is not imported because k1 already knows about (a:1)
      assert.equal(k1.dataStorage.size, 2);
    });

    it('should handle complex concurrent scenarios with deltas', () => {
      const k1 = createKernel({ 'a:1': 'x' });
      const k2 = createKernel({ 'a:1': 'y' });
      const delta1 = k1.add('a', 'v1');
      const delta2 = k1.add('a', 'v2');
      k2.join(delta1);
      k2.join(delta2);

      assert.equal(k2.dataStorage.size, 3);
      assert.equal(k2.dataStorage.get('a:1'), 'y');
      assert.equal(k2.dataStorage.get('a:2'), 'v1');
      assert.equal(k2.dataStorage.get('a:3'), 'v2');
    });
  });

  describe('deepJoin()', () => {
    it('should merge values for dots in both kernels', () => {
      const k1 = createKernel({ 'a:1': 5 });
      const k2 = createKernel({ 'a:1': 3 });
      k1.deepJoin(k2);
      assert.ok(k1.dataStorage.has('a:1'));
      assert.equal(k1.dataStorage.get('a:1'), 5);
    });

    it('should only join when values differ', () => {
      const k1 = createKernel({ 'a:1': 'x' });
      const k2 = createKernel({ 'a:1': 'x' });
      k1.deepJoin(k2);
      assert.equal(k1.dataStorage.get('a:1'), 'x');
    });

    it('should behave like join() for non-overlapping dots', () => {
      const k1 = createKernel({ 'a:1': 'x' });
      const k2 = createKernel({ 'b:1': 'y' });
      k1.deepJoin(k2);
      assert.ok(k1.dataStorage.has('a:1'));
      assert.ok(k1.dataStorage.has('b:1'));
    });

    it('should handle nested CRDTs with join method', () => {
      const crdt1 = {
        value: 5,
        join(other) {
          this.value = Math.max(this.value, other.value);
        },
      };
      const crdt2 = {
        value: 8,
        join(other) {
          this.value = Math.max(this.value, other.value);
        },
      };
      const k1 = createKernel({ 'a:1': crdt1 });
      const k2 = createKernel({ 'a:1': crdt2 });
      k1.deepJoin(k2);
      assert.ok(k1.dataStorage.has('a:1'));
    });

    // eslint-disable-next-line max-len
    it('should remove dots known by other context, and removed in other', () => {
      const k1 = createKernel({ 'a:1': 'x' });
      const k2 = new DotKernel();
      k2.sharedContext.insertDot({ id: 'a', counter: 1 });
      k1.deepJoin(k2);
      assert.ok(!k1.dataStorage.has('a:1'));
    });

    it('should not import dots this context already knows', () => {
      const k1 = new DotKernel();
      k1.sharedContext.insertDot({ id: 'a', counter: 3 });
      const k2 = createKernel({ 'a:3': 'x' });
      k1.deepJoin(k2);
      assert.ok(!k1.dataStorage.has('a:3'));
    });

    it('should handle self-deepJoin gracefully', () => {
      const k1 = createKernel({ 'a:1': 'x' });
      const before = k1.dataStorage.size;
      k1.deepJoin(k1);
      assert.equal(k1.dataStorage.size, before);
    });
  });

  describe('clone()', () => {
    it('should create independent copy', () => {
      const kernel = createKernel({ 'a:1': 'x' });
      const copy = kernel.clone();

      copy.dataStorage.set('b:1', 'y');

      assert.ok(!kernel.dataStorage.has('b:1'));
      assert.ok(copy.dataStorage.has('b:1'));
    });

    it('should clone with local context', () => {
      const kernel = new DotKernel();
      kernel.add('a', 'x');
      const copy = kernel.clone();

      assert.ok(copy.sharedContext !== kernel.sharedContext);
      assert.equal(
        copy.sharedContext.compactCausalContext.get('a'),
        kernel.sharedContext.compactCausalContext.get('a'),
      );
    });

    it('should preserve shared context reference', () => {
      const sharedCtx = new DotContext();
      const kernel = new DotKernel(sharedCtx);
      kernel.add('a', 'x');
      const copy = kernel.clone();

      assert.ok(copy.sharedContext === kernel.sharedContext);
      assert.ok(copy.sharedContext === sharedCtx);
    });

    it('should clone empty kernel', () => {
      const kernel = new DotKernel();
      const copy = kernel.clone();
      assert.equal(copy.dataStorage.size, 0);
    });
  });

  describe('toString()', () => {
    it('should show kernel state', () => {
      const kernel = createKernel({ 'a:1': 'x' });
      const str = kernel.toString();
      assert.ok(str.includes('Kernel'));
      assert.ok(str.includes('a:1'));
      assert.ok(str.includes('x'));
    });

    it('should show empty kernel', () => {
      const kernel = new DotKernel();
      const str = kernel.toString();
      assert.ok(str.includes('Kernel'));
    });

    it('should show context information', () => {
      const kernel = new DotKernel();
      kernel.add('a', 'x');
      const str = kernel.toString();
      assert.ok(str.includes('Context'));
    });
  });
});
