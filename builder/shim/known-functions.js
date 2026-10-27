const normalize = (body) => String(body).replace(/\s+/g, ' ').trim();

const constructorName = (value) => (value && value.constructor && value.constructor.name ? value.constructor.name : 'object');

const exceptionClass = () =>
  class Exception extends Error {
    constructor(dartException, message) {
      super(message);
      Object.defineProperty(this, '_dartException', { value: dartException, enumerable: false });
    }

    toString() {
      return this.message;
    }
  };

const KNOWN = new Map([
  ['return typeof value', (value) => typeof value],
  [normalize('if (value && value.constructor && value.constructor.name) { return value.constructor.name; } return "object";'), constructorName],
  [normalize(`return class Exception extends Error { constructor(dartException, message) { super(message); // Define this as non-enumerable so that it doesn't show up when the // exception hits the top level. Object.defineProperty(this, '_dartException', { value: dartException, enumerable: false }); } toString() { return this.message; } }`), exceptionClass],
]);

globalThis.__accreteKnownFunction = (body) => KNOWN.get(normalize(body));
