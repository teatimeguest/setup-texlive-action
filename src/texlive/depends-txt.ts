import type { Writable } from 'ts-essentials';

import * as log from '#/log';
import type { IterableIterator } from '#/utility';

export class DependsTxt {
  private readonly bundle = new Map<
    DependsTxt.Entry[0],
    Writable<DependsTxt.Entry[1]>
  >();

  constructor(txt: string) {
    txt = txt.replaceAll(/\s*#.*$/gmu, ''); // remove comments
    for (const [name, deps] of DependsTxt.unbundle(txt)) {
      let module = this.bundle.get(name);
      if (module === undefined) {
        module = {};
        this.bundle.set(name, module);
      }
      for (const [type, dep] of deps) {
        (module[type] ??= new Set()).add(dep);
      }
    }
  }

  get(name: string): DependsTxt.Entry[1] | undefined {
    return this.bundle.get(name);
  }

  [Symbol.iterator](): Iterator<DependsTxt.Entry, void, void> {
    return this.bundle.entries();
  }

  private static *unbundle(
    txt: string,
  ): Iterable<[string, ReturnType<typeof this.parse>]> {
    const [globals, ...rest] = txt.split(/^\s*package(?=\s|$)(.*)$/mu);
    yield ['', this.parse(globals)];
    const iter: IterableIterator<string, undefined> = rest.values();
    for (let name of iter) {
      name = name.trim();
      if (name === '' || /\s/u.test(name)) {
        log.warn(
          '`package` directive must have exactly one argument, but given: '
            + name,
        );
        name = '';
      }
      yield [name, this.parse(iter.next().value)];
    }
  }

  private static *parse(
    this: void,
    txt?: string,
  ): Iterable<[DependsTxt.DependencyType, string]> {
    const hardOrSoft = /^\s*(?:(soft|hard)(?=\s|$))?(.*)$/gmu;
    for (const [, type = 'hard', deps] of txt?.matchAll(hardOrSoft) ?? []) {
      for (const dep of deps?.split(/\s+/u).filter(Boolean) ?? []) {
        yield [type as DependsTxt.DependencyType, dep];
      }
    }
  }
}

export namespace DependsTxt {
  export type DependencyType = 'hard' | 'soft';
  export type Entry = [
    string,
    { readonly [T in DependencyType]?: Set<string> },
  ];
}
