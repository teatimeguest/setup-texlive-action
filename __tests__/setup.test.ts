import * as os from 'os';

import * as core from '@actions/core';

import * as context from '#/context';
import { InstallTL } from '#/install-tl';
import * as setup from '#/setup';
import { Manager } from '#/texlive';
import * as util from '#/utility';

jest.mock('os');
(os.arch as jest.Mock).mockReturnValue('<arch>');
(os.homedir as jest.Mock).mockReturnValue('~');
jest.mock('path', () => {
  const actual = jest.requireActual('path');
  return {
    join: jest.fn((...paths: Array<string>) => {
      return os.platform() === 'win32'
        ? actual.win32.join(...paths)
        : actual.posix.join(...paths);
    }),
  };
});
(core.group as jest.Mock).mockImplementation(
  async <T>(name: string, fn: () => Promise<T>): Promise<T> => await fn(),
);
(core.setFailed as jest.Mock).mockImplementation((error) => {
  throw new Error(`${error}`);
});
(context.loadConfig as jest.Mock).mockImplementation(async () => ({
  cache: true,
  packages: new Set([]),
  prefix:
    os.platform() === 'win32'
      ? 'C:\\TEMP\\setup-texlive'
      : '/tmp/setup-texlive',
  tlcontrib: false,
  version: '2021',
  env: {
    ['TEXLIVE_INSTALL_ENV_NOCHECK']: 'true',
    ['TEXLIVE_INSTALL_NO_WELCOME']: 'true',
    ['TEXLIVE_INSTALL_PREFIX']: '/tmp/setup-texlive',
    ['TEXLIVE_INSTALL_TEXMFHOME']: '~/texmf',
    ['TEXLIVE_INSTALL_TEXMFCONFIG']: '~/.local/texlive/2021/texmf-config',
    ['TEXLIVE_INSTALL_TEXMFVAR']: '~/.local/texlive/2021/texmf-var',
  },
}));
jest.mock('#/install-tl', () => {
  const actual = jest.requireActual('#/install-tl');
  return {
    Env: actual.Env,
    InstallTL: actual.InstallTL,
    Profile: actual.Profile,
  };
});
jest
  .spyOn(InstallTL, 'acquire')
  .mockImplementation(
    async (version) => new (InstallTL as any)(version, '<version>'),
  );
jest.spyOn(InstallTL.prototype, 'run').mockImplementation();
jest.mock('#/texlive', () => {
  const actual = jest.requireActual('#/texlive');
  return {
    contrib: actual.contrib,
    Manager: actual.Manager,
    Version: actual.Version,
  };
});
jest.spyOn(Manager.prototype, 'conf', 'get').mockReturnValue({
  texmf: jest.fn(async (key?: string, value?: string) => {
    if (key === undefined) {
      return new Map([
        ['TEXMFHOME', '<TEXMFHOME>'],
        ['TEXMFHCONFIG', '<TEXMFCONFIG>'],
        ['TEXMFVAR', '<TEXMFVAR>'],
      ]);
    }
    return value === undefined ? undefined : `<${key}>`;
  }) as any,
});
jest.spyOn(Manager.prototype, 'install').mockImplementation();
jest
  .spyOn(Manager.prototype, 'path', 'get')
  .mockReturnValue({ add: jest.fn() });
jest
  .spyOn(Manager.prototype, 'pinning', 'get')
  .mockReturnValue({ add: jest.fn() });
jest
  .spyOn(Manager.prototype, 'repository', 'get')
  .mockReturnValue({ add: jest.fn() });
jest.unmock('#/setup');

