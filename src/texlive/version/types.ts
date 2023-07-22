import semver from 'semver';

export type Version =
  | `200${8 | 9}`
  | `20${1 | 2}${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`;

export namespace Version {
  const RE = /^199[6-9]|20[0-2]\d$/u;

  export function isVersion(spec: unknown): spec is Version {
    return typeof spec === 'string' && RE.test(spec);
  }

  export function parse(spec: string): Version {
    if (!isVersion(spec)) {
      throw new TypeError(`\`${spec}\` is not a valid version spec`);
    }
    return spec;
  }

  function coerce(version: Version): `${Version}.0.0` {
    return `${version}.0.0`;
  }

  export function satisfies(
    version: Version,
    /* eslint-disable-next-line
      @typescript-eslint/prefer-readonly-parameter-types */
    range: string | Readonly<semver.Range>,
  ): boolean {
    return semver.satisfies(coerce(version), range);
  }
}
