import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { URL } from 'url';

import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as glob from '@actions/glob';
import * as tool from '@actions/tool-cache';

// prettier-ignore
const VERSIONS = [
                                                  '1996', '1997', '1998', '1999',
  '2000', '2001', '2002', '2003', '2004', '2005', '2006', '2007', '2008', '2009',
  '2010', '2011', '2012', '2013', '2014', '2015', '2016', '2017', '2018', '2019',
  '2020', '2021',
] as const;

export type Version = typeof VERSIONS[number];

export function isVersion(version: string): version is Version {
  return VERSIONS.includes(version as Version);
}

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
export const LATEST_VERSION = VERSIONS[VERSIONS.length - 1]!;

export async function install(version: Version, prefix: string): Promise<void> {
  /**
   * - There is no `install-tl` for versions prior to 2005, and
   *   versions 2005--2007 do not seem to be archived.
   *
   * - Versions 2008--2012 can be installed on `macos-latest`, but
   *   do not work properly because the `kpsewhich aborts with "Bad CPU type."
   */
  if (Number(version) < (os.platform() === 'darwin' ? 2013 : 2008)) {
    throw new Error(
      `Installation of TeX Live ${version} on ${os.platform()} is not supported`,
    );
  }
  await new InstallTL(version, prefix).run();
}

export interface Texmf {
  readonly texdir: string;
  readonly local: string;
  readonly sysconfig: string;
  readonly sysvar: string;
}

/**
 * An interface for the `tlmgr` command.
 */
export class Manager {
  constructor(
    private readonly version: Version,
    private readonly prefix: string,
  ) {}

  get conf(): Readonly<{
    texmf: () => Texmf;
  }> {
    return {
      texmf: () => {
        const texdir = path.join(this.prefix, this.version);
        const local = path.join(this.prefix, 'texmf-local');
        const sysconfig = path.join(texdir, 'texmf-config');
        const sysvar = path.join(texdir, 'texmf-var');
        return { texdir, local, sysconfig, sysvar };
      },
    };
  }

  async install(this: void, packages: ReadonlyArray<string>): Promise<void> {
    if (packages.length !== 0) {
      await exec.exec('tlmgr', ['install', ...packages]);
    }
  }

  get path(): Readonly<{
    add: () => Promise<void>;
  }> {
    return {
      /**
       * Adds the bin directory of TeX Live directly to the PATH.
       * This method does not invoke `tlmgr path add`
       * to avoid to create symlinks in the system directory.
       *
       * @todo `install-tl -print-platform` and
       *   `tlmgr print-platform` may be useful.
       */
      add: async () => {
        const matched = await expand(
          path.join(this.prefix, this.version, 'bin', '*'),
        );
        if (matched.length !== 1) {
          core.debug(`Matched: ${matched}`);
          throw new Error('Unable to locate the bin directory');
        }
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        core.addPath(matched[0]!);
      },
    };
  }

  get pinning(): Readonly<{
    add: (
      repo: string,
      pattern: string,
      ...rest: ReadonlyArray<string>
    ) => Promise<void>;
  }> {
    if (Number(this.version) < 2013) {
      throw new Error(
        `\`pinning\` action is not implemented in TeX Live ${this.version}`,
      );
    }
    return {
      add: async (repo, pattern, ...rest) => {
        await exec.exec('tlmgr', ['pinning', 'add', repo, pattern, ...rest]);
      },
    };
  }

  get repository(): Readonly<{
    add: (repo: string, tag?: string) => Promise<void>;
  }> {
    if (Number(this.version) < 2012) {
      throw new Error(
        `\`repository\` action is not implemented in TeX Live ${this.version}`,
      );
    }
    return {
      add: async (repo, tag) => {
        const { exitCode, stderr } = await exec.getExecOutput(
          'tlmgr',
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          ['repository', 'add', repo, ...(Boolean(tag) ? [tag!] : [])],
          { ignoreReturnCode: true },
        );
        if (
          /**
           * `tlmgr repository add` returns non-zero status code
           * if the same repository or tag is added again.
           */
          exitCode !== 0 &&
          !stderr.includes('repository or its tag already defined')
        ) {
          throw new Error(
            `\`tlmgr\` failed with exit code ${exitCode}: ${stderr}`,
          );
        }
      },
    };
  }
}

/**
 * Gets the URL of the main repository of TeX Live.
 * Returns the `ctan` if the version is the latest, otherwise returns
 * the URL of the historic archive on `https://ftp.math.utah.edu/pub/tex/`.
 */
