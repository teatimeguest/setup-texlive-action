import * as path from 'node:path';
import { env } from 'node:process';

import { getBooleanInput, getInput } from '@actions/core';
import id from '@setup-texlive-action/utils/id';

export function getCache(): boolean {
  return getBoolean('cache');
}

export function getPackageFile(): string | undefined {
  return getString('package-file');
}

export function getPackages(): string | undefined {
  return getString('packages');
}

export function getPrefix(): string {
  let input = getString('prefix');
  input ??= env.TEXLIVE_INSTALL_PREFIX;
  input ??= path.join(env.RUNNER_TEMP!, id['kebab-case']);
  return path.normalize(input);
}

export function getRepository(): URL | undefined {
  const input = getInput('repository');
  if (input.length === 0) {
    return undefined;
  }
  let url: URL;
  try {
    url = new URL(input);
  } catch (cause) {
    throw new Error('Invalid input for repository', { cause });
  }
  // Normalize
  if (!url.pathname.endsWith('/')) {
    url.pathname = path.posix.join(url.pathname, '/');
  }
  return url;
}

export function getTexdir(): string | undefined {
  const input = getInput('texdir');
  return input.length === 0 ? undefined : path.normalize(input);
}

export function getTlcontrib(): boolean {
  return getBoolean('tlcontrib');
}

export function getUpdateAllPackages(): boolean {
  return getBoolean('update-all-packages');
}

export function getVersion(): string | undefined {
  return getString('version')?.trim().toLowerCase();
}

function getString(name: string): string | undefined {
  const input = getInput(name);
  return input.length === 0 ? undefined : input;
}

function getBoolean(name: string): boolean {
  try {
    return getBooleanInput(name);
  } catch (cause) {
    throw new Error(`Invalid input for \`${name}\``, { cause });
  }
}
