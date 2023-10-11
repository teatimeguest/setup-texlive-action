import { readFile } from 'node:fs/promises';
import { platform } from 'node:os';

import { create as createGlobber } from '@actions/glob';
import type { DeepUndefinable } from 'ts-essentials';

import * as env from '#/action/env';
import { Inputs } from '#/action/inputs';
import * as log from '#/log';
import { ReleaseData, Version, dependsTxt } from '#/texlive';

export interface Config
  extends Omit<Inputs, 'packageFile' | 'packages' | 'version'>
{
  readonly packages: ReadonlySet<string>;
  readonly version: Version;
}

export namespace Config {
  export async function load(): Promise<Config> {
    env.init();

    const { isLatest } = await ReleaseData.setup();
    const { packageFile, packages, version, ...inputs } = Inputs.load();

    const config = {
      ...inputs,
      version: await resolveVersion({ version }),
      packages: await collectPackages({ packageFile, packages }),
    };

    if (!isLatest(config.version)) {
      if (config.tlcontrib) {
        log.warn(`TLContrib cannot be used with an older version of TeX Live`);
        config.tlcontrib = false;
      }
      if (config.updateAllPackages) {
        log.info('`update-all-packages` is ignored for older versions');
        config.updateAllPackages = false;
      }
    }
    return config;
  }
}

async function collectPackages(
  inputs: DeepUndefinable<Pick<Inputs, 'packageFile' | 'packages'>>,
): Promise<Set<string>> {
  type Dependency = dependsTxt.Dependency;
  async function* loadDependsTxts(): AsyncGenerator<Dependency, void> {
    if (inputs.packages !== undefined) {
      yield* dependsTxt.parse(inputs.packages);
    }
    if (inputs.packageFile !== undefined) {
      const globber = await createGlobber(inputs.packageFile, {
        implicitDescendants: false,
        matchDirectories: false,
      });
      for await (const packageFile of globber.globGenerator()) {
        yield* dependsTxt.parse(await readFile(packageFile, 'utf8'));
      }
    }
  }
  const packages = [];
  for await (const { name } of loadDependsTxts()) {
    packages.push(name);
  }
  return new Set(packages.sort());
}

async function resolveVersion(
  inputs: Pick<Inputs, 'version'>,
): Promise<Version> {
  const { latest } = ReleaseData.use();
  const version = inputs.version === 'latest'
    ? latest.version
    : Version.parse(inputs.version);
  if (version < '2008') {
    throw new RangeError('Versions prior to 2008 are not supported');
  }
  if (platform() === 'darwin' && version < '2013') {
    throw new RangeError(
      'Versions prior to 2013 does not work on 64-bit macOS',
    );
  }
  if (version > latest.version) {
    throw new RangeError(`${version} is not a valid version`);
  }
  return version;
}
