import * as os from 'node:os';

import { type MinimatchOptions, minimatch } from 'minimatch';
import type { RangeOptions } from 'semver';
import coerce from 'semver/functions/coerce.js';
import inRange from 'semver/functions/satisfies.js';
import type { DeepReadonly } from 'ts-essentials';

export interface Target {
  platform?: string;
  arch?: string;
  versions?: string;
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

export function satisfies(
  target: Readonly<Target>,
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

export function match<const T extends Target>(
  patterns: Readonly<Record<string, T>>,
  options?: DeepReadonly<Options>,
): [key: string, value: T] {
  for (const [key, value] of Object.entries(patterns)) {
    if (satisfies(value, options)) {
      return [key, value];
    }
  }
  const error = new Error('None of the patterns matched');
  const { platform = os.platform(), arch = os.arch(), version } = options ?? {};
  Object.assign(error, { patterns, platform, arch, version });
  throw error;
}
