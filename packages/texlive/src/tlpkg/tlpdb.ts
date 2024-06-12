import type { TLPDBSINGLE, TLPOBJ } from 'texlive-json-schemas/types';

export interface TLPObj {
  name: TLPOBJ['name'];
  revision: string;
  cataloguedata?: {
    version?: NonNullable<TLPOBJ['cataloguedata']>['version'];
  };
}

export interface TLConfig
  extends Pick<NonNullable<TLPDBSINGLE['configs']>, 'release'>
{}

export interface TLOptions {
  location?: string;
}

const TAG = {
  TLPOBJ: 'TLPOBJ',
  TLConfig: 'TLConfig',
  TLOptions: 'TLOptions',
} as const;

export type Entry =
  | [typeof TAG.TLPOBJ, TLPObj]
  | [typeof TAG.TLConfig, TLConfig]
  | [typeof TAG.TLOptions, TLOptions];

const RE = {
  version: /^catalogue-version\s+(\S.*)$/mv,
  revision: /^revision\s+(\d+)\s*$/mv,
  location: /^depend\s+(?:opt_)?location:(.+)$/mv,
  release: /^depend\s+release\/(.+)$/mv,
} as const;

export function* parse(db: string): Generator<Entry, void, void> {
  for (const [name, data] of entries(db)) {
    if (
      name === '00texlive-installation.config'
      || name === '00texlive.installation'
    ) {
      if (name === '00texlive-installation.config') {
        yield [TAG.TLConfig, { release: '2008' }];
      }
      const location = RE.location.exec(data)?.[1];
      if (location !== undefined) {
        yield [TAG.TLOptions, { location }];
      }
    } else if (name === '00texlive.config') {
      const release = RE.release.exec(data)?.[1];
      if (release !== undefined) {
        yield [TAG.TLConfig, { release }];
      }
    } else if (!name.startsWith('00texlive')) {
      const version = RE.version.exec(data)?.[1]?.trimEnd();
      const revision = RE.revision.exec(data)?.[1] ?? '';
      yield [TAG.TLPOBJ, { name, revision, cataloguedata: { version } }];
    }
  }
}

function* entries(
  db: string,
): Generator<[name: string, data: string], void, void> {
  // dprint-ignore
  const iter = db
    .replaceAll(/\\\r?\n/gv, '') // Remove escaped line breaks
    .replaceAll(/#.*/gv, '')     // Remove comments
    .split(/^name\s(.*)$/mv)     // Split into individual packages
    .values();
  iter.next(); // The first chunk should contain nothing.
  for (const name of iter) {
    const data = iter.next().value;
    yield [name.trimEnd(), data ?? ''];
  }
}
