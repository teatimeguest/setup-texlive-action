import type { Buffer } from 'node:buffer';
import { readFile, writeFile } from 'node:fs/promises';
import { EOL, platform } from 'node:os';
import path from 'node:path';

import * as log from '#/log';
import type { Version } from '#/texlive/version';
import { exec } from '#/util';

interface Patch {
  readonly description: string;
  readonly platforms?: NodeJS.Platform;
  readonly versions?: { readonly since?: Version; readonly until?: Version };
  readonly file: string;
  readonly from: readonly (string | Readonly<RegExp>)[];
  readonly to: readonly string[];
}

const PATCHES: readonly Patch[] = [{
  description: 'Fixes a syntax error.',
  versions: { since: '2009', until: '2011' },
  file: 'tlpkg/TeXLive/TLWinGoo.pm',
  from: [/foreach \$p qw\((.*)\)/v],
  to: ['foreach $$p (qw($1))'],
}, {
  // See: https://github.com/dankogai/p5-encode/issues/37
  description: 'Defines Code Page 65001 as an alias for UTF-8 on Windows.',
  platforms: 'win32',
  versions: { since: '2015', until: '2016' },
  file: 'tlpkg/tlperl/lib/Encode/Alias.pm',
  from: ['# utf8 is blessed :)\n'],
  to: [`$&    define_alias(qr/cp65001/i => '"utf-8-strict"');\n`],
}, {
  description:
    'Makes it possible to use `\\` as a directory separator on Windows.',
  platforms: 'win32',
  versions: { until: '2019' },
  file: 'tlpkg/TeXLive/TLUtils.pm',
  from: ['split (/\\//, $tree)'],
  to: ['split (/[\\/\\\\]/, $$tree)'],
}, {
  description: 'Adds support for macOS 11 or later.',
  platforms: 'darwin',
  versions: { since: '2017', until: '2020' },
  file: 'tlpkg/TeXLive/TLUtils.pm',
  from: ['$os_major != 10', '$os_minor >= $mactex_darwin'],
  to: ['$$os_major < 10', '$$os_major > 10 || $&'],
}];

export async function patch(options: {
  readonly TEXMFROOT: string;
  readonly version: Version;
}): Promise<void> {
  const patches = PATCHES.filter((p) => {
    return (p.platforms === undefined || p.platforms === platform())
      && (p.versions?.since ?? '') <= options.version
      && options.version < (p.versions?.until ?? '9999');
  });

  if (patches.length > 0) {
    const diff = async (
      changed: Readonly<Buffer> | string,
      p: Patch,
    ): Promise<string[]> => {
      try {
        const { exitCode, stdout, stderr } = await exec('git', [
          'diff',
          '--no-index',
          `--color=${log.hasColors() ? 'always' : 'never'}`,
          '--',
          p.file,
          '-',
        ], {
          stdin: changed,
          cwd: options.TEXMFROOT,
          silent: true,
          ignoreReturnCode: true,
        });
        if (exitCode === 1) {
          return [log.styles.blue(p.description), stdout.trimEnd()];
        }
        if (exitCode > 1) {
          log.debug('git-diff exited with %d: %s', exitCode, stderr);
        }
      } catch (error) {
        log.debug({ error }, 'Failed to exec git-diff');
      }
      return [];
    };

    const apply = async (p: Patch): Promise<string[]> => {
      const target = path.join(options.TEXMFROOT, p.file);
      const content = p.from.reduce<string>(
        (s, from, i) => s.replace(from, p.to[i] ?? ''),
        await readFile(target, 'utf8'),
      );
      const changes = await diff(content, p);
      await writeFile(target, content);
      return changes;
    };

    log.info('Applying patches');
    const diffs = await Promise.all(patches.map((p) => apply(p)));
    log.info({ linePrefix: log.styles.blue`|` + ' ' }, diffs.flat().join(EOL));
  }
}
