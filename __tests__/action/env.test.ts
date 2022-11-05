import process from 'node:process';

import { Env } from '#/action/env';
import * as log from '#/log';
import { Version } from '#/texlive';

const v = (spec: unknown) => new Version(`${spec}`);

jest.mock('node:process', () => globalThis.process);

beforeEach(() => {
  process.env = {} as NodeJS.ProcessEnv;
});
jest.unmock('#/action/env');

describe('Env', () => {
  it('has some default values', () => {
    expect(Env.load(v`latest`)).toMatchObject({
      TEXLIVE_INSTALL_ENV_NOCHECK: '1',
      TEXLIVE_INSTALL_NO_WELCOME: '1',
      TEXLIVE_INSTALL_TEXMFCONFIG: `~/.local/texlive/${v`latest`}/texmf-config`,
      TEXLIVE_INSTALL_TEXMFVAR: `~/.local/texlive/${v`latest`}/texmf-var`,
      TEXLIVE_INSTALL_TEXMFHOME: '~/texmf',
    });
  });

  it('ignores some environment variables', () => {
    process.env['TEXLIVE_INSTALL_TEXDIR'] = '<texdir>';
    expect(Env.load(v`latest`)).not.toHaveProperty(
      'TEXLIVE_INSTALL_TEXDIR',
    );
    expect(process.env).not.toHaveProperty('TEXLIVE_INSTALL_TEXDIR');
    expect(log.warn).toHaveBeenCalledWith(
      '`TEXLIVE_INSTALL_TEXDIR` is set, but ignored',
    );
  });

  it('favors user settings over default values', () => {
    process.env['TEXLIVE_INSTALL_PREFIX'] = '<PREFIX>';
    process.env['NOPERLDOC'] = 'true';
    expect(Env.load(v`latest`)).toMatchObject({
      ['TEXLIVE_INSTALL_PREFIX']: '<PREFIX>',
      ['NOPERLDOC']: 'true',
    });
  });
});
