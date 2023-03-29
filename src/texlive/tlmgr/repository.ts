import type { Version } from '#/texlive/version';
import { ExecError, exec } from '#/util';

export class Repository {
  constructor({ version }: { readonly version: Version }) {
    if (version.number < 2012) {
      throw new RangeError(
        `\`repository\` action is not implemented in TeX Live ${version}`,
      );
    }
  }

  async add(
    this: void,
    repo: string | Readonly<URL>,
    tag?: string,
  ): Promise<void> {
    const args = ['repository', 'add', repo.toString()];
    if (tag !== undefined) {
      args.push(tag);
    }
    try {
      await exec('tlmgr', args);
    } catch (error) {
      if (
        !(
          // `tlmgr repository add` returns non-zero status code
          // if the same repository or tag is added again.
          // (todo:  make sure that the tagged repo is really tlcontrib)
          error instanceof ExecError
          && error.stderr.includes('repository or its tag already defined')
        )
      ) {
        throw error;
      }
    }
  }

  async remove(this: void, repo: string | Readonly<URL>): Promise<void> {
    await exec('tlmgr', ['repository', 'remove', repo.toString()]);
  }
}