function repository(version: Version): URL {
  const base =
    version === LATEST_VERSION
      ? 'https://mirror.ctan.org/systems/texlive/'
      : `https://ftp.math.utah.edu/pub/tex/historic/systems/texlive/${version}/`;
  const tlnet = `tlnet${
    Number(version) < 2010 || version === LATEST_VERSION ? '' : '-final'
  }/`;
  const url = new URL(tlnet, base);
  /**
   * `install-tl` of versions prior to 2017 does not support HTTPS, and
   * that of version 2017 supports HTTPS but does not work properly.
   */
  if (Number(version) < 2018) {
    url.protocol = 'http';
  }
  return url;
}

export function tlcontrib(): URL {
  return new URL('https://mirror.ctan.org/systems/texlive/tlcontrib/');
}

/**
 * A class for downloading and running the installer of TeX Live.
 */
class InstallTL {
  constructor(
    private readonly version: Version,
    private readonly prefix: string,
  ) {}

  async run(): Promise<void> {
    const installtl = path.join(
      await core.group('Acquiring install-tl', async () => {
        return await this.#download();
      }),
      InstallTL.executable(this.version, os.platform()),
    );
    const env = { ...process.env, ['TEXLIVE_INSTALL_ENV_NOCHECK']: '1' };
    const options = ['-no-gui', '-profile', await this.#profile()];

    if (this.version !== LATEST_VERSION) {
      options.push(
        /**
         * Only version 2008 uses `-location` instead of `-repository`.
         */
        this.version === '2008' ? '-location' : '-repository',
        repository(this.version).href,
      );
    }

    await core.group('Installing TeX Live', async () => {
      await exec.exec(installtl, options, { env });
      const tlmgr = new Manager(this.version, this.prefix);
      core.info('Applying patches');
      await patch(this.version, tlmgr.conf.texmf().texdir);
      await tlmgr.path.add();
    });
  }

  async #download(): Promise<string> {
    const target = `install-tl${
      os.platform() === 'win32' ? '.zip' : '-unx.tar.gz'
    }`;

    try {
      const cache = tool.find(target, this.version);
      if (cache !== '') {
        core.info('Found in cache');
        return cache;
      }
    } catch (error) {
      core.info(`Failed to restore cache: ${error}`);
      if (error instanceof Error && error.stack !== undefined) {
        core.debug(error.stack);
      }
    }

    const url = new URL(target, repository(this.version)).href;
    core.info(`Downloading ${url}`);
    const archive = await tool.downloadTool(url);

    core.info('Extracting');
    let dest: string;

    if (os.platform() === 'win32') {
      const matched = await expand(
        path.join(await tool.extractZip(archive), 'install-tl*'),
      );
      if (matched.length !== 1) {
        core.debug(`Matched: ${matched}`);
        throw new Error('Unable to locate the installer path');
      }
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      dest = matched[0]!;
    } else {
      dest = await tool.extractTar(archive, undefined, ['xz', '--strip=1']);
    }

    core.info('Applying patches');
    await patch(this.version, dest);

    try {
      core.info('Adding to the cache');
      await tool.cacheDir(dest, target, this.version);
    } catch (error) {
      core.info(`Failed to add to cache: ${error}`);
      if (error instanceof Error && error.stack !== undefined) {
        core.debug(error.stack);
      }
    }

    return dest;
  }

  async #profile(): Promise<string> {
    const tlmgr = new Manager(this.version, this.prefix);
    const texmf = tlmgr.conf.texmf();
    const adjustrepo = this.version === LATEST_VERSION ? 1 : 0;
    /**
     * `scheme-infraonly` was first introduced in TeX Live 2016.
     */
    const scheme = Number(this.version) < 2016 ? 'minimal' : 'infraonly';
    // prettier-ignore
    /**
     * - `option_autobackup`, `option_doc`, `option_src`, and `option_symlinks`
     *   already exist since version 2008.
     *
     * - In version 2009, `option_desktop_integration`, `option_file_assocs`,
     *   and `option_w32_multi_user` were first introduced.
     *   Also, `option_symlinks` was renamed to `option_path`.
     *
     * - `option_adjustrepo` was first introduced in version 2011.
     *
     * - `option_menu_integration` was first introduced in version 2012 and
     *   removed in version 2017.
     *
     * - In version 2017, the option names have been changed, and
     *   new prefixes `instopt-` and `tlpdbopt-` have been introduced.
     *   Also, `option_path` and `option_symlinks` have been merged and
     *   `instopt_adjustpath` has been introduced.
     *   The old option names are still valid in later versions.
     */
    const profile = [
      `TEXDIR ${texmf.texdir}`,
      `TEXMFLOCAL ${texmf.local}`,
      `TEXMFSYSCONFIG ${texmf.sysconfig}`,
      `TEXMFSYSVAR ${texmf.sysvar}`,
      `selected_scheme scheme-${scheme}`,
      // Old name                           // Current name
      `option_adjustrepo ${adjustrepo}`,    // instopt_adjustrepo
      'option_autobackup 0',                // tlpdbopt_autobackup
      'option_desktop_integration 0',       // tlpdbopt_desktop_integration
      'option_doc 0',                       // tlpdbopt_install_docfiles
      'option_file_assocs 0',               // tlpdbopt_file_assocs
      'option_menu_integration 0',
      'option_path 0',                      // instopt_adjustpath
      'option_src 0',                       // tlpdbopt_install_srcfiles
      'option_symlinks 0',                  // instopt_adjustpath
      'option_w32_multi_user 0',            // tlpdbopt_w32_multi_user
    ].join('\n');

