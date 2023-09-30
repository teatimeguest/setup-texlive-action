import path from 'node:path';
import { env } from 'node:process';

import { Expose, Transform } from 'class-transformer';
import { defaultMetadataStorage } from 'class-transformer/esm5/storage';
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
    const metadatas = defaultMetadataStorage.getExposedMetadatas(
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

/** Read initial values from environment variables. */
export function FromEnv(key: string): PropertyDecorator {
  return Transform(({ value }) => env[key] ?? value);
}

/** Read a string value as path. */
export const AsPath: PropertyDecorator = Transform<string | undefined>(
  ({ value }) => value === undefined ? undefined : path.normalize(value),
);

/* eslint
  @typescript-eslint/ban-types: ["error", { types: { Function: false } }] */
