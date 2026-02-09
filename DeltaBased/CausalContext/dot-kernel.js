'use strict';
// Dot Kernel - Core kernel for dot-based CRDTs

const { DotContext } = require('./dot-context');
const { Dot } = require('./dot');
const { DeltaHelpers } = require('./delta-helpers');

class DotKernel {
  constructor(
    sharedContext = null,
    dataStorage = new Map(),
    contextBase = new DotContext(),
  ) {
    // Map of dots to values (dot stored as "id:counter")
    // Map<string, unknown>
    this.dataStorage = dataStorage;
    this.contextBase = contextBase;
    this.sharedContext = sharedContext || this.contextBase;
  }

  toString() {
    const dotValues = Array.from(this.dataStorage.entries())
      .map(([dotStr, val]) => `${dotStr}->${JSON.stringify(val)}`)
      .join(' ');

    const sharedContextStr = this.sharedContext.toString();

    return `Kernel: DS (${dotValues}) ${sharedContextStr}`;
  }

  join(otherKernel) {
    if (this === otherKernel) return;

    const thisDots = Array.from(this.dataStorage.keys()).sort(Dot.compare);
    const otherDots = Array.from(otherKernel.dataStorage.keys()).sort(
      Dot.compare,
    );

    let i = 0;
    let j = 0;

    while (i < thisDots.length || j < otherDots.length) {
      const thisDot = i < thisDots.length ? thisDots[i] : null;
      const otherDot = j < otherDots.length ? otherDots[j] : null;

      if (thisDot !== null && (otherDot === null || thisDot < otherDot)) {
        // Dot only in this
        if (otherKernel.sharedContext.dotIn(thisDot)) {
          // other knows dot, must delete here
          this.dataStorage.delete(thisDot);
        }
        // keep it
        i++;
      } else if (
        otherDot !== null &&
        (thisDot === null || Dot.compare(otherDot, thisDot) < 0)
      ) {
        // Dot only in other
        if (!this.sharedContext.dotIn(otherDot)) {
          this.dataStorage.set(otherDot, otherKernel.dataStorage.get(otherDot));
        }
        j++;
      } else {
        // Dot in both
        i++;
        j++;
      }
    }

    this.sharedContext.join(otherKernel.sharedContext);
  }

  deepJoin(other) {
    if (this === other) return;

    const thisDots = Array.from(this.dataStorage.keys()).sort(Dot.compare);
    const otherDots = Array.from(other.dataStorage.keys()).sort(Dot.compare);

    let i = 0;
    let j = 0;

    while (i < thisDots.length || j < otherDots.length) {
      const thisDot = i < thisDots.length ? thisDots[i] : null;
      const otherDot = j < otherDots.length ? otherDots[j] : null;

      if (thisDot !== null && (otherDot === null || thisDot < otherDot)) {
        // Dot only in this
        if (other.sharedContext.dotIn(thisDot)) {
          this.dataStorage.delete(thisDot);
        }
        i++;
      } else if (
        otherDot !== null &&
        (thisDot === null || otherDot < thisDot)
      ) {
        // Dot only in other
        if (!this.sharedContext.dotIn(otherDot)) {
          this.dataStorage.set(otherDot, other.dataStorage.get(otherDot));
        }
        j++;
      } else {
        // Dot in both - join the payloads
        const thisVal = this.dataStorage.get(thisDot);
        const otherVal = other.dataStorage.get(otherDot);
        if (JSON.stringify(thisVal) !== JSON.stringify(otherVal)) {
          this.dataStorage.set(thisDot, DeltaHelpers.join(thisVal, otherVal));
        }
        i++;
        j++;
      }
    }

    this.sharedContext.join(other.sharedContext);
  }

  add(id, val) {
    const res = new DotKernel();
    const dot = this.sharedContext.makeDot(id);
    const dotStr = Dot.toString(dot);

    this.dataStorage.set(dotStr, val);
    res.dataStorage.set(dotStr, val);
    res.sharedContext.insertDot(dot);

    return res;
  }

  dotAdd(id, val) {
    const dot = this.sharedContext.makeDot(id);
    const dotStr = Dot.toString(dot);
    this.dataStorage.set(dotStr, val);
    return dot;
  }

  rmv(val = null) {
    const res = new DotKernel();

    if (val === null) {
      // Remove all dots
      for (const [dotStr] of this.dataStorage) {
        res.sharedContext.insertDot(dotStr, false);
      }
      res.sharedContext.compact();
      this.dataStorage.clear();
    } else if (Dot.isDotLikeObject(val)) {
      // Remove specific dot
      const dotStr = Dot.toString(val);
      if (this.dataStorage.has(dotStr)) {
        res.sharedContext.insertDot(dotStr, false);
        this.dataStorage.delete(dotStr);
      }
      res.sharedContext.compact();
    } else {
      // Remove all dots matching value
      const toDelete = [];
      for (const [dotStr, v] of this.dataStorage) {
        if (JSON.stringify(v) === JSON.stringify(val)) {
          res.sharedContext.insertDot(dotStr, false);
          toDelete.push(dotStr);
        }
      }
      for (const dotStr of toDelete) {
        this.dataStorage.delete(dotStr);
      }
      res.sharedContext.compact();
    }

    return res;
  }

  clone() {
    if (this.sharedContext === this.contextBase) {
      const clonedContext = this.contextBase.clone();
      return new DotKernel(
        clonedContext,
        new Map(this.dataStorage),
        clonedContext,
      );
    }
    return new DotKernel(
      // we need to keep the shared context to keep the link
      this.sharedContext,
      new Map(this.dataStorage),
      this.contextBase.clone(),
    );
  }
}

module.exports = { DotKernel };
