import { readFile } from 'node:fs/promises';
import { env } from 'node:process';

import { isFeatureAvailable as isCacheAvailable } from '@actions/cache';
import type { MarkWritable } from 'ts-essentials';

import { init as initEnv } from '#/action/env';
import * as log from '#/log';
import { Version, dependsTxt, latest, validateReleaseYear } from '#/texlive';
import { getInput } from '#/util';

export interface Inputs {
  readonly cache: boolean;
  readonly packages: ReadonlySet<string>;
  readonly prefix: string;
  readonly texdir?: string | undefined;
  readonly tlcontrib: boolean;
  readonly updateAllPackages: boolean;
  readonly version: Version;
}

export namespace Inputs {
  export async function load(): Promise<Inputs> {
    const spec = getInput('version', { default: 'latest' })
      .trim()
      .toLowerCase();
    const version = spec === 'latest'
      ? await latest.getVersion()
      : Version.parse(spec);
    await validateReleaseYear(version);
    initEnv(version);
    const inputs = {
      cache: getInput('cache', { type: Boolean }),
      packages: await loadPackageList(),
      /* eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        -- `TEXLIVE_INSTALL_PREFIX` should be set by `initEnv`. */
      prefix: getInput('prefix', { default: env['TEXLIVE_INSTALL_PREFIX']! }),
      texdir: getInput('texdir'),
      tlcontrib: getInput('tlcontrib', { type: Boolean }),
      updateAllPackages: getInput('update-all-packages', { type: Boolean }),
      version,
    };
    await validate(inputs);
    return inputs;
  }

  async function validate(
    this: void,
    /* eslint-disable-next-line
      @typescript-eslint/prefer-readonly-parameter-types */
    inputs: MarkWritable<Inputs, 'cache' | 'tlcontrib' | 'updateAllPackages'>,
  ): Promise<void> {
    if (inputs.cache && !isCacheAvailable()) {
      log.warn('Caching is disabled because cache service is not available');
      inputs.cache = false;
    }
    if (!await latest.isLatest(inputs.version)) {
      if (inputs.tlcontrib) {
        log.warn('`tlcontrib` is currently ignored for older versions');
        inputs.tlcontrib = false;
      }
      if (inputs.updateAllPackages) {
        log.info('`update-all-packages` is ignored for older versions');
        inputs.updateAllPackages = false;
      }
    }
  }

  async function loadPackageList(this: void): Promise<Set<string>> {
    const packages = [];
    for await (const { name } of loadDependsTxt()) {
      packages.push(name);
    }
    return new Set(packages.sort());
  }

  async function* loadDependsTxt(
    this: void,
  ): AsyncGenerator<dependsTxt.Dependency, void> {
    const inline = getInput('packages');
    if (inline !== undefined) {
      yield* dependsTxt.parse(inline);
    }
    const file = getInput('package-file');
    if (file !== undefined) {
      yield* dependsTxt.parse(await readFile(file, 'utf8'));
    }
  }
}
