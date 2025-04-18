import { readFile, writeFile } from 'node:fs/promises';
import { EOL } from 'node:os';
import * as path from 'node:path';

import { satisfies } from '@setup-texlive-action/data';
import patches from '@setup-texlive-action/data/tlpkg-patches.json' with {
  type: 'json',
};
import * as log from '@setup-texlive-action/logger';
import { exec } from '@setup-texlive-action/utils/exec';
import type { DeepReadonly } from 'ts-essentials';

import { Version } from '#texlive/version';

export async function patch(options: {
  readonly directory: string;
  readonly version: Version;
}): Promise<void> {
  const ps = patches.patches.filter((p) => satisfies(p, options));
  if (ps.length > 0) {
    log.info('Applying patches');
    const lines = await Promise.all(ps.map((p) => apply(p, options.directory)));
    log.info({ linePrefix: log.styles.blue`|` + ' ' }, lines.flat().join(EOL));
  }
}

type Patch = DeepReadonly<typeof patches.patches[number]>;

async function apply(
  { description, file, changes }: Patch,
  directory: string,
): Promise<string[]> {
  const diff = async (modified: string): Promise<string[]> => {
    try {
      const { exitCode, stdout, stderr } = await exec('git', [
        'diff',
        '--no-index',
        `--color=${log.hasColors() ? 'always' : 'never'}`,
        '--',
        file,
        '-',
      ], {
        stdin: modified,
        cwd: directory,
        silent: true,
        ignoreReturnCode: true,
      });
      if (exitCode === 1) {
        return [log.styles.blue(description), stdout.trimEnd()];
      }
      if (exitCode > 1) {
        log.debug('git-diff exited with %d: %s', exitCode, stderr);
      }
    } catch (error) {
      log.debug({ error }, 'Failed to exec git-diff');
    }
    return [];
  };

  const target = path.join(directory, file);
  let content = await readFile(target, 'utf8');
  for (const { from, to } of changes) {
    content = content.replace(new RegExp(from, 'v'), to);
  }
  const lines = await diff(content);
  await writeFile(target, content);
  return lines;
}
