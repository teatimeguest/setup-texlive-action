import { env } from 'node:process';

import * as core from '@actions/core';

import { init } from '#/action/env';

vi.unmock('#/action/env');

describe('init', () => {
  it('sets some default values', () => {
    init();
    expect(env).toMatchObject({
      TEXLIVE_INSTALL_ENV_NOCHECK: '1',
      TEXLIVE_INSTALL_NO_WELCOME: '1',
    });
  });

  it('ignores some environment variables', () => {
    vi.stubEnv('TEXLIVE_INSTALL_TEXDIR', '<texdir>');
    init();
    expect(env).not.toHaveProperty('TEXLIVE_INSTALL_TEXDIR');
    expect(core.warning).toHaveBeenCalledOnce();
    expect(vi.mocked(core.warning).mock.calls[0]?.[0]).toMatchInlineSnapshot(
      '"`TEXLIVE_INSTALL_TEXDIR` is set, but ignored"',
    );
  });

  it('favors user settings over default values', () => {
    vi.stubEnv('TEXLIVE_INSTALL_PREFIX', '<PREFIX>');
    vi.stubEnv('NOPERLDOC', 'true');
    init();
    expect(env).toMatchObject({
      TEXLIVE_INSTALL_PREFIX: '<PREFIX>',
      NOPERLDOC: 'true',
    });
  });
});
