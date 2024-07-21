import * as path from 'node:path';
import { env } from 'node:process';

import { Expose, Transform } from 'class-transformer';
import {
  defaultMetadataStorage as storage,
} from 'class-transformer/esm5/storage';
import { kebabCase, snakeCase } from 'scule';

export function Exception<const F extends Function>(constructor: F): void {
  const name = constructor.name;
  Object.defineProperties(constructor.prototype, {
    name: {
      value: name,
    },
    [Symbol.toStringTag]: {
      get: function(this: Readonly<Error>) {
        return this.name;
      },
    },
    toJSON: {
      value: function() {
        return {};
      },
    },
  });
}

const CASE = {
  kebab: kebabCase<string>,
  snake: snakeCase<string>,
} as const;

/** Serialize/deserialize properties with different letter cases. */
export function Case(
  letterCase: keyof typeof CASE,
): PropertyDecorator & ClassDecorator {
  function decorator<const F extends Function>(target: F): void;
  function decorator(target: object, key: string | symbol): void;
  function decorator(target: object, key?: string | symbol): void {
    const metadatas = storage.getExposedMetadatas(
      target instanceof Function ? target : target.constructor,
    );
    if (key !== undefined) {
      const name = CASE[letterCase](key as string);
      const metadata = metadatas.find((data) => data.propertyName === key);
      if (metadata === undefined) {
        Expose({ name })(target, key);
      } else {
        metadata.options.name = name;
      }
    } else {
      for (const metadata of metadatas) {
        if (metadata.propertyName !== undefined) {
          metadata.options.name = CASE[letterCase](metadata.propertyName);
        }
      }
    }
  }
  return decorator;
}

export function getExposedName(target: object, key: string | symbol): string {
  return storage
    .getExposedMetadatas(target.constructor)
    .find((data) => data.propertyName === key)
    ?.options
    .name ?? (key as string);
}

/** Read initial values from environment variables. */
export function FromEnv(key: string): PropertyDecorator {
  return Transform(({ value }) => {
    return env[key] ?? (value === undefined ? undefined : assertString(value));
  });
}

/** Read a string value as path. */
export const AsPath: PropertyDecorator = Transform(({ value }) => {
  return value === undefined ? undefined : path.normalize(assertString(value));
});

function assertString(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  } else if (value instanceof String) {
    return value.valueOf();
  }
  const error = new TypeError('Unexpectedly non-string passed');
  error['input'] = value;
  throw error;
}

/* eslint @typescript-eslint/no-unsafe-function-type: off */
