interface Error {
  [key: string]: unknown; // Some additional information.
}

declare namespace NodeJS {
  interface ProcessEnv {
    RUNNER_TEMP: string;
  }
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

  export function instanceToPlain<T = Record<string, unknown>>(
    object: object,
    options?: ClassTransformOptions,
  ): T;

  export * from 'class-transformer/types';
}

declare module 'class-transformer/esm5/storage' {
  export * from 'class-transformer/types/storage';
}

declare module 'node-fetch' {
  export var AbortError: ErrorConstructor;
}
