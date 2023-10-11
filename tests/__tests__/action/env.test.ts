import process from 'node:process';

import * as core from '@actions/core';

import { init } from '#/action/env';

jest.unmock('#/action/env');

describe('init', () => {
  it('sets some default values', () => {
    init();
    expect(process.env).toMatchObject({
      TEXLIVE_INSTALL_ENV_NOCHECK: '1',
      TEXLIVE_INSTALL_NO_WELCOME: '1',
    });
  });

  it('ignores some environment variables', () => {
    process.env.TEXLIVE_INSTALL_TEXDIR = '<texdir>';
    init();
    expect(process.env).not.toHaveProperty('TEXLIVE_INSTALL_TEXDIR');
    expect(core.warning).toHaveBeenCalledOnce();
    expect(jest.mocked(core.warning).mock.calls[0]?.[0]).toMatchInlineSnapshot(
      `"\`TEXLIVE_INSTALL_TEXDIR\` is set, but ignored"`,
    );
  });

  it('favors user settings over default values', () => {
    process.env.TEXLIVE_INSTALL_PREFIX = '<PREFIX>';
    process.env.NOPERLDOC = 'true';
    init();
    expect(process.env).toMatchObject({
      TEXLIVE_INSTALL_PREFIX: '<PREFIX>',
      NOPERLDOC: 'true',
    });
  });
});
