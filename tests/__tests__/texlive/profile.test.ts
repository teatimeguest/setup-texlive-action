import os from 'node:os';
import process from 'node:process';

import { Profile } from '#/texlive/profile';
import { Version } from '#/texlive/version';

jest.unmock('#/texlive/profile');

const v = (spec: unknown) => new Version(`${spec}`);

const defaultOpts = { version: v`latest`, prefix: '<prefix>' };

beforeEach(() => {
  process.env = {} as NodeJS.ProcessEnv;
});

describe('selected_scheme', () => {
  it('uses scheme-infraonly by default', () => {
    const profile = new Profile(defaultOpts);
    expect(profile.selected_scheme).toBe('scheme-infraonly');
  });

  it.each([v`2008`, v`2011`, v`2014`])(
    'uses scheme-minimal for versions prior to 2016',
    (version) => {
      const profile = new Profile({ ...defaultOpts, version });
      expect(profile.selected_scheme).toBe('scheme-minimal');
    },
  );
});

describe('system trees', () => {
  it.each([
    [{}],
    [{ TEXLIVE_INSTALL_TEXMFSYSCONFIG: '<TEXMFSYSCONFIG>' }],
  ])('uses default directories', (env) => {
    process.env = env as NodeJS.ProcessEnv;
    const { TEXDIR, TEXMFLOCAL, TEXMFSYSCONFIG, TEXMFSYSVAR } = new Profile(
      defaultOpts,
    );
    expect(TEXDIR).toBe(`<prefix>/${defaultOpts.version}`);
    expect(TEXMFLOCAL).toBe('<prefix>/texmf-local');
    expect(TEXMFSYSCONFIG).toBe(`<prefix>/${defaultOpts.version}/texmf-config`);
    expect(TEXMFSYSVAR).toBe(`<prefix>/${defaultOpts.version}/texmf-var`);
  });

  it('uses environment variables', () => {
    process.env = {
      TEXLIVE_INSTALL_TEXMFLOCAL: '<TEXMFLOCAL>',
    } as object as NodeJS.ProcessEnv;
    const profile = new Profile(defaultOpts);
    expect(profile.TEXMFLOCAL).toBe('<TEXMFLOCAL>');
  });

  it.each([
    [{}],
    [{ TEXLIVE_INSTALL_TEXMFSYSCONFIG: '<TEXMFSYSCONFIG>' }],
    [{ TEXLIVE_INSTALL_TEXMFLOCAL: '<TEXMFLOCAL>' }],
  ])('uses texdir', (env) => {
    process.env = env as NodeJS.ProcessEnv;
    const profile = new Profile({ ...defaultOpts, texdir: '<texdir>' });
    expect(profile.TEXDIR).toBe('<texdir>');
    expect(profile.TEXMFLOCAL).toBe('<texdir>/texmf-local');
    expect(profile.TEXMFSYSCONFIG).toBe('<texdir>/texmf-config');
    expect(profile.TEXMFSYSVAR).toBe('<texdir>/texmf-var');
  });
});

describe('user trees', () => {
  it('defaults to use system directories', () => {
    const profile = new Profile(defaultOpts);
    expect(profile.TEXMFHOME).toBe(profile.TEXMFLOCAL);
    expect(profile.TEXMFCONFIG).toBe(profile.TEXMFSYSCONFIG);
    expect(profile.TEXMFVAR).toBe(profile.TEXMFSYSVAR);
  });

  it('uses environment variables', () => {
    process.env = {
      TEXLIVE_INSTALL_TEXMFCONFIG: '<TEXMFCONFIG>',
    } as object as NodeJS.ProcessEnv;
    const profile = new Profile(defaultOpts);
    expect(profile.TEXMFCONFIG).toBe('<TEXMFCONFIG>');
  });

  it.each([
    [{}],
    [{ TEXLIVE_INSTALL_TEXMFCONFIG: '<TEXMFCONFIG>' }],
  ])('uses texuserdir', (env) => {
    process.env = env as NodeJS.ProcessEnv;
    const profile = new Profile({ ...defaultOpts, texuserdir: '<texuserdir>' });
    expect(profile.TEXMFHOME).toBe('<texuserdir>/texmf');
    expect(profile.TEXMFCONFIG).toBe('<texuserdir>/texmf-config');
    expect(profile.TEXMFVAR).toBe('<texuserdir>/texmf-var');
  });
});

describe('instopt_adjustrepo', () => {
  it('is set to true for the latest version', () => {
    const profile = new Profile(defaultOpts);
    expect(profile.instopt_adjustrepo).toBe(true);
  });

  it.each([v`2008`, v`2012`, v`2016`, v`2020`])(
    'is set to false for an older version',
    (version) => {
      const profile = new Profile({ ...defaultOpts, version });
      expect(profile.instopt_adjustrepo).toBe(false);
    },
  );
});

describe('toString', () => {
  it('does not emits Windows-only options on Linux', () => {
    jest.mocked(os.platform).mockReturnValue('linux');
    const profile = new Profile(defaultOpts).toString();
    expect(profile).not.toMatch('desktop_integration');
    expect(profile).not.toMatch('file_assocs');
  });

  it('emits Windows-only options on Windows', () => {
    jest.mocked(os.platform).mockReturnValue('win32');
    const profile = new Profile(defaultOpts).toString();
    expect(profile).toMatch(/^tlpdbopt_desktop_integration 0$/mu);
    expect(profile).toMatch(/^tlpdbopt_w32_multi_user 0$/mu);
  });

  it.each([v`2009`, v`2012`, v`2015`])(
    'uses old option names for an older version',
    (version) => {
      jest.mocked(os.platform).mockReturnValue('linux');
      const profile = new Profile({ ...defaultOpts, version }).toString();
      expect(profile).toMatch(/^option_/mu);
      expect(profile).not.toMatch(/^instopt_/mu);
      expect(profile).not.toMatch(/^tlpdbopt_/mu);
    },
  );

  it('converts boolean to number', () => {
    jest.mocked(os.platform).mockReturnValue('linux');
    const profile = new Profile(defaultOpts).toString();
    expect(profile).toMatch(/ [01]$/mu);
    expect(profile).not.toMatch(/ (?:true|false)$/mu);
  });
});

describe('open', () => {
  it('yields file path only once', async () => {
    jest.mocked(os.platform).mockReturnValue('linux');
    const profile = new Profile(defaultOpts);
    for await (const dest of profile.open()) {
      expect(dest).pass('');
    }
    expect.assertions(1);
  });
});
