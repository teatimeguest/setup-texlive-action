import { use } from '#texlive/tlmgr/internals';

export async function version(): Promise<void> {
  await use().exec('version', undefined, { ignoreReturnCode: true });
}
