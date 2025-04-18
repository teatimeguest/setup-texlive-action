#!/usr/bin/env -S npx tsx
/**
 * @packageDocumentation
 *
 * Some packages have different names in CTAN and TeX Live, and
 * there is no one-to-one correspondence. For example,
 *
 * - There is an entry for [`xparse`](https://www.ctan.org/pkg/xparse) in CTAN,
 *   but in TeX Live it is distributed as part of `l3packages` bundle.
 *
 * - [`tikz`](https://www.ctan.org/pkg/tikz) is an alias of `pgf` in CTAN,
 *   but only `pgf` is the valid name in TeX Live.
 *
 * So, to use these packages, we need to do
 *
 * ```console
 * $ tlmgr install l3packages pgf
 * ```
 *
 * rather than
 *
 * ```console
 * $ tlmgr install xparse tikz
 * ```
 *
 * This script generates a name map from CTAN to TL
 * to find the appropriate package names for installation.
 * The relationship is retrieved from the following data:
 *
 * TL to CTAN:
 *   `catalogue` and `cataloguedata.alias` properties in
 *   [TLPDB](https://tug.org/svn/texlive/trunk/Master/tlpkg/doc/json-formats.txt).
 *
 * CTAN to TL:
 *   `texlive` property of the
 *   [CTAN API](https://www.ctan.org/help/json/2.0/pkg).
 */
import { execFileSync } from 'node:child_process';
import { mkdir, open, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { setTimeout } from 'node:timers/promises';

import { defineCommand, runMain } from 'citty';
import { consola } from 'consola';
import { colors } from 'consola/utils';
import type { TLPDB } from 'texlive-json-schemas/types';
import { parseTemplate } from 'url-template';

namespace JSONL {
  export function* parse<T = unknown>(
    text: string,
  ): Generator<T, undefined, void> {
    for (let line of text.split(/\r?\n/gv)) {
      line = line.trim();
      if (line.length > 0) {
        yield JSON.parse(line) as unknown as T;
      }
    }
  }
}

namespace ctan {
  export const MASTER_URL = new URL(
    'systems/texlive/tlnet/',
    'https://mirror.math.princeton.edu/pub/CTAN/',
  );

  export namespace api {
    const url = parseTemplate('https://ctan.org/json/2.0/{/endpoint*}');

    export interface Pkg {
      id: string;
      aliases?: { id: string }[];
      texlive?: string;
    }

    export type Packages = { key: string }[];

    export async function pkg(id: string): Promise<Pkg> {
      return await getJson<Pkg>(url.expand({ endpoint: ['pkg', id] }));
    }

    export async function packages(): Promise<Packages> {
      return await getJson<Packages>(url.expand({ endpoint: ['packages'] }));
    }

    async function getJson<T = unknown>(
      url: string | Readonly<URL>,
    ): Promise<T> {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`${res.url}: ${res.status} ${res.statusText}`);
      }
      return await res.json() as T;
    }
  }
}

class Packages {
  readonly #known = new Set<string>();
  readonly #map = new Map<string, string | Set<string>>();

  constructor(tlpdb: TLPDB) {
    for (const { name, catalogue, cataloguedata } of tlpdb['main']!.tlpkgs!) {
      if (catalogue !== undefined && catalogue !== null) {
        this.addAlias(catalogue, name);
      }
      for (const alias of cataloguedata?.alias?.split(/\s+/gv) ?? []) {
        if (alias.length > 0) {
          this.addAlias(alias, name);
        }
      }
      this.#known.add(name);
    }
  }

  addPkg(pkg: ctan.api.Pkg): void {
    const name = pkg.texlive ?? null;
    if (name !== null) {
      this.addAlias(pkg.id, name);
      for (const { id } of pkg.aliases ?? []) {
        this.addAlias(id, name);
      }
    } else {
      this.#known.add(pkg.id);
      for (const { id } of pkg.aliases ?? []) {
        this.#known.add(id);
      }
    }
  }

  addAlias(alias: string, name: string): void {
    this.#known.add(alias).add(name);
    if (alias !== name) {
      const aliases = this.#map.get(alias);
      if (aliases instanceof Set) {
        aliases.add(name);
      } else {
        this.#map.set(
          alias,
          aliases === undefined ? name : new Set([aliases, name]),
        );
      }
    }
  }

  known(name: string): boolean {
    return this.#known.has(name);
  }

  getMap(): object {
    return Object.fromEntries(
      Array
        .from(
          this.#map.entries(),
          ([key, value]) =>
            [key, (value instanceof Set) ? [...value].sort() : value] as const,
        )
        .sort(([lhs], [rhs]) => lhs > rhs ? 1 : -1),
    );
  }
}

