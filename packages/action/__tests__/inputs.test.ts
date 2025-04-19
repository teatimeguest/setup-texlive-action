import { describe, expect, it, vi } from 'vitest';

import * as path from 'node:path';

import * as inputs from '#action/inputs';

const env = globalThis.process.env;

vi.unmock('#action/inputs');

describe('cache', () => {
  it.each([true, false])('is set to %j', (input: boolean) => {
    vi.stubEnv('INPUT_CACHE', input.toString());
    expect(inputs.getCache()).toBe(input);
  });
});

describe('packageFile', () => {
  it('defaults to `undefined`', () => {
    expect(inputs.getPackageFile()).toBeUndefined();
  });

  it.each([
    ['.github/tl_packages', '.github/tl_packages'],
    [undefined, ''],
    [undefined, '\n  '],
  ])(
    'is set to %o with input %o',
    (value: string | undefined, input: string) => {
      vi.stubEnv('INPUT_PACKAGE-FILE', input);
      expect(inputs.getPackageFile()).toBe(value);
    },
  );
});

describe('packages', () => {
  it('defaults to `undefined`', () => {
    expect(inputs.getPackages()).toBeUndefined();
  });

  it.each([
    ['foo bar\n  baz', 'foo bar\n  baz\n'],
    [undefined, ''],
    [undefined, '\n  '],
  ])(
    'is set to %o with input %o',
    (value: string | undefined, input: string) => {
      vi.stubEnv('INPUT_PACKAGES', input);
      expect(inputs.getPackages()).toBe(value);
    },
  );
});

describe('prefix', () => {
  it('uses $RUNNRE_TEMP by default', () => {
    expect(inputs.getPrefix()).toBe(
      path.join(env.RUNNER_TEMP!, 'setup-texlive-action'),
    );
  });

  it('uses $TEXLIVE_INSTALL_PREFIX if set', () => {
    vi.stubEnv('TEXLIVE_INSTALL_PREFIX', '/usr/local');
    expect(inputs.getPrefix()).toBe(env.TEXLIVE_INSTALL_PREFIX);
  });

  it.each([
    '',
    '\n  ',
  ])('is set to the default value with input %o', (input: string) => {
    vi.stubEnv('INPUT_PREFIX', input);
    expect(inputs.getPrefix()).toBe(
      path.join(env.RUNNER_TEMP!, 'setup-texlive-action'),
    );
  });

  it.each([
    ['/usr/local', '\n/usr/local\n'],
    ['~/.local', '    ~/.local'],
  ])('is set to %o with input %o', (value: string, input: string) => {
    vi.stubEnv('INPUT_PREFIX', input);
    expect(inputs.getPrefix()).toBe(value);
  });

  it('prefers input over environment variable', () => {
    vi.stubEnv('TEXLIVE_INSTALL_PREFIX', '/usr/local');
    vi.stubEnv('INPUT_PREFIX', '~/.local');
    expect(inputs.getPrefix()).toBe(env['INPUT_PREFIX']);
  });
});

describe('texdir', () => {
  it('defaults to `undefined`', () => {
    expect(inputs.getTexdir()).toBeUndefined();
  });

  it.each([
    ['/usr/local/texlive', '\n/usr/local/texlive\n'],
    ['~/.local/texlive', '    ~/.local/texlive'],
    [undefined, ''],
    [undefined, '\n  '],
  ])(
    'is set to %o with input %o',
    (value: string | undefined, input: string) => {
      vi.stubEnv('INPUT_TEXDIR', input);
      expect(inputs.getTexdir()).toBe(value);
    },
  );
});

describe('tlcontrib', () => {
  it.each([true, false])('is set to %j', (input: boolean) => {
    vi.stubEnv('INPUT_TLCONTRIB', input.toString());
    expect(inputs.getTlcontrib()).toBe(input);
  });
});

describe('updateAllPackages', () => {
  it.each([true, false])('is set to %j', (input: boolean) => {
    vi.stubEnv('INPUT_UPDATE-ALL-PACKAGES', input.toString());
    expect(inputs.getUpdateAllPackages()).toBe(input);
  });
});

describe('repository', () => {
  it.each([
    'http://example.com/path/to/tlnet/',
    'https://somewhere.example.com/path/to/tlnet/',
  ])('accepts %s', (input: string) => {
    vi.stubEnv('INPUT_REPOSITORY', input);
    expect(inputs.getRepository()).toBeDefined();
  });

  it.each([
    'ftp://example.com/path/to/historic/',
    'rsync://example.com/path/to/historic/',
  ])('rejects %s', (input: string) => {
    vi.stubEnv('INPUT_REPOSITORY', input);
    expect(inputs.getRepository).toThrowError(TypeError);
  });

  it.each([
    [
      'http://example.com?foo&bar=1',
      'http://example.com/?foo&bar=1',
    ],
    [
      'https://somewhere.example.com/path/to/tlnet',
      'https://somewhere.example.com/path/to/tlnet/',
    ],
    [
      'https://example.com///path/to/tlnet//archive',
      'https://example.com/path/to/tlnet/',
    ],
    [
      'https://example.com/path/to//tlnet/tlpkg//',
      'https://example.com/path/to/tlnet/',
    ],
    [
      'http://example.com/path/to/tlnet/tlpkg//texlive.tlpdb',
      'http://example.com/path/to/tlnet/',
    ],
  ])('normalize URL', (input, result) => {
    vi.stubEnv('INPUT_REPOSITORY', input);
    expect(inputs.getRepository()).toHaveProperty('href', result);
  });
});

describe('version', () => {
  it('defaults to `undefined`', () => {
    expect(inputs.getVersion()).toBeUndefined();
  });

  it.each([
    ['2000', '2000'],
    ['2013', '2013'],
    ['latest', 'latest'],
    ['2023', '\n   2023   '],
    ['latest', 'latest\n'],
  ])('is set to %o with input %o', (value: string, input: string) => {
    vi.stubEnv('INPUT_VERSION', input.toString());
    expect(inputs.getVersion()).toBe(value);
  });

  it.each([
    '',
    '\n  ',
  ])('is set to the default value with input %o', (input: string) => {
    vi.stubEnv('INPUT_VERSION', input);
    expect(inputs.getVersion()).toBeUndefined();
  });
});
