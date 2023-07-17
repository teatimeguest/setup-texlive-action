export interface Tlpobj {
  readonly name: string;
  readonly version: string | undefined;
  readonly revision: string;
}

export function* parse(
  db: string,
): Generator<[name: string, data: string], void, void> {
  // dprint-ignore
  const iter = db
    .replaceAll(/\\\r?\n/gu, '') // Remove escaped line breaks
    .replaceAll(/#.*/gu, '')     // Remove comments
    .split(/^name\s(.*)$/gmu)    // Split into individual packages
    .values();
  iter.next(); // The first chunk should contain nothing.
  for (const name of iter) {
    const data = iter.next().value;
    yield [name.trimEnd(), data ?? ''];
  }
}