const encoding = 'utf8';
const formatPath = (text: string) => colors.gray(colors.underline(text));
const raw = (text: string) => text;

async function loadOrGenerate<T = unknown>(
  jsonPath: string,
  generate: () => Promise<T>,
): Promise<T> {
  consola.info('Loading `%s`', path.basename(jsonPath));
  await using json = await open(jsonPath, 'a+');
  if ((await json.stat()).size !== 0) {
    consola.ready('Found %s', formatPath(jsonPath));
    return JSON.parse(await json.readFile({ encoding })) as T;
  }
  consola.start('Generating %s', formatPath(jsonPath));
  const data = await generate();
  await json.writeFile(JSON.stringify(data, undefined, 2)! + '\n', encoding);
  return data;
}

async function dumpTlpdb(buildDir: string): Promise<TLPDB> {
  return await loadOrGenerate(path.join(buildDir, 'tlpdb.json'), async () => {
    const args = [
      ['--repository', colors.magenta],
      [ctan.MASTER_URL.toString(), colors.cyan],
      ['dump-tlpdb', raw],
      ['--remote', colors.magenta],
      ['--json', colors.magenta],
    ] as const;
    consola.start(
      'Running %s %s _%s_ %s %s %s',
      colors.yellow('tlmgr'),
      ...args.map(([arg, fmt]) => fmt(arg)),
    );
    const stdout = execFileSync('tlmgr', args.map(([arg]) => arg), {
      stdio: ['ignore', 'pipe', 'inherit'],
      encoding,
      maxBuffer: 32 * 1024 * 1024, // 32mb
    });
    return JSON.parse(stdout) as TLPDB;
  });
}

async function getPackageList(buildDir: string): Promise<ctan.api.Packages> {
  return await loadOrGenerate<ctan.api.Packages>(
    path.join(buildDir, 'ctan-packages.json'),
    ctan.api.packages,
  );
}

interface Args {
  build: string;
  output: string;
}

async function generate(args: Readonly<Args>): Promise<void> {
  const generated = new Date().toISOString();
  if (await mkdir(args.build, { recursive: true }) !== undefined) {
    await writeFile(path.join(args.build, '.gitignore'), '*', encoding);
  }
  const packages = new Packages(await dumpTlpdb(args.build));

  const jsonlPath = path.join(args.build, 'ctan-packages.jsonl');
  consola.info('Opening `%s`', path.basename(jsonlPath));
  await using jsonl = await open(jsonlPath, 'a+');
  for (
    const pkg of JSONL.parse<ctan.api.Pkg>(await jsonl.readFile({ encoding }))
  ) {
    packages.addPkg(pkg);
  }

  const unknownPackages = (await getPackageList(args.build))
    .filter(({ key }) => !packages.known(key))
    .map(({ key }) => key)
    .sort();
  let index = 0;
  for (const id of unknownPackages) {
    const progress = colors.gray(`[${++index}/${unknownPackages.length}]`);
    consola.info('%s `%s`', progress, id);
    const pkg = await ctan.api.pkg(id);
    packages.addPkg(pkg);
    await jsonl.appendFile(JSON.stringify(pkg) + '\n', { encoding });
    await setTimeout(1000); // 1s
  }

  consola.info('Writing %s', formatPath(args.output));
  await mkdir(path.dirname(args.output), { recursive: true });
  const json = { toTL: packages.getMap(), generated };
  await writeFile(
    args.output,
    JSON.stringify(json, undefined, 2)! + '\n',
    encoding,
  );
  consola.log(
    '\nDone  %s package names recorded in %s',
    colors.green(Object.keys(json.toTL).length),
    colors.green(path.basename(args.output)),
  );
}

const main = defineCommand({
  meta: {
    name: path.basename(import.meta.filename),
    description: 'Generate a package-name map from CTAN to TeX Live',
  },
  args: {
    build: {
      type: 'string',
      description: 'Build directory path',
      default: 'build',
    },
    output: {
      alias: ['o'],
      type: 'string',
      description: 'Output file path',
      required: true,
    },
  },
  async run({ args }) {
    await generate(args);
  },
});

runMain(main);
