import { env } from 'node:process';

import type { DeepWritable } from 'ts-essentials';

import * as action from '#/action';
import { CacheClient } from '#/action/cache';
import { Inputs } from '#/action/inputs';
import { Profile, Tlmgr, type Version, installTL } from '#/texlive';
import { Conf } from '#/texlive/tlmgr/conf';
import { Path } from '#/texlive/tlmgr/path';
import { Pinning } from '#/texlive/tlmgr/pinning';
import { Repository } from '#/texlive/tlmgr/repository';

import { config } from '##/package.json';

jest.unmock('#/action');

const LATEST_VERSION = config.texlive.latest.version as Version;

describe('main', () => {
  const inputs = {} as DeepWritable<Inputs>;
  jest.mocked(Inputs.load).mockResolvedValue(inputs as unknown as Inputs);

  beforeEach(() => {
    inputs.cache = true;
    inputs.packages = new Set();
    inputs.prefix = '<prefix>';
    inputs.tlcontrib = false;
    inputs.updateAllPackages = false;
    inputs.version = LATEST_VERSION;
  });

  const cacheTypes = [
    ['primary', 'unique'],
    ['primary', 'primary'],
    ['secondary', 'unique'],
    ['secondary', 'primary'],
  ] as const;

  const setCacheType = ([type, keyType]: typeof cacheTypes[number]) => {
    // eslint-disable-next-line jest/unbound-method
    jest.mocked(CacheClient.prototype.restore).mockResolvedValueOnce({
      hit: type === 'primary'
        && (env['SETUP_TEXLIVE_FORCE_UPDATE_CACHE'] === '0'
          || keyType === 'unique'),
      full: type === 'primary',
      restored: true,
    });
  };

  it('installs TeX Live if cache not found', async () => {
    await expect(action.main()).toResolve();
    expect(CacheClient.prototype.restore).toHaveBeenCalled();
    expect(installTL).toHaveBeenCalled();
  });

  it('does not use cache if input cache is false', async () => {
    inputs.cache = false;
    await expect(action.main()).toResolve();
    expect(CacheClient.prototype.restore).not.toHaveBeenCalled();
  });

  it.each(cacheTypes)(
    'does not install TeX Live if cache found (case %p)',
    async (...kind) => {
      setCacheType(kind);
      await expect(action.main()).toResolve();
      expect(installTL).not.toHaveBeenCalled();
    },
  );

  it('sets cache-hit to false', async () => {
    await expect(action.main()).resolves.toHaveProperty('cacheHit', false);
  });

  it.each(cacheTypes)('sets cache-hit to true (case %p)', async (...kind) => {
    setCacheType(kind);
    await expect(action.main()).resolves.toHaveProperty('cacheHit', true);
  });

  it.each([LATEST_VERSION, '2009', '2014'] as const)(
    'sets version to %p if input version is %p',
    async (version) => {
      inputs.version = version;
      await expect(action.main()).resolves.toHaveProperty('version', version);
    },
  );

  it('adds TeX Live to path after installation', async () => {
    await expect(action.main()).toResolve();
    expect(Path.prototype.add).toHaveBeenCalledAfter(
      jest.mocked<(_: any) => unknown>(installTL),
    );
  });

  it.each(cacheTypes)(
    'adds TeX Live to path after cache restoration (case %p)',
    async (...kind) => {
      setCacheType(kind);
      await expect(action.main()).toResolve();
      expect(Path.prototype.add).not.toHaveBeenCalledBefore(
        jest.mocked<(...args: Array<any>) => unknown>(
          CacheClient.prototype.restore,
        ),
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
    'updates tlmgr even for older versions',
    async (...kind) => {
      setCacheType(kind);
      inputs.updateAllPackages = true;
      inputs.version = '2020';
      await expect(action.main()).toResolve();
      expect(Tlmgr.prototype.update).toHaveBeenCalledWith(
        [],
        expect.objectContaining({ self: true }),
      );
    },
  );

  it.each(cacheTypes)(
    'does not attempt to update packages for older versions',
    async (...kind) => {
      setCacheType(kind);
      inputs.updateAllPackages = true;
      inputs.version = '2020';
      await expect(action.main()).toResolve();
      expect(Tlmgr.prototype.update).not.toHaveBeenCalledWith(
        [],
        expect.objectContaining({ all: true }),
      );
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
      env['SETUP_TEXLIVE_FORCE_UPDATE_CACHE'] = force ? '1' : '0';
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
