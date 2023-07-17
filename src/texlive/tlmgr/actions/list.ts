import { readFile } from 'node:fs/promises';
import path from 'node:path';

import * as log from '#/log';
import { use } from '#/texlive/tlmgr/internals';
import { type Tlpobj, tlpdb } from '#/texlive/tlpkg';

const RE = {
  nonPackage: /(?:^(?:collection|scheme)-|\.)/u,
  version: /^catalogue-version\s+(.*)$/mu,
  revision: /^revision\s+(\d+)\s*$/mu,
} as const;

/**
 * Lists packages by reading `texlive.tlpdb` directly
 * instead of running `tlmgr list`.
 */
export async function* list(): AsyncGenerator<Tlpobj, void, void> {
  const tlpdbPath = path.join(use().TEXDIR, 'tlpkg', 'texlive.tlpdb');
  let db: string;
  try {
    db = await readFile(tlpdbPath, 'utf8');
  } catch (cause) {
    log.info(`Failed to read ${tlpdbPath}`, { cause });
    return;
  }
  try {
    for (const [name, data] of tlpdb.parse(db)) {
      if (name === 'texlive.infra' || !RE.nonPackage.test(name)) {
        const version = RE.version.exec(data)?.[1]?.trimEnd();
        const revision = RE.revision.exec(data)?.[1] ?? '';
        yield { name, version, revision };
      }
    }
  } catch (cause) {
    log.info(`Failed to parse ${tlpdbPath}`, { cause });
  }
}
