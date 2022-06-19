import * as core from '@actions/core';
import 'jest-extended';
import type { DeepWritable } from 'ts-essentials';

import * as action from '#/action';
import { Env, Inputs, Outputs, State } from '#/context';
import { InstallTL, Profile } from '#/install-tl';
import { Manager, Version } from '#/texlive';
import * as util from '#/utility';
import CacheType = util.CacheType;

jest.mock('os', () => ({
  arch: jest.fn().mockReturnValue('<arch>'),
  platform: jest.fn().mockReturnValue('<platform>'),
}));

jest.mocked(core.group).mockImplementation(async (name, fn) => await fn());
jest.mocked(core.setFailed).mockImplementation((error) => {
  throw new Error(`${error}`);
});

jest.mock('#/texlive', () => {
  const contrib = jest.requireActual('#/texlive').contrib;
  const tl = jest.createMockFromModule<any>('#/texlive');
  tl.Manager.prototype = {
    conf: { texmf: jest.fn().mockResolvedValue('') },
    install: jest.fn(),
    path: { add: jest.fn() },
    pinning: { add: jest.fn() },
    repository: { add: jest.fn() },
  };
  return { contrib, Manager: tl.Manager, Version: tl.Version };
});
let ctx: DeepWritable<{
  inputs: Inputs;
  outputs: Outputs;
  env: Env;
}>;
beforeEach(() => {
  ctx = {
    inputs: {
      cache: true,
      packages: Promise.resolve(new Set()),
      prefix: '',
      tlcontrib: false,
      version: Version.LATEST,
    },
    outputs: {
      set ['cache-hit'](hit: true) {},
    },
    env: {
      ['TEXLIVE_INSTALL_ENV_NOCHECK']: '',
      ['TEXLIVE_INSTALL_NO_WELCOME']: '',
      ['TEXLIVE_INSTALL_PREFIX']: '',
      ['TEXLIVE_INSTALL_TEXMFCONFIG']: '',
      ['TEXLIVE_INSTALL_TEXMFVAR']: '',
      ['TEXLIVE_INSTALL_TEXMFHOME']: '',
    },
  };
  jest.mocked(Env.get).mockReturnValue(ctx.env);
  jest.mocked(Inputs).mockReturnValue(ctx.inputs);
  jest.mocked(Outputs).mockReturnValue(ctx.outputs);
  jest.spyOn(ctx.outputs, 'cache-hit', 'set');
  jest // eslint-disable-next-line jest/unbound-method
    .mocked(InstallTL.acquire)
    .mockResolvedValue(new (InstallTL as unknown as new () => InstallTL)());
  jest.mocked(Profile).mockReturnValue({ TEXDIR: '' } as Profile);
});
// eslint-disable-next-line jest/unbound-method
jest.mocked(State.load).mockReturnValue(null);

jest.unmock('#/action');

it('installs TeX Live if cache not found', async () => {
  await expect(action.run()).toResolve();
  expect(util.restoreCache).toHaveBeenCalled();
  expect(InstallTL.prototype.run).toHaveBeenCalled();
});

it('does not use cache if input cache is false', async () => {
  ctx.inputs.cache = false;
  await expect(action.run()).toResolve();
  expect(util.restoreCache).not.toHaveBeenCalled();
});

it.each<[CacheType]>([['primary'], ['secondary']])(
  'restores cache if cache found (case %s)',
  async (kind) => {
    jest.mocked(util.restoreCache).mockResolvedValueOnce(kind);
    await expect(action.run()).toResolve();
    expect(InstallTL.prototype.run).not.toHaveBeenCalled();
  },
);

it.each<[CacheType | undefined]>([['secondary'], [undefined]])(
  'save data in state if full cache not found (case %s)',
  async (kind) => {
    jest.mocked(util.restoreCache).mockResolvedValueOnce(kind);
    await expect(action.run()).toResolve();
    expect(State.prototype.save).toHaveBeenCalled();
    const mock = jest.mocked(State).mock;
    expect(mock.instances).toHaveLength(1);
    expect(mock.instances[0]).toHaveProperty(
      'key',
      expect.stringMatching(/^setup-texlive-[^-]+-[^-]+-\d{4}-\w{64}$/u),
    );
    expect(mock.instances[0]).toHaveProperty('texdir', expect.any(String));
  },
);

it('does not save data if full cache found', async () => {
  jest.mocked(util.restoreCache).mockResolvedValueOnce('primary');
  await expect(action.run()).toResolve();
  expect(State.prototype.save).toHaveBeenCalled();
  const mock = jest.mocked(State).mock;
  expect(mock.instances).toHaveLength(1);
  expect(mock.instances[0]).not.toHaveProperty('key');
  expect(mock.instances[0]).not.toHaveProperty('texdir');
});

it('does not set cache-hit if cache not found', async () => {
  await expect(action.run()).toResolve();
  expect(jest.spyOn(ctx.outputs, 'cache-hit', 'set')).not.toHaveBeenCalled();
});

