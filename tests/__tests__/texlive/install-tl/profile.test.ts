import os from 'node:os';
import process from 'node:process';

import { Profile } from '#/texlive/install-tl/profile';

jest.unmock('#/texlive/install-tl/profile');

const opts = { prefix: '<prefix>' };

describe('selected_scheme', () => {
  it('uses scheme-infraonly by default', () => {
    const profile = new Profile(LATEST_VERSION, opts);
    expect(profile.selectedScheme).toBe('scheme-infraonly');
  });

  it.each(['2008', '2011', '2014'] as const)(
    'uses scheme-minimal for versions prior to 2016',
    (version) => {
      const profile = new Profile(version, opts);
      expect(profile.selectedScheme).toBe('scheme-minimal');
    },
  );
});

describe('system trees', () => {
  it('uses default directories', () => {
    const { TEXDIR, TEXMFLOCAL, TEXMFSYSCONFIG, TEXMFSYSVAR } = new Profile(
      LATEST_VERSION,
      opts,
    );
    expect(TEXDIR).toBe(`<prefix>/${LATEST_VERSION}`);
    expect(TEXMFLOCAL).toBe('<prefix>/texmf-local');
    expect(TEXMFSYSCONFIG).toBe(`<prefix>/${LATEST_VERSION}/texmf-config`);
    expect(TEXMFSYSVAR).toBe(`<prefix>/${LATEST_VERSION}/texmf-var`);
  });

  it('uses environment variables', () => {
    process.env = {
      TEXLIVE_INSTALL_TEXMFSYSCONFIG: '<TEXMFSYSCONFIG>',
      TEXLIVE_INSTALL_TEXMFLOCAL: '<TEXMFLOCAL>',
    } as object as NodeJS.ProcessEnv;
    const { TEXDIR, TEXMFLOCAL, TEXMFSYSCONFIG, TEXMFSYSVAR } = new Profile(
      LATEST_VERSION,
      opts,
    );
    expect(TEXDIR).toBe(`<prefix>/${LATEST_VERSION}`);
    expect(TEXMFLOCAL).toBe('<TEXMFLOCAL>');
    expect(TEXMFSYSCONFIG).toBe('<TEXMFSYSCONFIG>');
    expect(TEXMFSYSVAR).toBe(`<prefix>/${LATEST_VERSION}/texmf-var`);
  });

  it.each([
    [{}],
    [{ TEXLIVE_INSTALL_TEXMFSYSCONFIG: '<TEXMFSYSCONFIG>' }],
    [{ TEXLIVE_INSTALL_TEXMFLOCAL: '<TEXMFLOCAL>' }],
  ])('uses texdir', (env) => {
    process.env = env as NodeJS.ProcessEnv;
    const profile = new Profile(LATEST_VERSION, {
      ...opts,
      texdir: '<texdir>',
    });
    expect(profile.TEXDIR).toBe('<texdir>');
    expect(profile.TEXMFLOCAL).toBe('<texdir>/texmf-local');
    expect(profile.TEXMFSYSCONFIG).toBe('<texdir>/texmf-config');
    expect(profile.TEXMFSYSVAR).toBe('<texdir>/texmf-var');
  });
});

describe('user trees', () => {
  it('defaults to use system directories', () => {
    const profile = new Profile(LATEST_VERSION, opts);
    expect(profile.TEXMFHOME).toBe(profile.TEXMFLOCAL);
    expect(profile.TEXMFCONFIG).toBe(profile.TEXMFSYSCONFIG);
    expect(profile.TEXMFVAR).toBe(profile.TEXMFSYSVAR);
  });

  it('uses environment variables', () => {
    process.env = {
      TEXLIVE_INSTALL_TEXMFCONFIG: '<TEXMFCONFIG>',
    } as object as NodeJS.ProcessEnv;
    const profile = new Profile(LATEST_VERSION, opts);
    expect(profile.TEXMFCONFIG).toBe('<TEXMFCONFIG>');
  });

  it.each([
    [{}],
    [{ TEXLIVE_INSTALL_TEXMFCONFIG: '<TEXMFCONFIG>' }],
  ])('uses texuserdir', (env) => {
    process.env = env as NodeJS.ProcessEnv;
    const profile = new Profile(LATEST_VERSION, {
      ...opts,
      texuserdir: '<texuserdir>',
    });
    expect(profile.TEXMFHOME).toBe('<texuserdir>/texmf');
    expect(profile.TEXMFCONFIG).toBe('<texuserdir>/texmf-config');
    expect(profile.TEXMFVAR).toBe('<texuserdir>/texmf-var');
  });
});

describe('instopt_adjustrepo', () => {
  it('is set to false even for the latest version', () => {
    const profile = new Profile(LATEST_VERSION, opts);
    expect(profile.instopt.adjustrepo).toBe(false);
  });

  it.each(['2008', '2012', '2016', '2020'] as const)(
    'is set to false for an older version',
    (version) => {
      const profile = new Profile(version, opts);
      expect(profile.instopt.adjustrepo).toBe(false);
    },
  );
});

describe('toString', () => {
  it('does not emits Windows-only options on Linux', () => {
    jest.mocked(os.platform).mockReturnValue('linux');
    const profile = new Profile(LATEST_VERSION, opts).toString();
    expect(profile).not.toMatch('desktop_integration');
    expect(profile).not.toMatch('file_assocs');
  });

  it('emits Windows-only options on Windows', () => {
    jest.mocked(os.platform).mockReturnValue('win32');
    const profile = new Profile(LATEST_VERSION, opts).toString();
    expect(profile).toMatch(/^tlpdbopt_desktop_integration 0$/mu);
    expect(profile).toMatch(/^tlpdbopt_w32_multi_user 0$/mu);
  });

  it.each(['2009', '2012', '2015'] as const)(
    'uses old option names for an older version',
    (version) => {
      jest.mocked(os.platform).mockReturnValue('linux');
      const profile = new Profile(version, opts).toString();
      expect(profile).toMatch(/^option_/mu);
      expect(profile).not.toMatch(/^instopt_/mu);
      expect(profile).not.toMatch(/^tlpdbopt_/mu);
    },
  );

  it('converts boolean to number', () => {
    jest.mocked(os.platform).mockReturnValue('linux');
    const profile = new Profile(LATEST_VERSION, opts).toString();
    expect(profile).toMatch(/ [01]$/mu);
    expect(profile).not.toMatch(/ (?:true|false)$/mu);
  });
});
