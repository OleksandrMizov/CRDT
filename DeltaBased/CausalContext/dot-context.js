'use strict';
// Dot Context - Autonomous causal context for context sharing

const { Dot } = require('./dot');

class DotContext {
  constructor(compactCausalContext = new Map(), dotCloud = new Set()) {
    // Map<string, number>
    // Map<id, counter>
    this.compactCausalContext = compactCausalContext; // Compact causal context
    // Set<string>
    // Set<"id:counter">
    this.dotCloud = dotCloud; // Dot cloud (stored as strings "id:counter")
  }

  // refactor
  toString() {
    const cc = Array.from(this.compactCausalContext.entries())
      .map(([k, v]) => new Dot(k, v).toString())
      .join(' ');
    const dc = Array.from(this.dotCloud).join(' ');

    return `Context: CC (${cc}) DC (${dc})`;
  }

  dotIn(dot) {
    // Check if dot is in context
    const dotObj = Dot.toDot(dot);

    const ccValue = this.compactCausalContext.get(dotObj.id);

    if (ccValue !== undefined && dotObj.counter <= ccValue) {
      return true;
    }

    const dotStr = dotObj.toString();
    return this.dotCloud.has(dotStr);
  }

  compact() {
    let compactedCloud;
    do {
      compactedCloud = false;
      const toDelete = [];

      for (const cloudDotStr of this.dotCloud) {
        const cloudDot = Dot.fromString(cloudDotStr);
        const contextDotCounter = this.compactCausalContext.get(cloudDot.id);

        if (contextDotCounter === undefined) {
          if (cloudDot.counter === 1) {
            this.compactCausalContext.set(cloudDot.id, cloudDot.counter);
            toDelete.push(cloudDotStr);
            compactedCloud = true;
          }
        } else if (cloudDot.counter === contextDotCounter + 1) {
          this.compactCausalContext.set(cloudDot.id, contextDotCounter + 1);
          toDelete.push(cloudDotStr);
          compactedCloud = true;
        } else if (cloudDot.counter <= contextDotCounter) {
          toDelete.push(cloudDotStr);
        }
      }

      for (const dotStr of toDelete) {
        this.dotCloud.delete(dotStr);
      }
    } while (compactedCloud);
  }

  makeDot(id) {
    const current = this.compactCausalContext.get(id) || 0;
    const newCounter = current + 1;
    this.compactCausalContext.set(id, newCounter);
    return new Dot(id, newCounter);
  }

  insertDot(dot, compactNow = true) {
    const dotStr = Dot.toString(dot);
    this.dotCloud.add(dotStr);
    if (compactNow) {
      this.compact();
    }
  }

  join(otherContext) {
    if (this === otherContext) return;

    // Join Compact Causal Context
    for (const [id, value] of otherContext.compactCausalContext) {
      const current = this.compactCausalContext.get(id);
      this.compactCausalContext.set(
        id,
        current === undefined ? value : Math.max(current, value),
      );
    }

    // Join Dot Cloud
    for (const dot of otherContext.dotCloud) {
      this.insertDot(dot, false);
    }

    this.compact();
  }

  clone() {
    return new DotContext(
      new Map(this.compactCausalContext),
      new Set(this.dotCloud),
    );
  }
}

module.exports = { DotContext };
