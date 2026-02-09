'use strict';

class Dot {
  constructor(id, counter) {
    this.id = id;
    this.counter = counter;
  }

  toString() {
    return `${this.id}:${this.counter}`;
  }

  gt(other) {
    return Dot.compare(this, other) > 0;
  }

  gte(other) {
    return Dot.compare(this, other) >= 0;
  }

  lt(other) {
    return Dot.compare(this, other) < 0;
  }

  lte(other) {
    return Dot.compare(this, other) <= 0;
  }

  static fromString(dotStr) {
    if (typeof dotStr !== 'string') {
      throw new Error(
        'Invalid dot input expected to be string: ' + JSON.stringify(dotStr),
      );
    }
    const parts = dotStr.split(':');
    if (parts.length !== 2) {
      throw new Error(
        'Invalid dot format: expected "id:counter", got "' + dotStr + '"',
      );
    }
    const [id, counterStr] = parts;
    const counter = parseInt(counterStr);
    if (isNaN(counter) || !id) {
      throw new Error(
        'Invalid dot format: id must be non-empty ' +
          'string and counter must be an integer, got "' +
          dotStr +
          '"',
      );
    }
    return new Dot(id, counter);
  }

  static toDot(dot) {
    if (typeof dot === 'string') return Dot.fromString(dot);
    if (dot instanceof Dot) return dot;
    if (Dot.isDotLikeObject(dot)) {
      return new Dot(dot.id, dot.counter);
    }
    throw new Error('Invalid dot input: ' + JSON.stringify(dot));
  }

  static isDotLikeObject(dot) {
    return (
      typeof dot === 'object' &&
      dot !== null &&
      dot.id !== undefined &&
      dot.counter !== undefined
    );
  }

  static toString(dot) {
    return Dot.toDot(dot).toString();
  }

  static compare(_dot1, _dot2) {
    const dot1 = Dot.toDot(_dot1);
    const dot2 = Dot.toDot(_dot2);
    if (dot1.id !== dot2.id) return dot1.id.localeCompare(dot2.id);
    return dot1.counter - dot2.counter;
  }
}

module.exports = { Dot };
