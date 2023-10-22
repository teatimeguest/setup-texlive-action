await import('node:module').then(({ createRequire }) => {
  globalThis.require = createRequire(import.meta.url);
});
