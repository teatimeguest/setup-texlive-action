import { env } from 'node:process';

import type { DeepWritable } from 'ts-essentials';

import * as action from '#/action';
import { CacheClient } from '#/action/cache';
import { Inputs } from '#/action/inputs';
import { installTL } from '#/texlive';
import * as tlmgr from '#/texlive/tlmgr/actions';

jest.unmock('#/action');

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
    expect(tlmgr.path.add).toHaveBeenCalledAfter(
      jest.mocked<(_: any) => unknown>(installTL),
    );
  });

  it.each(cacheTypes)(
    'adds TeX Live to path after cache restoration (case %p)',
    async (...kind) => {
      setCacheType(kind);
      await expect(action.main()).toResolve();
      expect(tlmgr.path.add).not.toHaveBeenCalledBefore(
        jest.mocked<(...args: Array<any>) => unknown>(
          CacheClient.prototype.restore,
        ),
      );
      expect(tlmgr.path.add).toHaveBeenCalled();
    },
  );

  it.each([[true], [false]])(
    'does not update any TeX packages for new installation',
    async (input) => {
      inputs.updateAllPackages = input;
      await expect(action.main()).toResolve();
      expect(tlmgr.update).not.toHaveBeenCalled();
    },
  );

  it.each(cacheTypes)(
    'updates `tlmgr` when cache restored (case %p)',
    async (...kind) => {
      setCacheType(kind);
      await expect(action.main()).toResolve();
      expect(tlmgr.update).toHaveBeenCalledOnce();
      expect(tlmgr.update).toHaveBeenCalledWith({ self: true });
    },
  );

  it.each(cacheTypes)(
    'updates all packages if `update-all-packages` is true (case %p)',
    async (...kind) => {
      setCacheType(kind);
      inputs.updateAllPackages = true;
      await expect(action.main()).toResolve();
      expect(tlmgr.update).toHaveBeenCalledTimes(2);
      expect(tlmgr.update).toHaveBeenCalledWith({
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
      expect(tlmgr.update).toHaveBeenCalledWith(
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
      expect(tlmgr.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ all: true }),
      );
    },
  );

  it('does nothing about TEXMF for new installation', async () => {
    await expect(action.main()).toResolve();
    expect(tlmgr.conf.texmf).not.toHaveBeenCalled();
  });

  it.each(cacheTypes)(
    'may change TEXMF after adding TeX Live to path (case %p)',
    async (...kind) => {
      setCacheType(kind);
      await expect(action.main()).toResolve();
      expect(tlmgr.conf.texmf).not.toHaveBeenCalledBefore(
        jest.mocked(tlmgr.path.add),
      );
    },
  );

  it.each(cacheTypes)(
    'change old settings if they are not appropriate (case %p)',
    async (...kind) => {
      setCacheType(kind);
      jest.mocked(tlmgr.conf.texmf).mockResolvedValue(
        '<old>' as unknown as void,
      );
      await expect(action.main()).toResolve();
      expect(tlmgr.conf.texmf).toHaveBeenCalledWith(
        'TEXMFHOME',
        expect.anything(),
      );
      jest.mocked(tlmgr.conf.texmf).mockReset();
    },
  );

  it.each(cacheTypes)(
    'does not change old settings if not necessary (case %s)',
    async (...kind) => {
      setCacheType(kind);
      jest.mocked(tlmgr.conf.texmf).mockResolvedValue(
        '<prefix>/texmf-local' as unknown as void,
      );
      await expect(action.main()).toResolve();
      expect(tlmgr.conf.texmf).not.toHaveBeenCalledWith(
        'TEXMFHOME',
        expect.anything(),
      );
      jest.mocked(tlmgr.conf.texmf).mockReset();
    },
  );

  it('does not setup tlcontrib by default', async () => {
    await expect(action.main()).toResolve();
    expect(tlmgr.repository.add).not.toHaveBeenCalled();
    expect(tlmgr.pinning.add).not.toHaveBeenCalled();
  });

  it('sets up tlcontrib if input tlcontrib is true', async () => {
    inputs.tlcontrib = true;
    await expect(action.main()).toResolve();
    expect(tlmgr.repository.add).not.toHaveBeenCalledBefore(
      jest.mocked(tlmgr.path.add),
    );
    expect(tlmgr.repository.add).toHaveBeenCalledWith(
      expect.anything(),
      'tlcontrib',
    );
    expect(tlmgr.pinning.add).not.toHaveBeenCalledBefore(
      jest.mocked<(x: any) => unknown>(tlmgr.repository.add),
    );
    expect(tlmgr.pinning.add).toHaveBeenCalledWith('tlcontrib', '*');
  });

  describe.each([[true], [false]])('%p', (force) => {
    beforeEach(() => {
      env['SETUP_TEXLIVE_FORCE_UPDATE_CACHE'] = force ? '1' : '0';
    });

    it('does not install any packages by default', async () => {
      await expect(action.main()).toResolve();
      expect(tlmgr.install).not.toHaveBeenCalled();
    });

    it.each([cacheTypes[0], cacheTypes[1]] as const)(
      'does not install any package if full cache found (%p, %p)',
      async (...kind) => {
        setCacheType(kind);
        inputs.packages = new Set(['foo', 'bar', 'baz']);
        await expect(action.main()).toResolve();
        expect(tlmgr.install).not.toHaveBeenCalled();
      },
    );

    it.each([cacheTypes[2], cacheTypes[3]] as const)(
      'installs specified packages if full cache not found (case %s)',
      async (...kind) => {
        setCacheType(kind);
        inputs.packages = new Set(['foo', 'bar', 'baz']);
        await expect(action.main()).toResolve();
        expect(tlmgr.install).toHaveBeenCalled();
      },
    );
  });
});
