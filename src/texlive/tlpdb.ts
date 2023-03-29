import type { IterableIterator } from '#/util';

export interface Tlpobj {
  readonly name: string;
  readonly version?: string | undefined;
  readonly revision: string;
}

export async function* parse(db: string): AsyncGenerator<Tlpobj, void, void> {
  const nonPackage = /(?:^(?:collection|scheme)-|\.)/u;
  const version = /^catalogue-version\s+(.*)$/mu;
  const revision = /^revision\s+(\d+)\s*$/mu;
  // dprint-ignore
  const iter: IterableIterator<string, undefined> = db
    .replaceAll(/\\\r?\n/gu, '') // Remove escaped line breaks
    .replaceAll(/#.*/gu, '')     // Remove comments
    .split(/^name\s(.*)$/gmu)    // Split into individual packages
    .values();
  iter.next(); // The first chunk should contain nothing.
  for (let name of iter) {
    name = name.trimEnd();
    const data = iter.next().value;
    if (name === 'texlive.infra' || !nonPackage.test(name)) {
      yield {
        name,
        version: data?.match(version)?.[1]?.trimEnd() ?? undefined,
        revision: data?.match(revision)?.[1] ?? '',
      };
    }
  }
}
