import { use } from '#/texlive/tlmgr/internals';

export async function add(
  repo: string,
  ...globs: readonly [string, ...Array<string>]
): Promise<void> {
  await use().exec('pinning', ['add', repo, ...globs]);
}
