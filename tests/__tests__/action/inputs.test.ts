import path from 'node:path';

import { Inputs } from '#/action/inputs';

jest.unmock('#/action/inputs');

describe('cache', () => {
  it('defaults to `true`', () => {
    expect(Inputs.load()).toHaveProperty('cache', true);
  });

  it.each([true, false])('is set to %p', (input: boolean) => {
    process.env['INPUT_CACHE'] = input.toString();
    expect(Inputs.load()).toHaveProperty('cache', input);
  });
});

describe('packageFile', () => {
  it('defaults to `undefined`', () => {
    expect(Inputs.load()).toHaveProperty('packageFile', undefined);
  });

  it.each([
    ['.github/tl_packages', '.github/tl_packages'],
    [undefined, ''],
    [undefined, '\n  '],
  ])(
    'is set to %p with input %p',
    (value: string | undefined, input: string) => {
      process.env['INPUT_PACKAGE-FILE'] = input;
      expect(Inputs.load()).toHaveProperty('packageFile', value);
    },
  );
});

describe('packages', () => {
  it('defaults to `undefined`', () => {
    expect(Inputs.load()).toHaveProperty('packages', undefined);
  });

  it.each([
    ['foo bar\n  baz', 'foo bar\n  baz\n'],
    [undefined, ''],
    [undefined, '\n  '],
  ])(
    'is set to %p with input %p',
    (value: string | undefined, input: string) => {
      process.env['INPUT_PACKAGES'] = input;
      expect(Inputs.load()).toHaveProperty('packages', value);
    },
  );
});

describe('prefix', () => {
  it('uses $RUNNRE_TEMP by default', () => {
    expect(Inputs.load()).toHaveProperty(
      'prefix',
      path.join(process.env.RUNNER_TEMP, 'setup-texlive'),
    );
  });

  it('uses $TEXLIVE_INSTALL_PREFIX if set', () => {
    process.env.TEXLIVE_INSTALL_PREFIX = '/usr/local';
    expect(Inputs.load()).toHaveProperty(
      'prefix',
      process.env.TEXLIVE_INSTALL_PREFIX,
    );
  });

  it.each([
    '',
    '\n  ',
  ])('is set to the default value with input %p', (input: string) => {
    process.env['INPUT_PREFIX'] = input;
    expect(Inputs.load()).toHaveProperty(
      'prefix',
      path.join(process.env.RUNNER_TEMP, 'setup-texlive'),
    );
  });

  it.each([
    ['/usr/local', '\n/usr/local\n'],
    ['~/.local', '    ~/.local'],
  ])('is set to %p with input %p', (value: string, input: string) => {
    process.env['INPUT_PREFIX'] = input;
    expect(Inputs.load()).toHaveProperty('prefix', value);
  });

  it('prefers input over environment variable', () => {
    process.env.TEXLIVE_INSTALL_PREFIX = '/usr/local';
    process.env['INPUT_PREFIX'] = '~/.local';
    expect(Inputs.load()).toHaveProperty('prefix', process.env['INPUT_PREFIX']);
  });
});

describe('texdir', () => {
  it('defaults to `undefined`', () => {
    expect(Inputs.load()).toHaveProperty('texdir', undefined);
  });

  it.each([
    ['/usr/local/texlive', '\n/usr/local/texlive\n'],
    ['~/.local/texlive', '    ~/.local/texlive'],
    [undefined, ''],
    [undefined, '\n  '],
  ])(
    'is set to %p with input %p',
    (value: string | undefined, input: string) => {
      process.env['INPUT_TEXDIR'] = input;
      expect(Inputs.load()).toHaveProperty('texdir', value);
    },
  );
});

describe('tlcontrib', () => {
  it('defaults to `false`', () => {
    expect(Inputs.load()).toHaveProperty('tlcontrib', false);
  });

  it.each([true, false])('is set to %p', (input: boolean) => {
    process.env['INPUT_TLCONTRIB'] = input.toString();
    expect(Inputs.load()).toHaveProperty('tlcontrib', input);
  });
});

describe('updateAllPackages', () => {
  it('defaults to `false`', () => {
    expect(Inputs.load()).toHaveProperty('updateAllPackages', false);
  });

  it.each([true, false])('is set to %p', (input: boolean) => {
    process.env['INPUT_UPDATE-ALL-PACKAGES'] = input.toString();
    expect(Inputs.load()).toHaveProperty('updateAllPackages', input);
  });
});

describe('version', () => {
  it('defaults to `latest`', () => {
    expect(Inputs.load()).toHaveProperty('version', 'latest');
  });

  it.each([
    ['2000', '2000'],
    ['2013', '2013'],
    ['latest', 'latest'],
    ['2023', '\n   2023   '],
    ['latest', 'latest\n'],
  ])('is set to %p with input %p', (value: string, input: string) => {
    process.env['INPUT_VERSION'] = input.toString();
    expect(Inputs.load()).toHaveProperty('version', value);
  });

  it.each([
    '',
    '\n  ',
  ])('is set to the default value with input %p', (input: string) => {
    process.env['INPUT_VERSION'] = input;
    expect(Inputs.load()).toHaveProperty('version', 'latest');
  });
});
