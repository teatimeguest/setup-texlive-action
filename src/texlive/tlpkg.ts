import { readFile, writeFile } from 'node:fs/promises';
import { platform } from 'node:os';
import path from 'node:path';

import * as log from '#/log';
import type { Version } from '#/texlive/version';
import { type ExecOutput, exec } from '#/util';

/**
 * Check tlpkg's logs to find problems.
 */
export function check(output: string | Readonly<ExecOutput>): void {
  const stderr = typeof output === 'string' ? output : output.stderr;
  // tlpkg/TeXLive/TLUtils.pm
  const result = /: checksums differ for (.*):$/mu.exec(stderr);
  if (result !== null) {
    const pkg = path.basename(result[1] ?? '', '.tar.xz');
    throw new Error(
      `The checksum of package ${pkg} did not match. `
        + 'The CTAN mirror may be in the process of synchronization, '
        + 'please rerun the job after some time.',
    );
  }
}

/**
 * Initialize TEXMFLOCAL just as the installer does.
 */
export async function makeLocalSkeleton(
  texmflocal: string,
  options: { readonly TEXDIR: string },
): Promise<void> {
  await exec('perl', [
    `-I${path.join(options.TEXDIR, 'tlpkg')}`,
    '-mTeXLive::TLUtils=make_local_skeleton',
    '-e',
    'make_local_skeleton shift',
    texmflocal,
  ]);
}

interface Patch {
  readonly description: string;
  readonly platforms?: NodeJS.Platform;
  readonly versions?: { readonly since?: number; readonly until?: number };
  readonly file: string;
  readonly from: ReadonlyArray<string | Readonly<RegExp>>;
  readonly to: ReadonlyArray<string>;
}

const PATCHES: ReadonlyArray<Patch> = [{
  description: 'Fixes a syntax error.',
  versions: { since: 2009, until: 2011 },
  file: 'tlpkg/TeXLive/TLWinGoo.pm',
  from: [/foreach \$p qw\((.*)\)/u],
  to: ['foreach $$p (qw($1))'],
}, {
  // See: https://github.com/dankogai/p5-encode/issues/37
  description: 'Defines Code Page 65001 as an alias for UTF-8 on Windows.',
  platforms: 'win32',
  versions: { since: 2015, until: 2016 },
  file: 'tlpkg/tlperl/lib/Encode/Alias.pm',
  from: ['# utf8 is blessed :)\n'],
  to: [`$&    define_alias(qr/cp65001/i => '"utf-8-strict"');\n`],
}, {
  description:
    'Makes it possible to use `\\` as a directory separator on Windows.',
  platforms: 'win32',
  versions: { until: 2019 },
  file: 'tlpkg/TeXLive/TLUtils.pm',
  from: ['split (/\\//, $tree)'],
  to: ['split (/[\\/\\\\]/, $$tree)'],
}, {
  description: 'Adds support for macOS 11 or later.',
  platforms: 'darwin',
  versions: { since: 2017, until: 2020 },
  file: 'tlpkg/TeXLive/TLUtils.pm',
  from: ['$os_major != 10', '$os_minor >= $mactex_darwin'],
  to: ['$$os_major < 10', '$$os_major > 10 || $&'],
}];

export async function patch(options: {
  readonly TEXDIR: string;
  readonly version: Version;
}): Promise<void> {
  const patches = PATCHES.filter((p) => {
    return (p.platforms === undefined || p.platforms === platform())
      && (p.versions?.since ?? -Infinity) <= options.version.number
      && options.version.number < (p.versions?.until ?? Infinity);
  });

  if (patches.length > 0) {
    const diff = async (
      changed: Readonly<Buffer> | string,
      p: Patch,
    ): Promise<ReadonlyArray<string>> => {
      try {
        const linePrefix = '\u001B[34m>\u001B[0m '; // chalk.blue('> ')
        const { exitCode, stdout, stderr } = await exec('git', [
          'diff',
          '--no-index',
          '--color',
          `--line-prefix=${linePrefix}`,
          '--',
          p.file,
          '-',
        ], {
          stdin: changed,
          cwd: options.TEXDIR,
          silent: true,
          ignoreReturnCode: true,
        });
        if (exitCode === 1) {
          return [linePrefix + p.description + '\n' + stdout.trimEnd()];
        }
        if (exitCode > 1) {
          log.debug(`git-diff exited with ${exitCode}: ${stderr}`);
        }
      } catch (cause) {
        log.debug('Failed to exec git-diff', { cause });
      }
      return [];
    };

    const apply = async (p: Patch): Promise<ReadonlyArray<string>> => {
      const target = path.join(options.TEXDIR, p.file);
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
    log.info(diffs.flat().join('\n'));
  }
}
