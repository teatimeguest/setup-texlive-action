declare global {
  interface ErrorConstructor {
    new(message: string, options: { readonly cause: unknown }): Error;
  }

  namespace NodeJS {
    interface ErrnoException {
      stack: string;
    }
  }
}

declare module 'util/types' {
  // A type-guard for the error type of Node.js.
  // Since `NodeJS.ErrnoException` is defined as an interface,
  // we cannot write `error instanceof NodeJS.ErrnoException`, but
  // `util.types.isNativeError` is sufficient
  // because all properties of `NodeJS.ErrnoException` are optional.
  function isNativeError(error: unknown): error is NodeJS.ErrnoException;
}

export {};
