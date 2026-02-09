'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { DotContext } = require('../dot-context.js');
const { Dot } = require('../dot.js');

// Helper function to create test context
function createContext(cc, dc) {
  const ctx = new DotContext();
  for (const [id, counter] of Object.entries(cc)) {
    ctx.compactCausalContext.set(id, counter);
  }
  for (const dotStr of dc) {
    ctx.dotCloud.add(dotStr);
  }
  return ctx;
}

describe('DotContext', () => {
  describe('dotIn()', () => {
    it('should return true for dot in Compact Causal Context', () => {
      const ctx = createContext({ a: 5 }, []);
      assert.equal(ctx.dotIn({ id: 'a', counter: 3 }), true);
    });

    it('should return true for dot at CC boundary', () => {
      const ctx = createContext({ a: 5 }, []);
      assert.equal(ctx.dotIn({ id: 'a', counter: 5 }), true);
    });

    it('should return true for dot in Dot Cloud', () => {
      const ctx = createContext({ a: 5 }, ['a:7']);
      assert.equal(ctx.dotIn({ id: 'a', counter: 7 }), true);
    });

    it('should return false for unknown dot (gap)', () => {
      const ctx = createContext({ a: 5 }, ['a:7']);
      assert.equal(ctx.dotIn({ id: 'a', counter: 6 }), false);
    });

    it('should return false for unknown replica', () => {
      const ctx = createContext({ a: 5 }, []);
      assert.equal(ctx.dotIn({ id: 'b', counter: 1 }), false);
    });

    it('should accept dot as string', () => {
      const ctx = createContext({ a: 5 }, []);
      assert.equal(ctx.dotIn('a:3'), true);
    });

    it('should accept dot as Dot instance', () => {
      const ctx = createContext({ a: 5 }, []);
      const dot = new Dot('a', 3);
      assert.equal(ctx.dotIn(dot), true);
    });

    it('should return false for counter beyond CC', () => {
      const ctx = createContext({ a: 5 }, []);
      assert.equal(ctx.dotIn({ id: 'a', counter: 6 }), false);
    });
  });

  describe('makeDot()', () => {
    it('should create first dot (id, 1) for new replica', () => {
      const ctx = new DotContext();
      const dot = ctx.makeDot('a');
      assert.equal(dot.id, 'a');
      assert.equal(dot.counter, 1);
      assert.equal(ctx.compactCausalContext.get('a'), 1);
    });

    it('should increment counter for existing replica', () => {
      const ctx = createContext({ a: 3 }, []);
      const dot = ctx.makeDot('a');
      assert.equal(dot.id, 'a');
      assert.equal(dot.counter, 4);
      assert.equal(ctx.compactCausalContext.get('a'), 4);
    });

    it('should produce sequential counters for multiple calls', () => {
      const ctx = new DotContext();
      const dot1 = ctx.makeDot('a');
      const dot2 = ctx.makeDot('a');
      const dot3 = ctx.makeDot('a');
      assert.equal(dot1.counter, 1);
      assert.equal(dot2.counter, 2);
      assert.equal(dot3.counter, 3);
    });

    it('should maintain independent counters per replica', () => {
      const ctx = new DotContext();
      const dotA1 = ctx.makeDot('a');
      const dotB1 = ctx.makeDot('b');
      const dotA2 = ctx.makeDot('a');
      assert.equal(dotA1.counter, 1);
      assert.equal(dotB1.counter, 1);
      assert.equal(dotA2.counter, 2);
    });
  });

  describe('insertDot()', () => {
    it('should add dot to Dot Cloud', () => {
      const ctx = new DotContext();
      ctx.insertDot({ id: 'a', counter: 5 }, false);
      assert.ok(ctx.dotCloud.has('a:5'));
    });

    it('should trigger compaction by default', () => {
      const ctx = createContext({ a: 3 }, []);
      ctx.insertDot({ id: 'a', counter: 4 });
      assert.equal(ctx.dotCloud.size, 0);
      assert.equal(ctx.compactCausalContext.get('a'), 4);
    });

    it('should skip compaction when compactNow=false', () => {
      const ctx = createContext({ a: 3 }, []);
      ctx.insertDot({ id: 'a', counter: 4 }, false);
      assert.ok(ctx.dotCloud.has('a:4'));
      assert.equal(ctx.compactCausalContext.get('a'), 3);
    });

    it('should accept dot as string', () => {
      const ctx = new DotContext();
      ctx.insertDot('a:5', false);
      assert.ok(ctx.dotCloud.has('a:5'));
    });

    it('should accept dot as Dot instance', () => {
      const ctx = new DotContext();
      const dot = new Dot('a', 5);
      ctx.insertDot(dot, false);
      assert.ok(ctx.dotCloud.has('a:5'));
    });
  });

  describe('compact()', () => {
    it('should compact single contiguous dot at counter=1', () => {
      const ctx = createContext({}, ['a:1']);
      ctx.compact();
      assert.equal(ctx.dotCloud.size, 0);
      assert.equal(ctx.compactCausalContext.get('a'), 1);
    });

    it('should compact contiguous sequence', () => {
      const ctx = createContext({ a: 3 }, ['a:4']);
      ctx.compact();
      assert.equal(ctx.dotCloud.size, 0);
      assert.equal(ctx.compactCausalContext.get('a'), 4);
    });

    it('should remove dominated dots', () => {
      const ctx = createContext({ a: 5 }, ['a:3']);
      ctx.compact();
      assert.equal(ctx.dotCloud.size, 0);
      assert.equal(ctx.compactCausalContext.get('a'), 5);
    });

    it('should keep non-contiguous dots', () => {
      const ctx = createContext({ a: 3 }, ['a:5']);
      ctx.compact();
      assert.ok(ctx.dotCloud.has('a:5'));
      assert.equal(ctx.compactCausalContext.get('a'), 3);
    });

    it('should compact multiple times for best order', () => {
      const ctx = createContext({}, []);
      ctx.insertDot({ id: 'a', counter: 2 }, false);
      ctx.insertDot({ id: 'a', counter: 1 }, false);
      ctx.compact();
      assert.equal(ctx.dotCloud.size, 0);
      assert.equal(ctx.compactCausalContext.get('a'), 2);
    });

    it('should compact multiple replicas independently', () => {
      const ctx = createContext({ c: 1 }, ['a:1', 'b:1', 'c:2']);
      ctx.compact();
      assert.equal(ctx.dotCloud.size, 0);
      assert.equal(ctx.compactCausalContext.get('a'), 1);
      assert.equal(ctx.compactCausalContext.get('b'), 1);
      assert.equal(ctx.compactCausalContext.get('c'), 2);
    });

    it('should handle complex compaction scenario', () => {
      const ctx = createContext({ a: 1 }, ['a:2', 'a:3', 'b:1']);
      ctx.compact();
      assert.equal(ctx.dotCloud.size, 0);
      assert.equal(ctx.compactCausalContext.get('a'), 3);
      assert.equal(ctx.compactCausalContext.get('b'), 1);
    });

    it('should compact sequential dots', () => {
      const ctx = createContext({}, ['a:1', 'a:2', 'a:3']);
      ctx.compact();
      assert.equal(ctx.dotCloud.size, 0);
      assert.equal(ctx.compactCausalContext.get('a'), 3);
    });

    it('should not compact dots with gaps', () => {
      const ctx = createContext({}, ['a:1', 'a:3']);
      ctx.compact();
      assert.equal(ctx.dotCloud.size, 1);
      assert.ok(ctx.dotCloud.has('a:3'));
      assert.equal(ctx.compactCausalContext.get('a'), 1);
    });
  });

  describe('join()', () => {
    it('should join empty contexts', () => {
      const ctx1 = new DotContext();
      const ctx2 = new DotContext();
      ctx1.join(ctx2);
      assert.equal(ctx1.compactCausalContext.size, 0);
      assert.equal(ctx1.dotCloud.size, 0);
    });

    it('should join Compact Causal Contexts with max', () => {
      const ctx1 = createContext({ a: 3 }, []);
      const ctx2 = createContext({ a: 5 }, []);
      ctx1.join(ctx2);
      assert.equal(ctx1.compactCausalContext.get('a'), 5);
    });

    it('should merge disjoint CC entries', () => {
      const ctx1 = createContext({ a: 3 }, []);
      const ctx2 = createContext({ b: 4 }, []);
      ctx1.join(ctx2);
      assert.equal(ctx1.compactCausalContext.get('a'), 3);
      assert.equal(ctx1.compactCausalContext.get('b'), 4);
    });

    it('should union Dot Clouds', () => {
      const ctx1 = createContext({}, ['a:5']);
      const ctx2 = createContext({}, ['b:7']);
      ctx1.join(ctx2);
      assert.ok(ctx1.dotCloud.has('a:5'));
      assert.ok(ctx1.dotCloud.has('b:7'));
    });

    it('should compact after join', () => {
      const ctx1 = createContext({ a: 3 }, []);
      const ctx2 = createContext({}, ['a:4']);
      ctx1.join(ctx2);
      assert.equal(ctx1.compactCausalContext.get('a'), 4);
      assert.equal(ctx1.dotCloud.size, 0);
    });

    it('should be idempotent', () => {
      const ctx1 = createContext({ a: 5 }, ['b:3']);
      const ctx2 = createContext({ a: 5 }, ['b:3']);
      const before = ctx1.clone();
      ctx1.join(ctx2);
      ctx1.join(ctx2);
      assert.deepEqual(
        Array.from(ctx1.compactCausalContext),
        Array.from(before.compactCausalContext)
      );
    });

    it('should be commutative', () => {
      const ctx1 = createContext({ a: 3 }, []);
      const ctx2 = createContext({ a: 5 }, []);
      const ctxA = ctx1.clone();
      const ctxB = ctx2.clone();
      ctxA.join(ctxB);
      ctxB.join(ctx1);
      assert.equal(ctxA.compactCausalContext.get('a'), 5);
      assert.equal(ctxB.compactCausalContext.get('a'), 5);
    });

    it('should be associative', () => {
      const ctx1 = createContext({ a: 2 }, []);
      const ctx2 = createContext({ a: 5 }, ['b:1']);
      const ctx3 = createContext({ b: 3 }, ['c:1']);

      const result1 = ctx1.clone();
      result1.join(ctx2);
      result1.join(ctx3);

      const temp = ctx2.clone();
      temp.join(ctx3);
      const result2 = ctx1.clone();
      result2.join(temp);

      assert.equal(
        result1.compactCausalContext.get('a'),
        result2.compactCausalContext.get('a')
      );
      assert.equal(
        result1.compactCausalContext.get('b'),
        result2.compactCausalContext.get('b')
      );
    });

    it('should handle self-join gracefully', () => {
      const ctx = createContext({ a: 5 }, ['b:3']);
      const before = ctx.clone();
      ctx.join(ctx);
      assert.deepEqual(
        Array.from(ctx.compactCausalContext),
        Array.from(before.compactCausalContext)
      );
    });

    it('should join with gaps and compact correctly', () => {
      const ctx1 = createContext({ a: 2 }, ['a:5']);
      const ctx2 = createContext({ a: 3 }, ['a:4']);
      ctx1.join(ctx2);
      assert.equal(ctx1.compactCausalContext.get('a'), 5);
      assert.equal(ctx1.dotCloud.size, 0);
    });
  });

  describe('toString()', () => {
    it('should show empty context', () => {
      const ctx = new DotContext();
      const str = ctx.toString();
      assert.equal(str, 'Context: CC () DC ()');
    });

    it('should show CC entries', () => {
      const ctx = createContext({ a: 5, b: 3 }, []);
      const str = ctx.toString();
      assert.ok(str.includes('a:5'));
      assert.ok(str.includes('b:3'));
    });

    it('should show DC entries', () => {
      const ctx = createContext({}, ['a:7', 'c:2']);
      const str = ctx.toString();
      assert.ok(str.includes('a:7'));
      assert.ok(str.includes('c:2'));
    });

    it('should show both CC and DC', () => {
      const ctx = createContext({ a: 3 }, ['a:7']);
      const str = ctx.toString();
      assert.ok(str.includes('a:3'));
      assert.ok(str.includes('a:7'));
    });
  });

  describe('clone()', () => {
    it('should create independent copy', () => {
      const ctx = createContext({ a: 5 }, ['b:3']);
      const copy = ctx.clone();

      copy.compactCausalContext.set('a', 10);
      copy.dotCloud.add('c:1');

      assert.equal(ctx.compactCausalContext.get('a'), 5);
      assert.equal(copy.compactCausalContext.get('a'), 10);
      assert.ok(!ctx.dotCloud.has('c:1'));
      assert.ok(copy.dotCloud.has('c:1'));
    });

    it('should clone empty context', () => {
      const ctx = new DotContext();
      const copy = ctx.clone();
      assert.equal(copy.compactCausalContext.size, 0);
      assert.equal(copy.dotCloud.size, 0);
    });

    it('should clone complex context', () => {
      const ctx = createContext({ a: 5, b: 3, c: 10 }, ['d:1', 'e:7', 'f:3']);
      const copy = ctx.clone();
      assert.equal(copy.compactCausalContext.size, 3);
      assert.equal(copy.dotCloud.size, 3);
      assert.equal(copy.compactCausalContext.get('a'), 5);
      assert.ok(copy.dotCloud.has('d:1'));
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty Dot Cloud', () => {
      const ctx = new DotContext();
      ctx.compact();
      assert.equal(ctx.dotCloud.size, 0);
    });

    it('should handle empty Compact Causal Context', () => {
      const ctx = createContext({}, ['a:5']);
      assert.equal(ctx.dotIn({ id: 'a', counter: 5 }), true);
      assert.equal(ctx.dotIn({ id: 'a', counter: 1 }), false);
    });

    it('should handle large counter values', () => {
      const largeCounter = 1000000;
      const ctx = createContext({ a: largeCounter }, []);
      assert.equal(ctx.dotIn({ id: 'a', counter: largeCounter }), true);
    });

    it('should handle many replicas', () => {
      const ctx = new DotContext();
      for (let i = 0; i < 100; i++) {
        ctx.makeDot(`replica${i}`);
      }
      assert.equal(ctx.compactCausalContext.size, 100);
    });

    it('should handle rapid sequential operations', () => {
      const ctx = new DotContext();
      for (let i = 0; i < 1000; i++) {
        ctx.makeDot('a');
      }
      assert.equal(ctx.compactCausalContext.get('a'), 1000);
    });
  });
});
