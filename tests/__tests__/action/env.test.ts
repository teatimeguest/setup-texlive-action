import { homedir } from 'node:os';
import process from 'node:process';

import { init, setDefaultTexmfUserTrees } from '#/action/env';
import * as log from '#/log';

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
    expect(log.warn).toHaveBeenCalledWith(
      '`TEXLIVE_INSTALL_TEXDIR` is set, but ignored',
    );
  });

  it('favors user settings over default values', () => {
    process.env['TEXLIVE_INSTALL_PREFIX'] = '<PREFIX>';
    process.env['NOPERLDOC'] = 'true';
    init();
    expect(process.env).toMatchObject({
      TEXLIVE_INSTALL_PREFIX: '<PREFIX>',
      NOPERLDOC: 'true',
    });
  });
});

describe('setDefaultTexmfUserTrees', () => {
  it('sets default values', () => {
    const home = homedir();
    setDefaultTexmfUserTrees('2016');
    expect(process.env).toMatchObject({
      TEXLIVE_INSTALL_TEXMFHOME: `${home}/texmf`,
      TEXLIVE_INSTALL_TEXMFCONFIG: `${home}/.local/texlive/2016/texmf-config`,
      TEXLIVE_INSTALL_TEXMFVAR: `${home}/.local/texlive/2016/texmf-var`,
    });
  });
});
