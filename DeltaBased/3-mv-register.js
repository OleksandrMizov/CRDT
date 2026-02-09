'use strict';

const { DotKernel } = require('./CausalContext/dot-kernel');

class MVReg {
  constructor(id = null, sharedContext = null) {
    this.dotKernel = new DotKernel(sharedContext);
    this.id = id;
  }

  context() {
    return this.dotKernel.sharedContext;
  }

  write(val) {
    const r = new MVReg();
    const a = new MVReg();
    r.dotKernel = this.dotKernel.rmv();
    a.dotKernel = this.dotKernel.add(this.id, val);
    r.join(a);
    return r;
  }

  read() {
    const s = new Set();
    this.dotKernel.dataStorage.forEach((val) => {
      s.add(val);
    });
    return s;
  }

  reset() {
    const r = new MVReg();
    r.dotKernel = this.dotKernel.rmv();
    return r;
  }

  join(other) {
    this.dotKernel.join(other.dotKernel);
    return this;
  }

  toString() {
    return `MVReg:${this.dotKernel}`;
  }
}

module.exports = MVReg;
