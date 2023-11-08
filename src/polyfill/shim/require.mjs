await import('node:module').then(({ createRequire }) => {
  Object.defineProperty(globalThis, 'require', {
    value: createRequire(import.meta.url),
    configurable: false,
    enumerable: false,
    writable: false,
  });
});
