import { getExecOutput } from '@actions/exec';

import type { Version } from '#/texlive/version';

export class Repository {
  constructor({ version }: { readonly version: Version }) {
    if (version.number < 2012) {
      throw new RangeError(
        `\`repository\` action is not implemented in TeX Live ${version}`,
      );
    }
  }

  async add(this: void, repo: string, tag?: string): Promise<void> {
    const args = ['repository', 'add', repo];
    if (tag !== undefined) {
      args.push(tag);
    }
    const { exitCode, stderr } = await getExecOutput('tlmgr', args, {
      ignoreReturnCode: true,
    });
    if (
      // `tlmgr repository add` returns non-zero status code
      // if the same repository or tag is added again.
      // (todo:  make sure that the tagged repo is really tlcontrib)
      exitCode !== 0
      && !stderr.includes('repository or its tag already defined')
    ) {
      throw new Error(`tlmgr exited with ${exitCode}: ${stderr}`);
    }
  }
}
