import { ExecError } from '@setup-texlive-action/utils';

import { use } from '#/texlive/tlmgr/internals';

export interface RepositoryConfig {
  readonly path: string;
  readonly tag: string | undefined;
}

export async function add(
  repo: string | Readonly<URL>,
  tag?: string,
): Promise<void> {
  const args = ['add', repo.toString()];
  if (tag !== undefined) {
    args.push(tag);
  }
  try {
    await use().exec('repository', args);
  } catch (error) {
    // `tlmgr repository add` returns non-zero status code
    // if the same repository or tag is added again.
    // (todo:  make sure that the tagged repo is really tlcontrib)
    if (
      !(
        error instanceof ExecError
        && error.stderr.includes('repository or its tag already defined')
      )
    ) {
      throw error;
    }
  }
}

export async function remove(repo: string | Readonly<URL>): Promise<void> {
  await use().exec('repository', ['remove', repo.toString()]);
}

export async function* list(): AsyncGenerator<RepositoryConfig, void, void> {
  const { stdout } = await use().exec('repository', ['list']);
  const re = /^\t(?<path>.+) \((?<tag>.+)\)$/v;
  for (const line of stdout.split(/\r?\n/v).slice(1)) {
    const found = re.exec(line)?.groups ?? {};
    yield {
      path: found['path'] ?? line.trim(),
      tag: found['tag'],
    };
  }
}
