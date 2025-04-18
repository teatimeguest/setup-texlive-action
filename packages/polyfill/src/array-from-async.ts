import fromAsync from 'array-from-async';

if (typeof Array.fromAsync !== 'function') {
  Object.defineProperty(Array, 'fromAsync', {
    value: fromAsync,
    configurable: false,
    enumerable: false,
    writable: false,
  });
}
