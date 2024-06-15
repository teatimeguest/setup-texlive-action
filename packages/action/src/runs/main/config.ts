import { readFile } from 'node:fs/promises';
import { platform } from 'node:os';

import { create as createGlobber } from '@actions/glob';
import * as log from '@setup-texlive-action/logger';
import {
  ReleaseData,
  Version,
  acquire,
  dependsTxt,
  tlnet,
} from '@setup-texlive-action/texlive';

import * as env from '#action/env';
import * as inputs from '#action/inputs';

export interface Config {
  readonly cache: boolean;
  readonly packages: ReadonlySet<string>;
  readonly prefix: string;
  readonly repository: Readonly<URL> | undefined;
  readonly texdir: string | undefined;
  readonly tlcontrib: boolean;
  readonly updateAllPackages: boolean;
  readonly version: Version;
}

export namespace Config {
  export async function load(): Promise<Config> {
    env.init();
    const releases = await ReleaseData.setup();

    const repository = inputs.getRepository();
    if (
      repository !== undefined
      && !['http:', 'https:'].includes(repository.protocol)
    ) {
      const error = new TypeError(
        'Currently only http/https repositories are supported',
      );
      error['repository'] = repository;
      throw error;
    }
    const config = {
      cache: inputs.getCache(),
      packages: await collectPackages(),
      prefix: inputs.getPrefix(),
      repository,
      texdir: inputs.getTexdir(),
      tlcontrib: inputs.getTlcontrib(),
      updateAllPackages: inputs.getUpdateAllPackages(),
      version: await resolveVersion(inputs.getVersion(), repository),
    };

    if (config.repository !== undefined && config.version < '2012') {
      const error = new RangeError(
        'Currently `repository` input is only supported with version 2012 or later',
      );
      error['version'] = config.version;
      throw error;
    }

    if (config.version < releases.latest.version) {
      if (config.tlcontrib) {
        log.warn('TLContrib cannot be used with an older version of TeX Live');
        config.tlcontrib = false;
      }
      if (
        !(
          config.version < releases.previous.version
          && releases.newVersionReleased()
        ) && config.updateAllPackages
      ) {
        log.info('`update-all-packages` is ignored for older versions');
        config.updateAllPackages = false;
      }
    }

    return config;
  }
}

async function collectPackages(): Promise<Set<string>> {
  type Dependency = dependsTxt.Dependency;
  async function* loadDependsTxts(): AsyncGenerator<Dependency, void, void> {
    const input = inputs.getPackages();
    if (input !== undefined) {
      yield* dependsTxt.parse(input);
    }
    const pattern = inputs.getPackageFile();
    if (pattern !== undefined) {
      const globber = await createGlobber(pattern, {
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
  version: string | undefined,
  repository: Readonly<URL> | undefined,
): Promise<Version> {
  const { latest, next } = ReleaseData.use();
  if (version === undefined && repository !== undefined) {
    return await checkRemoteVersion(repository);
  }
  if (version === undefined || version === 'latest') {
    return latest.version;
  }
  if (Version.isVersion(version)) {
    if (version < '2008') {
      throw new RangeError('Versions prior to 2008 are not supported');
    }
    if (platform() === 'darwin' && version < '2013') {
      throw new RangeError(
        'Versions prior to 2013 does not work on 64-bit macOS',
      );
    }
    if (version <= next.version) {
      return version;
    }
  }
  throw new RangeError(`${version} is not a valid version`);
}

async function checkRemoteVersion(repository: Readonly<URL>): Promise<Version> {
  const { latest, next } = ReleaseData.use();
  const historic = /\/historic\/systems\/texlive\/(\d{4})\//v;
  const match = historic.exec(repository.pathname);
  if (Version.isVersion(match?.[1])) {
    return match[1];
  }
  log.info('Checking for remote version: %s', repository.href);
  const result = await Promise.all(
    [latest, next].map(async ({ version }) => {
      const headers = await tlnet.checkVersionFile(repository, version);
      return headers === undefined ? undefined : version;
    }),
  );
  const version = result.find(Boolean)
    ?? await acquire({ repository }).then(({ version }) => version);
  log.info('Remote version: %s', version);
  return version;
}
