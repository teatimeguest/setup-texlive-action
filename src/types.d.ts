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

declare module 'class-transformer' {
  import type {
    ClassTransformOptions,
    TransformFnParams,
    TransformOptions,
  } from 'class-transformer/types';

  export function Transform<T = unknown>(
    fn: (
      params: Readonly<Omit<TransformFnParams, 'value'> & { value: T }>,
    ) => unknown,
    options?: TransformOptions,
  ): PropertyDecorator;

  export function instanceToPlain<T extends object>(
    object: T,
    options?: ClassTransformOptions,
  ): Record<string, unknown>;

  export * from 'class-transformer/types';
}

declare module 'class-transformer/esm5/storage' {
  export * from 'class-transformer/types/storage';
}
