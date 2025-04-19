import { readFile } from 'node:fs/promises';
import { arch, platform } from 'node:os';

import { create as createGlobber } from '@actions/glob';
import * as log from '@setup-texlive-action/logger';
import {
  ReleaseData,
  Version,
  acquire,
  tlnet,
} from '@setup-texlive-action/texlive';
import { Event, ParseError, Parser } from 'depends-txt';

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
  function* parse(input: string): Generator<string, undefined, void> {
    for (const event of new Parser(input)) {
      switch (event.type) {
        case Event.Name:
          yield event.value;
          break;
        case Event.Error:
          log.warn(new ParseError(undefined, event.data.message).message);
          break;
        default:
          break;
      }
    }
  }
  const packages: string[] = [];
  const input = inputs.getPackages();
  if (input !== undefined) {
    log.info('Parsing `packages` input...');
    packages.push(...parse(input));
  }
  const pattern = inputs.getPackageFile();
  if (pattern !== undefined) {
    log.info('Looking for `package-file`...');
    const globber = await createGlobber(pattern, {
      implicitDescendants: false,
      matchDirectories: false,
    });
    let found = false;
    for await (const packageFile of globber.globGenerator()) {
      found = true;
      log.info('Parsing `%s`...', packageFile);
      packages.push(...parse(await readFile(packageFile, 'utf8')));
    }
    if (!found) {
      log.info('No file matched the pattern `package-file`');
    }
  }
  const packagesSet = new Set(packages.sort());
  if (input !== undefined || pattern !== undefined) {
    if (packagesSet.size > 0) {
      log.info('%d package(s) found:', packagesSet.size, ...packagesSet);
    } else {
      log.info('No packages found');
    }
  }
  return packagesSet;
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
    switch (platform()) {
      case 'linux':
        if (arch() === 'arm64' && version < '2017') {
          throw new RangeError(
            'Versions prior to 2017 does not support AArch64 Linux',
          );
        }
        break;
      case 'darwin':
        if (version < '2013') {
          throw new RangeError(
            'Versions prior to 2013 does not work on 64-bit macOS',
          );
        }
        break;
      default:
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
