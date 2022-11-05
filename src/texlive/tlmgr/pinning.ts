import { exec } from '@actions/exec';

import type { Version } from '#/texlive/version';

export class Pinning {
  constructor({ version }: { readonly version: Version }) {
    if (version.number < 2013) {
      throw new RangeError(
        `\`pinning\` action is not implemented in TeX Live ${version}`,
      );
    }
  }

  async add(
    this: void,
    repo: string,
    ...globs: readonly [string, ...Array<string>]
  ): Promise<void> {
    await exec('tlmgr', ['pinning', 'add', repo, ...globs]);
  }
}
