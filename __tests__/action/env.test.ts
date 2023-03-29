import process from 'node:process';

import { init } from '#/action/env';
import * as log from '#/log';
import { Version } from '#/texlive';

const v = (spec: unknown) => new Version(`${spec}`);

jest.mock('node:process', () => globalThis.process);

beforeEach(() => {
  process.env = {} as NodeJS.ProcessEnv;
});
jest.unmock('#/action/env');

describe('init', () => {
  it('has some default values', () => {
    init(v`latest`);
    expect(process.env).toMatchObject({
      TEXLIVE_INSTALL_ENV_NOCHECK: '1',
      TEXLIVE_INSTALL_NO_WELCOME: '1',
      TEXLIVE_INSTALL_TEXMFCONFIG: `~/.local/texlive/${v`latest`}/texmf-config`,
      TEXLIVE_INSTALL_TEXMFVAR: `~/.local/texlive/${v`latest`}/texmf-var`,
      TEXLIVE_INSTALL_TEXMFHOME: '~/texmf',
    });
  });

  it('ignores some environment variables', () => {
    process.env['TEXLIVE_INSTALL_TEXDIR'] = '<texdir>';
    init(v`latest`);
    expect(process.env).not.toHaveProperty('TEXLIVE_INSTALL_TEXDIR');
    expect(log.warn).toHaveBeenCalledWith(
      '`TEXLIVE_INSTALL_TEXDIR` is set, but ignored',
    );
  });

  it('favors user settings over default values', () => {
    process.env['TEXLIVE_INSTALL_PREFIX'] = '<PREFIX>';
    process.env['NOPERLDOC'] = 'true';
    init(v`latest`);
    expect(process.env).toMatchObject({
      ['TEXLIVE_INSTALL_PREFIX']: '<PREFIX>',
      ['NOPERLDOC']: 'true',
    });
  });
});
