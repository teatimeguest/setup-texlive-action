import * as log from '#/log';
import type { IterableIterator } from '#/utility';

const RE = {
  comments: /\s*#.*$/gmu,
  hardOrSoft: /^\s*(?:(soft|hard)(?=\s|$))?(.*)$/gmu,
  packages: /^\s*package(?=\s|$)(.*)$/mu,
  whitespaces: /\s+/u,
};

export interface Dependency {
  readonly name: string;
  readonly type: 'hard' | 'soft';
  readonly package?: string | undefined;
}

export function* parse(input: string): Iterable<Dependency> {
  const [globals = '', ...rest] = input
    .replaceAll(RE.comments, '')
    .split(RE.packages);
  yield* parseDeps(undefined, globals);

  const iter: IterableIterator<string, undefined> = rest.values();
  for (const s of iter) {
    let packageName: string | undefined = s.trim();
    if (packageName === '' || RE.whitespaces.test(packageName)) {
      log.warn(
        '`package` directive must have exactly one argument, but given: '
          + JSON.stringify(packageName),
      );
      packageName = undefined;
    }
    yield* parseDeps(packageName, iter.next().value ?? '');
  }
}

function* parseDeps(
  packageName: string | undefined,
  input: string,
): Iterable<Dependency> {
  for (const [, type = 'hard', names = ''] of input.matchAll(RE.hardOrSoft)) {
    for (const name of names.split(RE.whitespaces).filter(Boolean)) {
      yield { name, type, package: packageName } as Dependency;
    }
  }
}
