import { describe, expect, test } from 'vitest';

import tlpdb2008 from '@setup-texlive-action/fixtures/texlive.2008.tlpdb';
import tlpdb2023 from '@setup-texlive-action/fixtures/texlive.2023.tlpdb';

import { parse } from '#texlive/tlpkg/tlpdb';

const getLocation = (db: string): string | undefined => {
  for (const [tag, options] of parse(db)) {
    if (tag === 'TLOptions') {
      return options.location;
    }
  }
  return undefined;
};

const getVersion = (db: string): string | undefined => {
  for (const [tag, config] of parse(db)) {
    if (tag === 'TLConfig') {
      return config.release;
    }
  }
  return undefined;
};

describe('2008', () => {
  test('location', () => {
    expect(getLocation(tlpdb2008)).toMatchInlineSnapshot(
      `"http://ftp.math.utah.edu/pub/tex/historic/systems/texlive/2008/tlnet"`,
    );
  });

  test('version', () => {
    expect(getVersion(tlpdb2008)).toBe('2008');
  });
});

describe('2023', () => {
  test('location', () => {
    expect(getLocation(tlpdb2023)).toMatchInlineSnapshot(
      `"http://ftp.dante.de/tex-archive/systems/texlive/tlnet"`,
    );
  });

  test('version', () => {
    expect(getVersion(tlpdb2023)).toBe('2023');
  });
});
