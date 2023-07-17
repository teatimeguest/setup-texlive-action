interface Error {
  [key: string]: unknown; // Some additional information.
}

declare namespace NodeJS {
  interface ErrnoException {
    /**
     * @privateRemarks Node.js error objects must have the `stack` property.
     * @see {@link https://nodejs.org/docs/latest-v16.x/api/errors.html#errorstack}
     */
    stack: string;
  }

  interface ProcessEnv {
    RUNNER_TEMP: string;
  }
}

declare module 'node:util/types' {
  /**
   * A type-guard for the error type of Node.js.
   *
   * @privateRemarks
   *
   * Since `NodeJS.ErrnoException` is defined as an interface,
   * we cannot write `error instanceof NodeJS.ErrnoException`, but
   * `util.types.isNativeError` is sufficient
   * because all properties of `NodeJS.ErrnoException` are optional.
   */
  function isNativeError(error: unknown): error is NodeJS.ErrnoException;
}
