for (const name of ['dispose', 'asyncDispose'] as const) {
  if (typeof Symbol[name] !== 'symbol') {
    Object.defineProperty(Symbol, name, {
      value: Symbol.for(`nodejs.${name}`),
      configurable: false,
      enumerable: false,
      writable: false,
    });
  }
}

declare global {
  interface SymbolConstructor {
    readonly asyncDispose: unique symbol;
    readonly dispose: unique symbol;
  }

  interface Disposable {
    [Symbol.dispose](): void;
  }

  interface AsyncDisposable {
    [Symbol.asyncDispose](): PromiseLike<void>;
  }

  interface SuppressedError extends Error {
    error: unknown;
    suppressed: unknown;
  }

  interface SuppressedErrorConstructor {
    /* eslint-disable-next-line
      @typescript-eslint/prefer-readonly-parameter-types */
    new(...args: unknown[]): SuppressedError;
  }
}
