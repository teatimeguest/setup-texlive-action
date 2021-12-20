import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { URL } from 'url';

import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as tool from '@actions/tool-cache';

import * as tl from '#/texlive';
import * as util from '#/utility';

/**
 * A class for downloading and running the installer of TeX Live.
 */
export class InstallTL {
  constructor(
    private readonly version: tl.Version,
    private readonly bin: string,
  ) {}

  async run(prefix: string): Promise<void> {
    const texdir = path.join(prefix, this.version);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const home = process.env['HOME']!;
    const userTexdir = path.join(home, '.local', 'texlive', this.version);
    const env = {
      ['TEXLIVE_INSTALL_ENV_NOCHECK']: 'true',
      ['TEXLIVE_INSTALL_NO_WELCOME']: 'true',
      ['TEXLIVE_INSTALL_TEXMFHOME']: path.join(home, 'texmf'),
      ['TEXLIVE_INSTALL_TEXMFCONFIG']: path.join(userTexdir, 'texmf-config'),
      ['TEXLIVE_INSTALL_TEXMFVAR']: path.join(userTexdir, 'texmf-var'),
      ...process.env,
    };
    const options = ['-no-gui', '-profile', await this.#profile(prefix)];

    if (this.version !== tl.LATEST_VERSION) {
      options.push(
        /**
         * Only version 2008 uses `-location` instead of `-repository`.
         */
        this.version === '2008' ? '-location' : '-repository',
        repository(this.version).href,
      );
    }

    await exec.exec(this.bin, options, { env });
    core.info('Applying patches');
    await patch(this.version, texdir);
  }

  async #profile(prefix: string): Promise<string> {
    const texdir = path.join(prefix, this.version);
    const local = path.join(prefix, 'texmf-local');
    const sysconfig = path.join(texdir, 'texmf-config');
    const sysvar = path.join(texdir, 'texmf-var');
    const adjustrepo = this.version === tl.LATEST_VERSION ? 1 : 0;
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
    const lines = [
      `TEXDIR ${texdir}`,
      `TEXMFLOCAL ${local}`,
      `TEXMFSYSCONFIG ${sysconfig}`,
      `TEXMFSYSVAR ${sysvar}`,
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
    ];

    core.info('Profile:\n> ' + lines.join('\n> '));

    const dest = path.join(
      await fs.mkdtemp(
        path.join(process.env['RUNNER_TEMP'] ?? os.tmpdir(), 'setup-texlive-'),
      ),
      'texlive.profile',
    );
    await fs.writeFile(dest, lines.join('\n'));
    core.debug(`${dest} created`);

    return dest;
  }
}

export namespace InstallTL {
  export async function download(version: tl.Version): Promise<InstallTL> {
    /**
     * - There is no `install-tl` for versions prior to 2005, and
     *   versions 2005--2007 do not seem to be archived.
     *
     * - Versions 2008--2012 can be installed on `macos-latest`, but
     *   do not work properly because the `kpsewhich aborts with "Bad CPU type." */
    if (Number(version) < (os.platform() === 'darwin' ? 2013 : 2008)) {
      throw new RangeError(
        `Installation of TeX Live ${version} on ${os.platform()} is not supported`,
      );
    }

    const target = `install-tl${
      os.platform() === 'win32' ? '.zip' : '-unx.tar.gz'
    }`;

    try {
      const cache = tool.find(target, version);
      if (cache !== '') {
        core.info('Found in cache');
        return new InstallTL(
          version,
          path.join(cache, executable(version, os.platform())),
        );
      }
    } catch (error) {
      core.info(`Failed to restore cache: ${error}`);
      if (error instanceof Error && error.stack !== undefined) {
        core.debug(error.stack);
      }
    }

    const url = new URL(target, repository(version)).href;
    core.info(`Downloading ${url}`);
    const archive = await tool.downloadTool(url);

    core.info('Extracting');
    let dest: string;

    if (os.platform() === 'win32') {
      const matched = await util.expand(
        path.join(await tool.extractZip(archive), 'install-tl*'),
      );
      if (matched.length !== 1) {
        core.debug(`Matched: ${matched}`);
        throw new Error('Unable to locate the installer');
      }
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      dest = matched[0]!;
    } else {
      dest = await tool.extractTar(archive, undefined, ['xz', '--strip=1']);
    }

    core.info('Applying patches');
    await patch(version, dest);

    try {
      core.info('Adding to the cache');
      await tool.cacheDir(dest, target, version);
    } catch (error) {
      core.info(`Failed to add to cache: ${error}`);
      if (error instanceof Error && error.stack !== undefined) {
        core.debug(error.stack);
      }
    }

    return new InstallTL(
      version,
      path.join(dest, executable(version, os.platform())),
    );
  }
}

/**
 * @returns The filename of the installer executable.
 */
function executable(version: tl.Version, platform: NodeJS.Platform): string {
  const ext = `${Number(version) > 2012 ? '-windows' : ''}.bat`;
  return `install-tl${platform === 'win32' ? ext : ''}`;
}

/**
 * Gets the URL of the main repository of TeX Live.
 *
 * @returns The `ctan` if the version is the latest, otherwise
 *   the URL of the historic archive on `https://ftp.math.utah.edu/pub/tex/`.
 *
 * @todo Use other archives as well.
 */
function repository(version: tl.Version): URL {
  const base =
    version === tl.LATEST_VERSION
      ? 'https://mirror.ctan.org/systems/texlive/'
      : `https://ftp.math.utah.edu/pub/tex/historic/systems/texlive/${version}/`;
  const tlnet = `tlnet${
    Number(version) < 2010 || version === tl.LATEST_VERSION ? '' : '-final'
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
 * Fixes bugs in the installer files and modify them for use in workflows.
 */
async function patch(version: tl.Version, texdir: string): Promise<void> {
  /**
   * Prevents `install-tl(-windows).bat` from being stopped by `pause`.
   */
  if (os.platform() === 'win32') {
    const target = path.join(texdir, executable(version, os.platform()));
    try {
      await util.updateFile(target, {
        search: /\bpause(?: Done)?\b/gmu,
        replace: '',
      });
    } catch (error) {
      if (!(util.isNodejsError(error) && error.code === 'ENOENT')) {
        throw error;
      }
      core.info(`${target} not found`);
    }
  }
  /**
   * Fixes a syntax error in `tlpkg/TeXLive/TLWinGoo.pm`.
   */
  if (['2009', '2010'].includes(version)) {
    await util.updateFile(
      path.join(texdir, 'tlpkg', 'TeXLive', 'TLWinGoo.pm'),
      {
        search: /foreach \$p qw\((.*)\)/u,
        replace: 'foreach $$p (qw($1))',
      },
    );
  }
  /**
   * Defines Code Page 65001 as an alias for UTF-8 on Windows.
   * @see {@link https://github.com/dankogai/p5-encode/issues/37}
   */
  if (os.platform() === 'win32' && version === '2015') {
    await util.updateFile(
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
    await util.updateFile(path.join(texdir, 'tlpkg', 'TeXLive', 'TLUtils.pm'), {
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
    await util.updateFile(
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
