import * as os from 'node:os';

import { type MinimatchOptions, minimatch } from 'minimatch';
import type { Range, RangeOptions } from 'semver';
import coerce from 'semver/functions/coerce.js';
import inRange from 'semver/functions/satisfies.js';
import type { DeepReadonly } from 'ts-essentials';

/**
 * @see `../schemas/target.schema.json`
 */
export interface Target {
  platform?: string;
  arch?: string;
  versions?: string | Range;
}

export interface Options {
  /** @defaultValue `os.platform()` */
  platform?: NodeJS.Platform;
  /** @defaultValue `os.arch()` */
  arch?: NodeJS.Architecture;
  version?: string;
}

const semverOptions = {
  includePrerelease: true,
} as const satisfies RangeOptions;

const minimatchOptions = {
  platform: 'linux',
} as const satisfies MinimatchOptions;

/**
 * Check if current platform is in scope.
 */
export function satisfies(
  target: DeepReadonly<Target>,
  options?: DeepReadonly<Options>,
): boolean {
  let result = true;
  if ('platform' in target) {
    result &&= minimatch(
      options?.platform ?? os.platform(),
      target.platform,
      minimatchOptions,
    );
  }
  if ('arch' in target) {
    result &&= minimatch(
      options?.arch ?? os.arch(),
      target.arch,
      minimatchOptions,
    );
  }
  if ('versions' in target && options?.version !== undefined) {
    const v = coerce(options.version, semverOptions);
    if (v === null) {
      const error = new TypeError('Invalid version string');
      error['value'] = options.version;
      throw error;
    }
    result &&= inRange(v, target.versions, semverOptions);
  }
  return result;
}

/**
 * Pick an entry from the pattern object that matches the current platform.
 * @param patterns - Pattern object.
 * @param options - Options for the current platform.
 */
export function match<const T extends Record<string, Target>>(
  patterns: T,
  options?: DeepReadonly<Options>,
): [keyof T, T[keyof T]] {
  for (const entry of Object.entries(patterns)) {
    if (satisfies(entry[1], options)) {
      return entry as ReturnType<typeof match<T>>;
    }
  }
  const error = new Error('None of the patterns matched');
  const { platform = os.platform(), arch = os.arch(), version } = options ?? {};
  Object.assign(error, { patterns, platform, arch, version });
  throw error;
}
