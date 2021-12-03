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

export const CONTRIB = new URL(
  'https://mirror.ctan.org/systems/texlive/tlcontrib/',
);

export async function install(
  version: Version,
  prefix: string,
  platform: NodeJS.Platform = os.platform(),
): Promise<void> {
  /**
   * - There is no `install-tl` for versions prior to 2005, and
   *   versions 2005--2007 do not seem to be archived.
   *
   * - Versions 2008--2012 can be installed on `macos-latest`, but
   *   do not work properly because the `kpsewhich aborts with "Bad CPU type."
   */
  if (Number(version) < (platform === 'darwin' ? 2013 : 2008)) {
    throw new Error(
      `Installation of TeX Live ${version} on ${platform} is not supported`,
    );
  }
  await new InstallTL(version, prefix, platform).run();
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

  async install(packages: ReadonlyArray<string>): Promise<void> {
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

/**
 * A class for downloading and running the installer of TeX Live.
 */
class InstallTL {
  constructor(
    private readonly version: Version,
    private readonly prefix: string,
    private readonly platform: NodeJS.Platform,
  ) {}

  async run(): Promise<void> {
    const installtl = path.join(
      await this.#download(),
      InstallTL.executable(this.version, this.platform),
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
      await patch(this.version, this.platform, tlmgr.conf.texmf().texdir);
      await tlmgr.path.add();
    });
  }

  async #download(): Promise<string> {
    const target = `install-tl${
      this.platform === 'win32' ? '.zip' : '-unx.tar.gz'
    }`;
    return await core.group(`Acquiring ${target}`, async () => {
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

      if (this.platform === 'win32') {
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
      await patch(this.version, this.platform, dest);

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
    });
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
     * - `option_autobackup`, `option_doc`, and `option_src`
     *   already exist since version 2008.
     *
     * - `option_desktop_integration`, `option_file_assocs`, and
     *   `option_w32_multi_user` were first introduced in version 2009.
     *
     * - `option_adjustrepo` was first introduced in version 2011.
     *
     * - `option_menu_integration` was first introduced in version 2012 and
     *   removed in version 2017.
     *
     * - In version 2017, the option names have been changed, and
     *   new prefixes `instopt-` and `tlpdbopt-` have been introduced.
     *   The old option names are still valid in later versions.
     */
    const profile = [
      `TEXDIR ${texmf.texdir}`,
      `TEXMFLOCAL ${texmf.local}`,
      `TEXMFSYSCONFIG ${texmf.sysconfig}`,
      `TEXMFSYSVAR ${texmf.sysvar}`,
      `selected_scheme scheme-${scheme}`,
      `option_adjustrepo ${adjustrepo}`,    // instopt_adjustrepo
      'option_autobackup 0',                // tlpdbopt_autobackup
      'option_desktop_integration 0',       // tlpdbopt_desktop_integration
      'option_doc 0',                       // tlpdbopt_install_docfiles
      'option_file_assocs 0',               // tlpdbopt_file_assocs
      'option_menu_integration 0',
      'option_src 0',                       // tlpdbopt_install_srcfiles
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
async function patch(
  version: Version,
  platform: NodeJS.Platform,
  texdir: string,
): Promise<void> {
  /**
   * Prevents `install-tl(-windows).bat` from being stopped by `pause`.
   */
  if (platform === 'win32') {
    try {
      await updateFile(
        path.join(texdir, InstallTL.executable(version, platform)),
        (content) => content.replace(/\bpause(?: Done)?\b/gmu, ''),
      );
    } catch (error) {
      if ((error as { code?: string } | null)?.code !== 'ENOENT') {
        throw error;
      }
    }
  }
  /**
   * Fixes a syntax error in `tlpkg/TeXLive/TLWinGoo.pm`.
   */
  if (['2009', '2010'].includes(version)) {
    await updateFile(
      path.join(texdir, 'tlpkg', 'TeXLive', 'TLWinGoo.pm'),
      (content) => {
        return content.replace(
          /foreach \$p qw\((.*)\)/u,
          'foreach $$p (qw($1))',
        );
      },
    );
  }
  /**
   * Defines Code Page 65001 as an alias for UTF-8 on Windows.
   * @see {@link https://github.com/dankogai/p5-encode/issues/37}
   */
  if (platform === 'win32' && version === '2015') {
    await updateFile(
      path.join(texdir, 'tlpkg', 'tlperl', 'lib', 'Encode', 'Alias.pm'),
      (content) => {
        return content.replace(
          '# utf8 is blessed :)',
          `$&\n    define_alias(qr/cp65001/i => '"utf-8-strict"');`,
        );
      },
    );
  }
  /**
   * Makes it possible to use `\` as a directory separator on Windows.
   */
  if (platform === 'win32' && Number(version) < 2019) {
    await updateFile(
      path.join(texdir, 'tlpkg', 'TeXLive', 'TLUtils.pm'),
      (content) => {
        return content.replace(
          String.raw`split (/\//, $tree)`,
          String.raw`split (/[\/\\]/, $tree)`,
        );
      },
    );
  }
  /**
   * Adds support for macOS 11.x.
   */
  if (platform === 'darwin' && ['2017', '2018', '2019'].includes(version)) {
    await updateFile(
      path.join(texdir, 'tlpkg', 'TeXLive', 'TLUtils.pm'),
      (content) => {
        return content
          .replace(
            // prettier-ignore
            'if ($os_major != 10)',
            'if ($$os_major < 10)',
          )
          .replace(
            'if ($os_minor >= $mactex_darwin)',
            'if ($$os_major >= 11) { $$CPU = "x86_64"; $$OS = "darwin"; }\n    els$&',
          );
      },
    );
  }
}

/**
 * Updates the contents of a file.
 */
async function updateFile(
  filename: string,
  map: (content: string) => string,
): Promise<void> {
  await fs.writeFile(filename, map(await fs.readFile(filename, 'utf8')));
}

/**
 * Returns an array of paths that match the given glob pattern.
 */
async function expand(pattern: string): Promise<Array<string>> {
  const globber = await glob.create(pattern, { implicitDescendants: false });
  return await globber.glob();
}
