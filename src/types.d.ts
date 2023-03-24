declare global {
  interface ErrorOptions {
    cause?: unknown;
  }

  interface ErrorConstructor {
    /* eslint-disable-next-line
      @typescript-eslint/prefer-readonly-parameter-types */
    new(message: string, options: ErrorOptions): Error;
  }

  namespace NodeJS {
    interface ErrnoException {
      stack: string;
    }

    interface ProcessEnv {
      RUNNER_TEMP: string;
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
