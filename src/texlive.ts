import * as path from 'path';
import { URL } from 'url';

import * as core from '@actions/core';
import * as exec from '@actions/exec';

import * as util from '#/utility';

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

/**
 * An interface for the `tlmgr` command.
 */
export class Manager {
  constructor(
    private readonly version: Version,
    private readonly prefix: string,
  ) {}

  async install(this: void, packages: ReadonlySet<string>): Promise<void> {
    if (packages.size !== 0) {
      await exec.exec('tlmgr', ['install', ...packages]);
    }
  }

  get path(): Readonly<{
    /**
     * Adds the bin directory of TeX Live directly to the PATH.
     * This method does not invoke `tlmgr path add`
     * to avoid to create symlinks in the system directory.
     *
     * @todo `install-tl -print-platform` and
     *   `tlmgr print-platform` may be useful.
     */
    add: () => Promise<void>;
  }> {
    return {
      add: async () => {
        const matched = await util.expand(
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
    /**
     * @returns `false` if the repository already exists, otherwise `true`.
     */
    add: (repo: string, tag?: string) => Promise<boolean>;
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
          ['repository', 'add', repo, ...(tag === undefined ? [] : [tag])],
          { ignoreReturnCode: true },
        );
        const success = exitCode === 0;
        if (
          /**
           * `tlmgr repository add` returns non-zero status code
           * if the same repository or tag is added again.
           *
           * @todo (Need to make sure that the tagged repo is really tlcontrib?)
           */
          !success &&
          !stderr.includes('repository or its tag already defined')
        ) {
          throw new Error(
            `\`tlmgr\` failed with exit code ${exitCode}: ${stderr}`,
          );
        }
        return success;
      },
    };
  }
}

export function contrib(): URL {
  return new URL('https://mirror.ctan.org/systems/texlive/tlcontrib/');
}
