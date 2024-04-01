import fromAsync from 'array-from-async';

if (typeof Array.fromAsync !== 'function') {
  Object.defineProperty(Array, 'fromAsync', {
    value: fromAsync as typeof Array.fromAsync,
    configurable: false,
    enumerable: false,
    writable: false,
  });
}

declare global {
  interface ArrayConstructor {
    fromAsync: typeof fromAsync;
  }
}