describe('main', () => {
  beforeAll(() => {
    (context.getPost as jest.Mock).mockReturnValueOnce(false);
  });

  it('sets up TeX Live on Linux', async () => {
    (os.platform as jest.Mock).mockReturnValue('linux');
    await setup.run();
    expect(util.restoreCache).toHaveBeenCalled();
    expect(InstallTL.acquire).toHaveBeenCalledWith('2021');
    expect(InstallTL.prototype.run).toHaveBeenCalled();
    expect(Manager.prototype.path.add).toHaveBeenCalled();
    expect(Manager.prototype.pinning.add).not.toHaveBeenCalled();
    expect(Manager.prototype.repository.add).not.toHaveBeenCalled();
    expect(Manager.prototype.install).not.toHaveBeenCalled();
    expect(context.setKey).toHaveBeenCalledWith(expect.anything());
    expect(context.setCacheHit).not.toHaveBeenCalled();
    expect(context.setPost).toHaveBeenCalled();
  });

  it('sets up TeX Live on Windows', async () => {
    (os.platform as jest.Mock).mockReturnValue('win32');
    await setup.run();
    expect(util.restoreCache).toHaveBeenCalled();
    expect(InstallTL.acquire).toHaveBeenCalledWith('2021');
    expect(InstallTL.prototype.run).toHaveBeenCalled();
    expect(Manager.prototype.path.add).toHaveBeenCalled();
    expect(Manager.prototype.pinning.add).not.toHaveBeenCalled();
    expect(Manager.prototype.repository.add).not.toHaveBeenCalled();
    expect(Manager.prototype.install).not.toHaveBeenCalled();
    expect(context.setKey).toHaveBeenCalledWith(expect.anything());
    expect(context.setCacheHit).not.toHaveBeenCalled();
    expect(context.setPost).toHaveBeenCalled();
  });

  it('sets up TeX Live on macOS', async () => {
    (os.platform as jest.Mock).mockReturnValue('darwin');
    await setup.run();
    expect(util.restoreCache).toHaveBeenCalled();
    expect(InstallTL.acquire).toHaveBeenCalledWith('2021');
    expect(InstallTL.prototype.run).toHaveBeenCalled();
    expect(Manager.prototype.path.add).toHaveBeenCalled();
    expect(Manager.prototype.pinning.add).not.toHaveBeenCalled();
    expect(Manager.prototype.repository.add).not.toHaveBeenCalled();
    expect(Manager.prototype.install).not.toHaveBeenCalled();
    expect(context.setKey).toHaveBeenCalledWith(expect.anything());
    expect(context.setCacheHit).not.toHaveBeenCalled();
    expect(context.setPost).toHaveBeenCalled();
  });

  it('sets up TeX Live with custom settings', async () => {
    (os.platform as jest.Mock).mockReturnValue('linux');
    (context.loadConfig as jest.Mock).mockResolvedValueOnce({
      cache: false,
      packages: new Set(['cleveref', 'hyperref', 'scheme-basic']),
      prefix: '/usr/local/texlive',
      tlcontrib: false,
      version: '2008',
      env: {
        ['TEXLIVE_INSTALL_ENV_NOCHECK']: 'true',
        ['TEXLIVE_INSTALL_NO_WELCOME']: 'true',
        ['TEXLIVE_INSTALL_PREFIX']: '/tmp/setup-texlive',
        ['TEXLIVE_INSTALL_TEXMFHOME']: '~/texmf',
        ['TEXLIVE_INSTALL_TEXMFCONFIG']: '~/.local/texlive/2021/texmf-config',
        ['TEXLIVE_INSTALL_TEXMFVAR']: '~/.local/texlive/2021/texmf-var',
      },
    });
    await setup.run();
    expect(util.restoreCache).not.toHaveBeenCalled();
    expect(InstallTL.acquire).toHaveBeenCalledWith('2008');
    expect(InstallTL.prototype.run).toHaveBeenCalled();
    expect(Manager.prototype.path.add).toHaveBeenCalled();
    expect(Manager.prototype.pinning.add).not.toHaveBeenCalled();
    expect(Manager.prototype.repository.add).not.toHaveBeenCalled();
    expect(Manager.prototype.install).toHaveBeenCalledWith(
      'cleveref',
      'hyperref',
      'scheme-basic',
    );
    expect(context.setKey).not.toHaveBeenCalledWith(expect.anything());
    expect(context.setCacheHit).not.toHaveBeenCalled();
    expect(context.setPost).toHaveBeenCalled();
  });

  it('sets up TeX Live with TLContrib', async () => {
    (os.platform as jest.Mock).mockReturnValue('linux');
    (context.loadConfig as jest.Mock).mockResolvedValueOnce({
      cache: true,
      packages: new Set([]),
      prefix: '/usr/local/texlive',
      tlcontrib: true,
      version: '2021',
      env: {
        ['TEXLIVE_INSTALL_ENV_NOCHECK']: 'true',
        ['TEXLIVE_INSTALL_NO_WELCOME']: 'true',
        ['TEXLIVE_INSTALL_PREFIX']: '/tmp/setup-texlive',
        ['TEXLIVE_INSTALL_TEXMFHOME']: '~/texmf',
        ['TEXLIVE_INSTALL_TEXMFCONFIG']: '~/.local/texlive/2021/texmf-config',
        ['TEXLIVE_INSTALL_TEXMFVAR']: '~/.local/texlive/2021/texmf-var',
      },
    });
    await setup.run();
    expect(util.restoreCache).toHaveBeenCalled();
    expect(InstallTL.prototype.run).toHaveBeenCalled();
    expect(Manager.prototype.path.add).toHaveBeenCalled();
    expect(Manager.prototype.pinning.add).toHaveBeenCalled();
    expect(Manager.prototype.repository.add).toHaveBeenCalled();
    expect(Manager.prototype.install).not.toHaveBeenCalled();
    expect(context.setKey).toHaveBeenCalledWith(expect.anything());
    expect(context.setCacheHit).not.toHaveBeenCalled();
    expect(context.setPost).toHaveBeenCalled();
  });

  it('sets up TeX Live with a system cache', async () => {
    (os.platform as jest.Mock).mockReturnValue('linux');
    (context.loadConfig as jest.Mock).mockResolvedValueOnce({
      cache: true,
      packages: new Set(['scheme-basic']),
      prefix: '/tmp/setup-texlive',
      tlcontrib: false,
      version: '2021',
      env: {
        ['TEXLIVE_INSTALL_ENV_NOCHECK']: 'true',
        ['TEXLIVE_INSTALL_NO_WELCOME']: 'true',
        ['TEXLIVE_INSTALL_PREFIX']: '/tmp/setup-texlive',
        ['TEXLIVE_INSTALL_TEXMFHOME']: '~/texmf',
        ['TEXLIVE_INSTALL_TEXMFCONFIG']: '~/.local/texlive/2021/texmf-config',
        ['TEXLIVE_INSTALL_TEXMFVAR']: '~/.local/texlive/2021/texmf-var',
      },
    });
    (util.restoreCache as jest.Mock).mockResolvedValueOnce('secondary');
    await setup.run();
    expect(util.restoreCache).toHaveBeenCalled();
    expect(InstallTL.acquire).not.toHaveBeenCalled();
    expect(Manager.prototype.path.add).toHaveBeenCalled();
    expect(Manager.prototype.pinning.add).not.toHaveBeenCalled();
    expect(Manager.prototype.repository.add).not.toHaveBeenCalled();
    expect(Manager.prototype.install).toHaveBeenCalledWith('scheme-basic');
    expect(context.setKey).toHaveBeenCalledWith(expect.anything());
    expect(context.setCacheHit).toHaveBeenCalled();
    expect(context.setPost).toHaveBeenCalled();
  });

  it('sets up TeX Live with a full cache', async () => {
    (os.platform as jest.Mock).mockReturnValue('linux');
    (context.loadConfig as jest.Mock).mockResolvedValueOnce({
      cache: true,
      packages: ['scheme-basic'],
      prefix: '/tmp/setup-texlive',
      tlcontrib: false,
      version: '2021',
      env: {
        ['TEXLIVE_INSTALL_ENV_NOCHECK']: 'true',
        ['TEXLIVE_INSTALL_NO_WELCOME']: 'true',
        ['TEXLIVE_INSTALL_PREFIX']: '/tmp/setup-texlive',
        ['TEXLIVE_INSTALL_TEXMFHOME']: '~/texmf',
        ['TEXLIVE_INSTALL_TEXMFCONFIG']: '~/.local/texlive/2021/texmf-config',
        ['TEXLIVE_INSTALL_TEXMFVAR']: '~/.local/texlive/2021/texmf-var',
      },
    });
    (util.restoreCache as jest.Mock).mockResolvedValueOnce('primary');
    await setup.run();
    expect(util.restoreCache).toHaveBeenCalled();
    expect(InstallTL.acquire).not.toHaveBeenCalled();
    expect(Manager.prototype.path.add).toHaveBeenCalled();
    expect(Manager.prototype.pinning.add).not.toHaveBeenCalled();
    expect(Manager.prototype.repository.add).not.toHaveBeenCalled();
    expect(Manager.prototype.install).not.toHaveBeenCalled();
    expect(context.setKey).not.toHaveBeenCalled();
    expect(context.setCacheHit).toHaveBeenCalled();
    expect(context.setPost).toHaveBeenCalled();
  });

  it('never sets the variables for a new installation', async () => {
    (os.platform as jest.Mock).mockReturnValue('linux');
    await setup.run();
    expect(core.group).not.toHaveBeenCalledWith(
      'Adjusting TEXMF',
      expect.anything(),
    );
  });

  it('sets the variables appropriately if necessary', async () => {
    (os.homedir as jest.Mock).mockReturnValueOnce('~');
    (os.platform as jest.Mock).mockReturnValue('linux');
    (util.restoreCache as jest.Mock).mockImplementationOnce(
      async (paths, primaryKey, restoreKeys) => restoreKeys?.[0] ?? '',
    );
    (Manager.prototype.conf.texmf as jest.Mock).mockResolvedValueOnce(
      new Map([
        ['TEXMFHOME', '~/.texlive'],
        ['TEXMFHCONFIG', '~/.local/texlive/2021/texmf-config'],
        ['TEXMFVAR', '/usr/local/texlive/2021/texmf-var'],
      ]),
    );
    await setup.run();
    expect(Manager.prototype.conf.texmf).toHaveBeenCalledWith(
      'TEXMFHOME',
      '~/texmf',
    );
    expect(Manager.prototype.conf.texmf).not.toHaveBeenCalledWith(
      'TEXMFHCONFIG',
      expect.anything(),
    );
    expect(Manager.prototype.conf.texmf).toHaveBeenCalledWith(
      'TEXMFVAR',
      '~/.local/texlive/2021/texmf-var',
    );
  });
});

describe('post', () => {
  beforeAll(() => {
    (os.platform as jest.Mock).mockReturnValue('linux');
    (context.getPost as jest.Mock).mockReturnValue(true);
  });

  it('saves `TEXDIR` if `key` is set', async () => {
    (context.getKey as jest.Mock).mockReturnValueOnce('<key>');
    await setup.run();
    expect(util.saveCache).toHaveBeenCalledWith(
      expect.arrayContaining([]),
      expect.anything(),
    );
  });

  it('does nothing if `key` is not set', async () => {
    (context.getKey as jest.Mock).mockReturnValueOnce(undefined);
    await setup.run();
    expect(util.saveCache).not.toHaveBeenCalled();
  });
});
