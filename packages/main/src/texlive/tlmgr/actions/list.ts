import { readFile } from 'node:fs/promises';
import * as path from 'node:path';

import { P, match } from 'ts-pattern';

import * as log from '#/log';
import { use } from '#/texlive/tlmgr/internals';
import { type TLPObj, tlpdb } from '#/texlive/tlpkg';

/**
 * Lists packages by reading `texlive.tlpdb` directly
 * instead of running `tlmgr list`.
 */
export async function* list(): AsyncGenerator<TLPObj, void, void> {
  const tlpdbPath = path.join(use().TEXDIR, 'tlpkg', 'texlive.tlpdb');
  let db: string;
  try {
    db = await readFile(tlpdbPath, 'utf8');
  } catch (error) {
    log.info({ error }, 'Failed to read %s', tlpdbPath);
    return;
  }
  try {
    for (const [tag, data] of tlpdb.parse(db)) {
      if (
        tag === 'TLPOBJ' && match(data.name)
          .with('texlive.infra', () => true)
          .with(P.string.includes('.'), () => false) // platform-specific subpackage
          .with(P.string.startsWith('scheme-'), () => false)
          .with(P.string.startsWith('collection-'), () => false)
          .otherwise(() => true)
      ) {
        yield data;
      }
    }
  } catch (error) {
    log.info({ error }, 'Failed to parse %s', tlpdbPath);
  }
}
