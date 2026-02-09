'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const MVReg = require('../3-mv-register.js');

describe('MVReg - Multi-Value Register', () => {
  describe('Single Node Operations', () => {
    it('should write and read a value', () => {
      const reg = new MVReg('node1');
      reg.write('value1');
      const values = reg.read();
      assert.equal(values.size, 1);
      assert.ok(values.has('value1'));
    });

    it('should overwrite previous value on sequential writes', () => {
      const reg = new MVReg('node1');
      reg.write('value1');
      reg.write('value2');
      const values = reg.read();
      assert.equal(values.size, 1);
      assert.ok(values.has('value2'));
      assert.ok(!values.has('value1'));
    });

    it('should return empty set after reset', () => {
      const reg = new MVReg('node1');
      reg.write('value1');
      reg.reset();
      const values = reg.read();
      assert.equal(values.size, 0);
    });

    it('should handle multiple sequential writes', () => {
      const reg = new MVReg('node1');
      reg.write('v1');
      reg.write('v2');
      reg.write('v3');
      const values = reg.read();
      assert.equal(values.size, 1);
      assert.ok(values.has('v3'));
    });
  });

  describe('Two-Node Concurrent Writes', () => {
    it('should create siblings on concurrent writes', () => {
      const node1 = new MVReg('node1');
      const node2 = new MVReg('node2');

      const delta1 = node1.write('valueA');
      const delta2 = node2.write('valueB');

      node1.join(delta2);
      node2.join(delta1);

      const values1 = node1.read();
      const values2 = node2.read();

      assert.equal(values1.size, 2);
      assert.equal(values2.size, 2);
      assert.ok(values1.has('valueA'));
      assert.ok(values1.has('valueB'));
      assert.ok(values2.has('valueA'));
      assert.ok(values2.has('valueB'));
    });

    it('should converge after exchanging deltas', () => {
      const node1 = new MVReg('node1');
      const node2 = new MVReg('node2');

      const delta1 = node1.write('A');
      node2.join(delta1);

      const delta2 = node2.write('B');
      node1.join(delta2);

      const values1 = node1.read();
      const values2 = node2.read();

      assert.equal(values1.size, 1);
      assert.equal(values2.size, 1);
      assert.ok(values1.has('B'));
      assert.ok(values2.has('B'));
    });

    it('should handle write followed by concurrent writes', () => {
      const node1 = new MVReg('node1');
      const node2 = new MVReg('node2');

      const deltaInit = node1.write('initial');
      node2.join(deltaInit);

      const delta1 = node1.write('A');
      const delta2 = node2.write('B');

      node1.join(delta2);
      node2.join(delta1);

      const values1 = node1.read();
      const values2 = node2.read();

      assert.equal(values1.size, 2);
      assert.equal(values2.size, 2);
      assert.ok(values1.has('A'));
      assert.ok(values1.has('B'));
    });

    it('should resolve concurrent writes deterministically', () => {
      const node1 = new MVReg('node1');
      const node2 = new MVReg('node2');

      const delta1 = node1.write('X');
      const delta2 = node2.write('Y');

      node1.join(delta2);
      node2.join(delta1);

      const values1 = Array.from(node1.read()).sort();
      const values2 = Array.from(node2.read()).sort();

      assert.deepEqual(values1, values2);
    });
  });

  describe('Three-Node Scenarios', () => {
    it('should converge with three concurrent writes', () => {
      const node1 = new MVReg('node1');
      const node2 = new MVReg('node2');
      const node3 = new MVReg('node3');

      const delta1 = node1.write('A');
      const delta2 = node2.write('B');
      const delta3 = node3.write('C');

      node1.join(delta2);
      node1.join(delta3);
      node2.join(delta1);
      node2.join(delta3);
      node3.join(delta1);
      node3.join(delta2);

      const values1 = node1.read();
      const values2 = node2.read();
      const values3 = node3.read();

      assert.equal(values1.size, 3);
      assert.equal(values2.size, 3);
      assert.equal(values3.size, 3);

      const expected = new Set(['A', 'B', 'C']);
      assert.deepEqual(values1, expected);
      assert.deepEqual(values2, expected);
      assert.deepEqual(values3, expected);
    });

    it('should handle sequential synchronization pattern', () => {
      const node1 = new MVReg('node1');
      const node2 = new MVReg('node2');
      const node3 = new MVReg('node3');

      const delta1 = node1.write('initial');
      node2.join(delta1);
      node3.join(delta1);

      const delta2 = node2.write('update1');
      node1.join(delta2);
      node3.join(delta2);

      const delta3 = node3.write('update2');
      node1.join(delta3);
      node2.join(delta3);

      const values1 = node1.read();
      const values2 = node2.read();
      const values3 = node3.read();

      assert.equal(values1.size, 1);
      assert.equal(values2.size, 1);
      assert.equal(values3.size, 1);
      assert.ok(values1.has('update2'));
      assert.ok(values2.has('update2'));
      assert.ok(values3.has('update2'));
    });

    it('should converge with partial synchronization', () => {
      const node1 = new MVReg('node1');
      const node2 = new MVReg('node2');
      const node3 = new MVReg('node3');

      const delta1 = node1.write('A');
      const delta2 = node2.write('B');

      node3.join(delta1);
      node3.join(delta2);

      const delta3 = node3.write('C');
      node1.join(delta3);
      node2.join(delta3);

      const values1 = node1.read();
      const values2 = node2.read();
      const values3 = node3.read();

      assert.equal(values1.size, 1);
      assert.equal(values2.size, 1);
      assert.equal(values3.size, 1);
      assert.ok(values3.has('C'));
    });
  });

  describe('Delta Propagation Patterns', () => {
    it('should propagate deltas in star topology', () => {
      const central = new MVReg('central');
      const node1 = new MVReg('node1');
      const node2 = new MVReg('node2');
      const node3 = new MVReg('node3');

      const delta1 = node1.write('A');
      const delta2 = node2.write('B');
      const delta3 = node3.write('C');

      central.join(delta1);
      central.join(delta2);
      central.join(delta3);

      node1.join(central);
      node2.join(central);
      node3.join(central);

      const expected = new Set(['A', 'B', 'C']);
      assert.deepEqual(node1.read(), expected);
      assert.deepEqual(node2.read(), expected);
      assert.deepEqual(node3.read(), expected);
      assert.deepEqual(central.read(), expected);
    });

    it('should propagate deltas in chain topology', () => {
      const node1 = new MVReg('node1');
      const node2 = new MVReg('node2');
      const node3 = new MVReg('node3');

      const delta1 = node1.write('A');
      node2.join(delta1);

      const delta2 = node2.write('B');
      node3.join(delta2);

      const delta3 = node3.write('C');
      node2.join(delta3);
      node1.join(node2);

      assert.ok(node1.read().has('C'));
      assert.equal(node1.read().size, 1);
    });

    it('should handle peer-to-peer communication', () => {
      const nodes = [
        new MVReg('node1'),
        new MVReg('node2'),
        new MVReg('node3'),
      ];

      const deltas = [
        nodes[0].write('A'),
        nodes[1].write('B'),
        nodes[2].write('C'),
      ];

      nodes[0].join(deltas[1]);
      nodes[1].join(deltas[2]);
      nodes[2].join(deltas[0]);

      nodes[0].join(nodes[1]);
      nodes[2].join(nodes[0]);
      nodes[1].join(nodes[2]);

      const expected = new Set(['A', 'B', 'C']);
      for (const node of nodes) {
        assert.deepEqual(node.read(), expected);
      }
    });

    it('should maintain idempotence on repeated joins', () => {
      const node1 = new MVReg('node1');
      const node2 = new MVReg('node2');

      const delta = node1.write('value');

      node2.join(delta);
      node2.join(delta);
      node2.join(delta);

      assert.equal(node2.read().size, 1);
      assert.ok(node2.read().has('value'));
    });
  });

  describe('Network Partition Scenarios', () => {
    it('should handle network partition and healing', () => {
      const node1 = new MVReg('node1');
      const node2 = new MVReg('node2');

      const deltaInit = node1.write('initial');
      node2.join(deltaInit);

      const delta1Before = node1.write('partition1');
      const delta2Before = node2.write('partition2');

      node1.join(delta2Before);
      node2.join(delta1Before);

      const values1 = node1.read();
      const values2 = node2.read();

      assert.equal(values1.size, 2);
      assert.equal(values2.size, 2);
      assert.ok(values1.has('partition1'));
      assert.ok(values1.has('partition2'));
    });

    it('should converge after multiple partition cycles', () => {
      const node1 = new MVReg('node1');
      const node2 = new MVReg('node2');

      const d1 = node1.write('v1');
      const d2 = node2.write('v2');
      node1.join(d2);
      node2.join(d1);

      const d3 = node1.write('v3');
      const d4 = node2.write('v4');
      node1.join(d4);
      node2.join(d3);

      const values1 = Array.from(node1.read()).sort();
      const values2 = Array.from(node2.read()).sort();

      assert.deepEqual(values1, values2);
      assert.equal(values1.length, 2);
    });

    it('should handle asymmetric partition resolution', () => {
      const node1 = new MVReg('node1');
      const node2 = new MVReg('node2');
      const node3 = new MVReg('node3');

      const delta1 = node1.write('A');
      const delta2 = node2.write('B');

      node3.join(delta1);

      const delta3 = node3.write('C');
      node1.join(delta3);

      node2.join(delta1);
      node2.join(delta3);
      node1.join(delta2);
      node3.join(delta2);

      // After convergence: B and C are concurrent writes,
      // A was overwritten by C
      const expected = new Set(['B', 'C']);
      assert.deepEqual(node1.read(), expected);
      assert.deepEqual(node2.read(), expected);
      assert.deepEqual(node3.read(), expected);
    });
  });

  describe('Reset Operations', () => {
    it('should propagate reset across nodes', () => {
      const node1 = new MVReg('node1');
      const node2 = new MVReg('node2');

      const deltaWrite = node1.write('value');
      node2.join(deltaWrite);

      const deltaReset = node1.reset();
      node2.join(deltaReset);

      assert.equal(node1.read().size, 0);
      assert.equal(node2.read().size, 0);
    });

    it('should handle concurrent write and reset', () => {
      const node1 = new MVReg('node1');
      const node2 = new MVReg('node2');

      const deltaInit = node1.write('initial');
      node2.join(deltaInit);

      const deltaReset = node1.reset();
      const deltaWrite = node2.write('new');

      node1.join(deltaWrite);
      node2.join(deltaReset);

      assert.equal(node1.read().size, 1);
      assert.equal(node2.read().size, 1);
      assert.ok(node1.read().has('new'));
      assert.ok(node2.read().has('new'));
    });

    it('should handle reset during partition', () => {
      const node1 = new MVReg('node1');
      const node2 = new MVReg('node2');

      const deltaInit = node1.write('initial');
      node2.join(deltaInit);

      const deltaReset = node1.reset();
      const deltaWrite1 = node1.write('A');
      const deltaWrite2 = node2.write('B');

      node1.join(deltaWrite2);
      node2.join(deltaReset);
      node2.join(deltaWrite1);

      const values1 = node1.read();
      const values2 = node2.read();

      assert.equal(values1.size, 2);
      assert.equal(values2.size, 2);
      assert.ok(values1.has('A'));
      assert.ok(values1.has('B'));
    });
  });

  describe('Eventual Consistency Properties', () => {
    it('should guarantee eventual consistency with arb join order', () => {
      const node1 = new MVReg('node1');
      const node2 = new MVReg('node2');
      const node3 = new MVReg('node3');

      const delta1 = node1.write('A');
      const delta2 = node2.write('B');
      const delta3 = node3.write('C');

      node3.join(delta2);
      node1.join(delta3);
      node2.join(delta1);
      node1.join(delta2);
      node3.join(delta1);
      node2.join(delta3);

      const values1 = Array.from(node1.read()).sort();
      const values2 = Array.from(node2.read()).sort();
      const values3 = Array.from(node3.read()).sort();

      assert.deepEqual(values1, values2);
      assert.deepEqual(values2, values3);
    });

    it('should be associative', () => {
      const node1 = new MVReg('node1');
      const node2 = new MVReg('node2');
      const node3 = new MVReg('node3');

      node1.write('A');
      node2.write('B');
      node3.write('C');

      const left = new MVReg('test1');
      left.join(node1);
      left.join(node2);
      left.join(node3);

      const temp = new MVReg('temp');
      temp.join(node2);
      temp.join(node3);

      const right = new MVReg('test2');
      right.join(node1);
      right.join(temp);

      const leftValues = Array.from(left.read()).sort();
      const rightValues = Array.from(right.read()).sort();

      assert.deepEqual(leftValues, rightValues);
    });

    it('should be commutative', () => {
      const node1 = new MVReg('node1');
      const node2 = new MVReg('node2');

      node1.write('A');
      node2.write('B');

      const forward = new MVReg('forward');
      forward.join(node1);
      forward.join(node2);

      const reverse = new MVReg('reverse');
      reverse.join(node2);
      reverse.join(node1);

      const forwardValues = Array.from(forward.read()).sort();
      const reverseValues = Array.from(reverse.read()).sort();

      assert.deepEqual(forwardValues, reverseValues);
    });

    it('should be idempotent', () => {
      const node1 = new MVReg('node1');
      const node2 = new MVReg('node2');

      node1.write('value');

      node2.join(node1);
      const firstJoin = new Set(node2.read());

      node2.join(node1);
      const secondJoin = new Set(node2.read());

      assert.deepEqual(firstJoin, secondJoin);
    });
  });

  describe('Complex Multi-Node Scenarios', () => {
    it('should handle multi-round writes with full mesh synchronization', () => {
      const nodes = [
        new MVReg('node1'),
        new MVReg('node2'),
        new MVReg('node3'),
      ];

      for (let round = 0; round < 3; round++) {
        const deltas = nodes.map((node, i) => node.write(`r${round}n${i}`));

        for (let i = 0; i < nodes.length; i++) {
          for (let j = 0; j < deltas.length; j++) {
            if (i !== j) {
              nodes[i].join(deltas[j]);
            }
          }
        }
      }

      const finalValue = nodes[0].read();
      for (const node of nodes) {
        assert.deepEqual(node.read(), finalValue);
      }
    });

    it('should handle cascading writes', () => {
      const node1 = new MVReg('node1');
      const node2 = new MVReg('node2');
      const node3 = new MVReg('node3');

      const d1 = node1.write('v1');
      node2.join(d1);

      const d2 = node2.write('v2');
      node3.join(d2);

      const d3 = node3.write('v3');
      node2.join(d3);
      node1.join(node2);

      assert.equal(node1.read().size, 1);
      assert.ok(node1.read().has('v3'));
    });

    it('should converge with delayed propagation', () => {
      const nodes = Array.from({ length: 5 }, (_, i) => new MVReg(`node${i}`));

      const deltas = nodes.map((node, i) => node.write(`value${i}`));

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          nodes[j].join(deltas[i]);
        }
      }

      for (let i = nodes.length - 1; i >= 0; i--) {
        for (let j = 0; j < i; j++) {
          nodes[j].join(nodes[i]);
        }
      }

      const expected = nodes[nodes.length - 1].read();
      for (const node of nodes) {
        assert.deepEqual(node.read(), expected);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty register operations', () => {
      const node1 = new MVReg('node1');
      const node2 = new MVReg('node2');

      node1.join(node2);

      assert.equal(node1.read().size, 0);
    });

    it('should handle null and undefined values', () => {
      const reg = new MVReg('node1');
      reg.write(null);
      assert.ok(reg.read().has(null));

      reg.write(undefined);
      assert.ok(reg.read().has(undefined));
    });

    it('should handle object values', () => {
      const node1 = new MVReg('node1');
      const node2 = new MVReg('node2');

      const obj1 = { key: 'value1' };
      const obj2 = { key: 'value2' };

      const delta1 = node1.write(obj1);
      const delta2 = node2.write(obj2);

      node1.join(delta2);
      node2.join(delta1);

      assert.equal(node1.read().size, 2);
      assert.equal(node2.read().size, 2);
    });
  });
});