it.each<[CacheType]>([['primary'], ['secondary']])(
  'sets cache-hit to true if full cache found (case %s)',
  async (kind) => {
    jest.mocked(util.restoreCache).mockResolvedValueOnce(kind);
    await expect(action.run()).toResolve();
    expect(jest.spyOn(ctx.outputs, 'cache-hit', 'set')).toHaveBeenCalled();
  },
);

it('adds TeX Live to path after installation', async () => {
  await expect(action.run()).toResolve();
  expect(Manager.prototype.path.add).toHaveBeenCalledAfter(
    // eslint-disable-next-line jest/unbound-method
    jest.mocked(InstallTL.prototype.run),
  );
});

it.each<[CacheType]>([['primary'], ['secondary']])(
  'adds TeX Live to path after cache restoration (case %s)',
  async (kind) => {
    jest.mocked(util.restoreCache).mockResolvedValueOnce(kind);
    await expect(action.run()).toResolve();
    expect(Manager.prototype.path.add).not.toHaveBeenCalledBefore(
      jest.mocked(util.restoreCache),
    );
    expect(Manager.prototype.path.add).toHaveBeenCalled();
  },
);

it('does nothing about TEXMF for new installation', async () => {
  await expect(action.run()).toResolve();
  expect(Manager.prototype.conf.texmf).not.toHaveBeenCalled();
});

it.each<[CacheType | undefined]>([['primary'], ['secondary'], [undefined]])(
  'may adjust TEXMF after adding TeX Live to path (case %s)',
  async (kind) => {
    jest.mocked(util.restoreCache).mockResolvedValueOnce(kind);
    await expect(action.run()).toResolve();
    expect(Manager.prototype.conf.texmf).not.toHaveBeenCalledBefore(
      jest.mocked(Manager.prototype.path.add),
    );
  },
);

it.each<[CacheType]>([['primary'], ['secondary']])(
  'adjusts old settings if they are not appropriate (case %s)',
  async (kind) => {
    jest.mocked(util.restoreCache).mockResolvedValueOnce(kind);
    ctx.env.TEXLIVE_INSTALL_TEXMFHOME = '<new>';
    const tlmgr = jest.mocked<any>(Manager.prototype.conf.texmf);
    tlmgr.mockResolvedValue('<old>');
    await expect(action.run()).toResolve();
    expect(tlmgr).toHaveBeenCalledWith('TEXMFHOME', '<new>');
    tlmgr.mockReset();
  },
);

it.each<[CacheType]>([['primary'], ['secondary']])(
  'does not modify old settings if not necessary (case %s)',
  async (kind) => {
    jest.mocked(util.restoreCache).mockResolvedValueOnce(kind);
    ctx.env.TEXLIVE_INSTALL_TEXMFHOME = '<old>';
    const tlmgr = jest.mocked<any>(Manager.prototype.conf.texmf);
    tlmgr.mockResolvedValue('<old>');
    await expect(action.run()).toResolve();
    expect(tlmgr).not.toHaveBeenCalledWith('TEXMFHOME', expect.anything());
    tlmgr.mockReset();
  },
);

it('does not setup tlcontrib by default', async () => {
  await expect(action.run()).toResolve();
  expect(Manager.prototype.repository.add).not.toHaveBeenCalled();
  expect(Manager.prototype.pinning.add).not.toHaveBeenCalled();
});

it('sets up tlcontrib if input tlcontrib is true', async () => {
  ctx.inputs.tlcontrib = true;
  await expect(action.run()).toResolve();
  const { path, pinning, repository } = Manager.prototype;
  expect(repository.add).not.toHaveBeenCalledBefore(jest.mocked(path.add));
  expect(repository.add).toHaveBeenCalledWith(expect.anything(), 'tlcontrib');
  expect(pinning.add).not.toHaveBeenCalledBefore(jest.mocked(repository.add));
  expect(pinning.add).toHaveBeenCalledWith('tlcontrib', '*');
});

it('does not install any packages by default', async () => {
  await expect(action.run()).toResolve();
  expect(Manager.prototype.install).not.toHaveBeenCalled();
});

it('does not install new packages if full cache found', async () => {
  jest.mocked(util.restoreCache).mockResolvedValueOnce('primary');
  await expect(action.run()).toResolve();
});

it.each<[CacheType | undefined]>([['secondary'], [undefined]])(
  'installs specified packages if full cache not found (case %s)',
  async (kind) => {
    jest.mocked(util.restoreCache).mockResolvedValueOnce(kind);
    ctx.inputs.packages = Promise.resolve(new Set(['foo', 'bar', 'baz']));
    await expect(action.run()).toResolve();
    expect(Manager.prototype.install).toHaveBeenCalled();
  },
);

it('saves TEXDIR to cache if cache key and texdir are set', async () => {
  // eslint-disable-next-line jest/unbound-method
  jest.mocked(State.load).mockImplementationOnce(
    () =>
      ({
        key: '<key>',
        texdir: '<texdir>',
        filled: () => true,
      } as State),
  );
  await expect(action.run()).toResolve();
  expect(util.saveCache).toHaveBeenCalled();
});
