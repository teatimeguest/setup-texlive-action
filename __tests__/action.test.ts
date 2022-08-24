import * as core from '@actions/core';
import 'jest-extended';
import type { DeepWritable } from 'ts-essentials';

import * as action from '#/action';
import { Env, Inputs, Outputs, State } from '#/context';
import { InstallTL, Profile } from '#/install-tl';
import { Tlmgr, Version } from '#/texlive';
import * as util from '#/utility';
import CacheType = util.CacheType;

jest.mock(
  'os',
  () => ({
    arch: jest.fn().mockReturnValue('<arch>'),
    platform: jest.fn().mockReturnValue('<platform>'),
  }),
);

jest.mocked(core.group).mockImplementation(async (name, fn) => await fn());
jest.mocked(core.setFailed).mockImplementation((error) => {
  throw new Error(`${error}`);
});

jest.mock('#/texlive', () => {
  const { contrib, Version } = jest.requireActual('#/texlive');
  const mocks = jest.createMockFromModule<any>('#/texlive');
  mocks.Tlmgr.prototype = {
    conf: new mocks.Tlmgr.Conf(),
    install: jest.fn(),
    path: new mocks.Tlmgr.Path(),
    pinning: new mocks.Tlmgr.Pinning(),
    repository: new mocks.Tlmgr.Repository(),
    update: jest.fn(),
  };
  return { ...mocks, contrib, Version };
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
      updateAllPackages: false,
      version: Version.LATEST,
    },
    outputs: { set ['cache-hit'](hit: true) {} },
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
    .mocked(InstallTL.download)
    .mockResolvedValue(new (InstallTL as unknown as new() => InstallTL)());
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
  expect(Tlmgr.Path.prototype.add).toHaveBeenCalledAfter(
    // eslint-disable-next-line jest/unbound-method
    jest.mocked<(...args: Array<any>) => unknown>(InstallTL.prototype.run),
  );
});

it.each<[CacheType]>([['primary'], ['secondary']])(
  'adds TeX Live to path after cache restoration (case %s)',
  async (kind) => {
    jest.mocked(util.restoreCache).mockResolvedValueOnce(kind);
    await expect(action.run()).toResolve();
    expect(Tlmgr.Path.prototype.add).not.toHaveBeenCalledBefore(
      jest.mocked<(...args: Array<any>) => unknown>(util.restoreCache),
    );
    expect(Tlmgr.Path.prototype.add).toHaveBeenCalled();
  },
);

it.each([[true], [false]])(
  'does not update any TeX packages for new installation',
  async (input) => {
    ctx.inputs.updateAllPackages = input;
    await expect(action.run()).toResolve();
    expect(Tlmgr.prototype.update).not.toHaveBeenCalled();
  },
);

it.each<[CacheType]>([['primary'], ['secondary']])(
  'updates `tlmgr` when restoring cache (case %s)',
  async (kind) => {
    jest.mocked(util.restoreCache).mockResolvedValueOnce(kind);
    await expect(action.run()).toResolve();
    expect(Tlmgr.prototype.update).toHaveBeenCalledOnce();
    expect(Tlmgr.prototype.update).toHaveBeenCalledWith(undefined, {
      self: true,
    });
  },
);

it.each<[CacheType]>([['primary'], ['secondary']])(
  'updates all packages if `update-all-packages` is true (case %s)',
  async (kind) => {
    jest.mocked(util.restoreCache).mockResolvedValueOnce(kind);
    ctx.inputs.updateAllPackages = true;
    await expect(action.run()).toResolve();
    expect(Tlmgr.prototype.update).toHaveBeenCalledTimes(2);
    expect(Tlmgr.prototype.update).toHaveBeenCalledWith(undefined, {
      all: true,
      reinstallForciblyRemoved: true,
    });
  },
);

it.each<[CacheType, Version]>([
  ['primary', '2008'],
  ['secondary', '2011'],
  ['primary', '2014'],
  ['secondary', '2017'],
  ['primary', '2020'],
])('does not update any packages for older versions', async (kind, version) => {
  jest.mocked(util.restoreCache).mockResolvedValueOnce(kind);
  ctx.inputs.updateAllPackages = true;
  ctx.inputs.version = version;
  await expect(action.run()).toResolve();
  expect(Tlmgr.prototype.update).not.toHaveBeenCalled();
});

it('does nothing about TEXMF for new installation', async () => {
  await expect(action.run()).toResolve();
  expect(Tlmgr.Conf.prototype.texmf).not.toHaveBeenCalled();
});

it.each<[CacheType | undefined]>([['primary'], ['secondary'], [undefined]])(
  'may adjust TEXMF after adding TeX Live to path (case %s)',
  async (kind) => {
    jest.mocked(util.restoreCache).mockResolvedValueOnce(kind);
    await expect(action.run()).toResolve();
    expect(Tlmgr.Conf.prototype.texmf).not.toHaveBeenCalledBefore(
      // eslint-disable-next-line jest/unbound-method
      jest.mocked(Tlmgr.Path.prototype.add),
    );
  },
);

it.each<[CacheType]>([['primary'], ['secondary']])(
  'adjusts old settings if they are not appropriate (case %s)',
  async (kind) => {
    jest.mocked(util.restoreCache).mockResolvedValueOnce(kind);
    ctx.env.TEXLIVE_INSTALL_TEXMFHOME = '<new>';
    // eslint-disable-next-line jest/unbound-method
    const tlmgr = jest.mocked<any>(Tlmgr.Conf.prototype.texmf);
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
    // eslint-disable-next-line jest/unbound-method
    const tlmgr = jest.mocked<any>(Tlmgr.Conf.prototype.texmf);
    tlmgr.mockResolvedValue('<old>');
    await expect(action.run()).toResolve();
    expect(tlmgr).not.toHaveBeenCalledWith('TEXMFHOME', expect.anything());
    tlmgr.mockReset();
  },
);

it('does not setup tlcontrib by default', async () => {
  await expect(action.run()).toResolve();
  expect(Tlmgr.Repository.prototype.add).not.toHaveBeenCalled();
  expect(Tlmgr.Pinning.prototype.add).not.toHaveBeenCalled();
});

it('sets up tlcontrib if input tlcontrib is true', async () => {
  ctx.inputs.tlcontrib = true;
  await expect(action.run()).toResolve();
  const {
    Path: { prototype: path },
    Pinning: { prototype: pinning },
    Repository: { prototype: repository },
  } = Tlmgr;
  // eslint-disable-next-line jest/unbound-method
  expect(repository.add).not.toHaveBeenCalledBefore(jest.mocked(path.add));
  expect(repository.add).toHaveBeenCalledWith(expect.anything(), 'tlcontrib');
  expect(pinning.add).not.toHaveBeenCalledBefore(
    jest.mocked<(...args: Array<any>) => unknown>(repository.add),
  );
  expect(pinning.add).toHaveBeenCalledWith('tlcontrib', '*');
});

it('does not install any packages by default', async () => {
  await expect(action.run()).toResolve();
  expect(Tlmgr.prototype.install).not.toHaveBeenCalled();
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
    expect(Tlmgr.prototype.install).toHaveBeenCalled();
  },
);

it('saves TEXDIR to cache if cache key and texdir are set', async () => {
  // eslint-disable-next-line jest/unbound-method
  jest.mocked(State.load).mockImplementationOnce(
    () => ({ key: '<key>', texdir: '<texdir>', filled: () => true } as State),
  );
  await expect(action.run()).toResolve();
  expect(util.saveCache).toHaveBeenCalled();
});
