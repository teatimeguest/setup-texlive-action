import * as core from '@actions/core';
import type { DeepWritable } from 'ts-essentials';

import * as action from '#/action';
import { Inputs, Outputs, State } from '#/context';
import { InstallTL, Profile } from '#/install-tl';
import { Version } from '#/texlive';
import { Tlmgr } from '#/tlmgr';
import * as util from '#/utility';

const { Conf, Path, Pinning, Repository } = Tlmgr;

jest.unmock('#/action');

describe('main', () => {
  const v = (spec: unknown) => new Version(`${spec}`);

  const inputs = {} as DeepWritable<Inputs>;
  jest.mocked(Inputs.load).mockResolvedValue(inputs as unknown as Inputs);

  beforeEach(() => {
    inputs.cache = true;
    inputs.packages = new Set();
    inputs.texmf = { TEX_PREFIX: '' };
    inputs.tlcontrib = false;
    inputs.updateAllPackages = false;
    inputs.version = v`latest`;
    inputs.forceUpdateCache = Math.random() < 0.5;
  });

  const cacheTypes = [
    ['primary', 'unique'],
    ['primary', 'primary'],
    ['secondary', 'unique'],
    ['secondary', 'primary'],
  ] as const;

  const setCacheType = ([type, keyType]: typeof cacheTypes[number]) => {
    jest.mocked(util.restoreCache).mockImplementationOnce(
      async (target, unique, [primary = '', secondary = '']) => {
        return (type === 'primary' ? primary : (secondary + '-<hash>'))
          + (keyType === 'unique' ? '-<uuid>' : '');
      },
    );
  };

  it('installs TeX Live if cache not found', async () => {
    await expect(action.main()).toResolve();
    expect(util.restoreCache).toHaveBeenCalled();
    expect(InstallTL.prototype.run).toHaveBeenCalled();
  });

  it('does not use cache if input cache is false', async () => {
    inputs.cache = false;
    await expect(action.main()).toResolve();
    expect(util.restoreCache).not.toHaveBeenCalled();
  });

  it.each(cacheTypes)(
    'does not install TeX Live if cache found (case %p)',
    async (...kind) => {
      setCacheType(kind);
      await expect(action.main()).toResolve();
      expect(InstallTL.prototype.run).not.toHaveBeenCalled();
    },
  );

  it.each<[boolean, typeof cacheTypes[number]]>([
    [true, cacheTypes[0]],
    [true, cacheTypes[1]],
    [true, cacheTypes[2]],
    [true, cacheTypes[3]],
    [false, cacheTypes[2]],
    [false, cacheTypes[3]],
  ])('saves info if primary cache not found (case %s)', async (force, kind) => {
    setCacheType(kind);
    inputs.forceUpdateCache = force;
    await expect(action.main()).toResolve();
    expect(State.prototype.save).toHaveBeenCalled();
    const mock = jest.mocked(State).mock;
    expect(mock.instances).toHaveLength(1);
    expect(mock.instances[0]).toHaveProperty('key');
    expect(mock.instances[0]).toHaveProperty('texdir');
  });

  it.each([cacheTypes[0], cacheTypes[1]] as const)(
    'does not save TEXDIR if primary cache found',
    async (...kind) => {
      setCacheType(kind);
      inputs.forceUpdateCache = false;
      await expect(action.main()).toResolve();
      expect(State.prototype.save).toHaveBeenCalled();
      const mock = jest.mocked(State).mock;
      expect(mock.instances).toHaveLength(1);
      expect(mock.instances[0]).toHaveProperty('key');
      expect(mock.instances[0]).not.toHaveProperty('texdir');
    },
  );

  it('sets cache-hit to false', async () => {
    await expect(action.main()).toResolve();
    expect(Outputs.prototype.emit).toHaveBeenCalledOnce();
    expect(core.setOutput).toHaveBeenCalledWith('cache-hit', false);
  });

  it.each(cacheTypes)('sets cache-hit to true (case %p)', async (...kind) => {
    setCacheType(kind);
    await expect(action.main()).toResolve();
    expect(Outputs.prototype.emit).toHaveBeenCalledOnce();
    expect(core.setOutput).toHaveBeenCalledWith('cache-hit', true);
  });

  it.each([
    [Version.LATEST, v`latest`],
    ['2009', v`2009`],
    ['2014', v`2014`],
  ])('sets version to %p if input version is %p', async (output, input) => {
    inputs.version = input;
    await expect(action.main()).toResolve();
    expect(Outputs.prototype.emit).toHaveBeenCalledOnce();
    expect(core.setOutput).toHaveBeenCalledWith('version', input.toString());
  });

  it('adds TeX Live to path after installation', async () => {
    await expect(action.main()).toResolve();
    expect(Path.prototype.add).toHaveBeenCalledAfter(
      jest.mocked<(x: any) => unknown>(InstallTL.prototype.run),
    );
  });

  it.each(cacheTypes)(
    'adds TeX Live to path after cache restoration (case %p)',
    async (...kind) => {
      setCacheType(kind);
      await expect(action.main()).toResolve();
      expect(Path.prototype.add).not.toHaveBeenCalledBefore(
        jest.mocked<(...args: Array<any>) => unknown>(util.restoreCache),
      );
      expect(Path.prototype.add).toHaveBeenCalled();
    },
  );

  it.each([[true], [false]])(
    'does not update any TeX packages for new installation',
    async (input) => {
      inputs.updateAllPackages = input;
      await expect(action.main()).toResolve();
      expect(Tlmgr.prototype.update).not.toHaveBeenCalled();
    },
  );

  it.each(cacheTypes)(
    'updates `tlmgr` when cache restored (case %p)',
    async (...kind) => {
      setCacheType(kind);
      await expect(action.main()).toResolve();
      expect(Tlmgr.prototype.update).toHaveBeenCalledOnce();
      expect(Tlmgr.prototype.update).toHaveBeenCalledWith([], { self: true });
    },
  );

  it.each(cacheTypes)(
    'updates all packages if `update-all-packages` is true (case %p)',
    async (...kind) => {
      setCacheType(kind);
      inputs.updateAllPackages = true;
      await expect(action.main()).toResolve();
      expect(Tlmgr.prototype.update).toHaveBeenCalledTimes(2);
      expect(Tlmgr.prototype.update).toHaveBeenCalledWith([], {
        all: true,
        reinstallForciblyRemoved: true,
      });
    },
  );

  it.each(cacheTypes)(
    'does not attempt to update packages for older versions',
    async (...kind) => {
      setCacheType(kind);
      inputs.updateAllPackages = true;
      inputs.version = v`2020`;
      await expect(action.main()).toResolve();
      expect(Tlmgr.prototype.update).not.toHaveBeenCalled();
    },
  );

  it('does nothing about TEXMF for new installation', async () => {
    await expect(action.main()).toResolve();
    expect(Conf.prototype.texmf).not.toHaveBeenCalled();
  });

  it.each(cacheTypes)(
    'may change TEXMF after adding TeX Live to path (case %p)',
    async (...kind) => {
      setCacheType(kind);
      await expect(action.main()).toResolve();
      expect(Conf.prototype.texmf).not.toHaveBeenCalledBefore(
        jest.mocked(Path.prototype.add),
      );
    },
  );

  it.each(cacheTypes)(
    'change old settings if they are not appropriate (case %p)',
    async (...kind) => {
      setCacheType(kind);
      jest.mocked(Profile).mockReturnValueOnce(
        { TEXMFHOME: '<new>' } as Profile,
      );
      // eslint-disable-next-line jest/unbound-method
      const tlmgr = jest.mocked<any>(Conf.prototype.texmf);
      tlmgr.mockResolvedValue('<old>');
      await expect(action.main()).toResolve();
      expect(tlmgr).toHaveBeenCalledWith('TEXMFHOME', '<new>');
      tlmgr.mockReset();
    },
  );

  it.each(cacheTypes)(
    'does not change old settings if not necessary (case %s)',
    async (...kind) => {
      setCacheType(kind);
      jest.mocked(Profile).mockReturnValueOnce(
        { TEXMFHOME: '<old>' } as Profile,
      );
      // eslint-disable-next-line jest/unbound-method
      const tlmgr = jest.mocked<any>(Conf.prototype.texmf);
      tlmgr.mockResolvedValue('<old>');
      await expect(action.main()).toResolve();
      expect(tlmgr).not.toHaveBeenCalledWith('TEXMFHOME', expect.anything());
      tlmgr.mockReset();
    },
  );

  it('does not setup tlcontrib by default', async () => {
    await expect(action.main()).toResolve();
    expect(Repository.prototype.add).not.toHaveBeenCalled();
    expect(Pinning.prototype.add).not.toHaveBeenCalled();
  });

  it('sets up tlcontrib if input tlcontrib is true', async () => {
    inputs.tlcontrib = true;
    await expect(action.main()).toResolve();
    expect(Repository.prototype.add).not.toHaveBeenCalledBefore(
      jest.mocked(Path.prototype.add),
    );
    expect(Repository.prototype.add).toHaveBeenCalledWith(
      expect.anything(),
      'tlcontrib',
    );
    expect(Pinning.prototype.add).not.toHaveBeenCalledBefore(
      jest.mocked<(x: any) => unknown>(Repository.prototype.add),
    );
    expect(Pinning.prototype.add).toHaveBeenCalledWith('tlcontrib', '*');
  });

  describe.each([[true], [false]])('%p', (force) => {
    beforeEach(() => {
      inputs.forceUpdateCache = force;
    });

    it('does not install any packages by default', async () => {
      await expect(action.main()).toResolve();
      expect(Tlmgr.prototype.install).not.toHaveBeenCalled();
    });

    it.each([cacheTypes[0], cacheTypes[1]] as const)(
      'does not install any package if full cache found (%p, %p)',
      async (...kind) => {
        setCacheType(kind);
        inputs.packages = new Set(['foo', 'bar', 'baz']);
        await expect(action.main()).toResolve();
        expect(Tlmgr.prototype.install).not.toHaveBeenCalled();
      },
    );

    it.each([cacheTypes[2], cacheTypes[3]] as const)(
      'installs specified packages if full cache not found (case %s)',
      async (...kind) => {
        setCacheType(kind);
        inputs.packages = new Set(['foo', 'bar', 'baz']);
        await expect(action.main()).toResolve();
        expect(Tlmgr.prototype.install).toHaveBeenCalled();
      },
    );
  });
});

describe('post', () => {
  it('saves TEXDIR to cache if cache key and texdir are set', async () => {
    await expect(action.post({ key: '<key>', texdir: '<texdir>' } as State))
      .toResolve();
    expect(util.saveCache).toHaveBeenCalled();
  });
});