    await core.group('Profile', async () => {
      core.info(profile);
    });

    const dest = path.join(
      await fs.mkdtemp(
        path.join(process.env['RUNNER_TEMP'] ?? os.tmpdir(), 'setup-texlive-'),
      ),
      'texlive.profile',
    );
    await fs.writeFile(dest, profile);
    core.debug(`${dest} created`);
    return dest;
  }

  /**
   * Returns the filename of the installer executable.
   */
  static executable(version: Version, platform: NodeJS.Platform): string {
    const ext = `${Number(version) > 2012 ? '-windows' : ''}.bat`;
    return `install-tl${platform === 'win32' ? ext : ''}`;
  }
}

/**
 * Fixes bugs in the installer files and modify them for use in workflows.
 */
async function patch(version: Version, texdir: string): Promise<void> {
  /**
   * Prevents `install-tl(-windows).bat` from being stopped by `pause`.
   */
  if (os.platform() === 'win32') {
    try {
      await updateFile(
        path.join(texdir, InstallTL.executable(version, os.platform())),
        { search: /\bpause(?: Done)?\b/gmu, replace: '' },
      );
    } catch (error) {
      if (isNodejsError(error) && error.code !== 'ENOENT') {
        throw error;
      }
    }
  }
  /**
   * Fixes a syntax error in `tlpkg/TeXLive/TLWinGoo.pm`.
   */
  if (['2009', '2010'].includes(version)) {
    await updateFile(path.join(texdir, 'tlpkg', 'TeXLive', 'TLWinGoo.pm'), {
      search: /foreach \$p qw\((.*)\)/u,
      replace: 'foreach $$p (qw($1))',
    });
  }
  /**
   * Defines Code Page 65001 as an alias for UTF-8 on Windows.
   * @see {@link https://github.com/dankogai/p5-encode/issues/37}
   */
  if (os.platform() === 'win32' && version === '2015') {
    await updateFile(
      path.join(texdir, 'tlpkg', 'tlperl', 'lib', 'Encode', 'Alias.pm'),
      {
        search: '# utf8 is blessed :)',
        replace: `$&\n    define_alias(qr/cp65001/i => '"utf-8-strict"');`,
      },
    );
  }
  /**
   * Makes it possible to use `\` as a directory separator on Windows.
   */
  if (os.platform() === 'win32' && Number(version) < 2019) {
    await updateFile(path.join(texdir, 'tlpkg', 'TeXLive', 'TLUtils.pm'), {
      search: String.raw`split (/\//, $tree)`,
      replace: String.raw`split (/[\/\\]/, $tree)`,
    });
  }
  /**
   * Adds support for macOS 11.x.
   */
  if (
    os.platform() === 'darwin' &&
    ['2017', '2018', '2019'].includes(version)
  ) {
    await updateFile(
      path.join(texdir, 'tlpkg', 'TeXLive', 'TLUtils.pm'),
      { search: 'if ($os_major != 10)', replace: 'if ($$os_major < 10)' },
      {
        search: 'if ($os_minor >= $mactex_darwin)',
        replace:
          'if ($$os_major >= 11) { $$CPU = "x86_64"; $$OS = "darwin"; }\n    els$&',
      },
    );
  }
}

/**
 * Updates the contents of a file.
 */
async function updateFile(
  filename: string,
  ...replacements: ReadonlyArray<
    Readonly<{ search: string | RegExp; replace: string }>
  >
): Promise<void> {
  const content = await fs.readFile(filename, 'utf8');
  const updated = replacements.reduce(
    (str, { search, replace }) => str.replace(search, replace),
    content,
  );
  await fs.writeFile(filename, updated);
}

/**
 * Returns an array of paths that match the given glob pattern.
 */
async function expand(pattern: string): Promise<Array<string>> {
  const globber = await glob.create(pattern, { implicitDescendants: false });
  return await globber.glob();
}

/**
 * A type-guard for the error type of Node.js.
 * Since `NodeJS.ErrnoException` is defined as an interface,
 * we cannot write `error instanceof ErrnoException`.
 */
function isNodejsError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error;
}
