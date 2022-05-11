import * as fs from 'fs/promises';
import * as process from 'process';

import * as cache from '@actions/cache';
import * as core from '@actions/core';
import * as glob from '@actions/glob';
import * as tool from '@actions/tool-cache';
import 'jest-extended';

import * as util from '#/utility';

const fail = (): unknown => {
  throw new Error('<error>');
};

jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  stat: jest.fn(), // required for @azure/storage-blob
  writeFile: jest.fn(),
}));
jest.mock('os', () => ({
  tmpdir: jest.fn().mockReturnValue('<tmpdir>'),
}));
jest.mock('path', () => jest.requireActual('path').posix);
jest.mock('process', () => ({ env: {} }));
jest.spyOn(glob, 'create').mockResolvedValue({
  glob: async () => ['<globbed>'],
} as glob.Globber);
jest.unmock('#/utility');

describe('updateFile', () => {
  it('updates the contents of the file', async () => {
    (fs.readFile as jest.Mock).mockResolvedValueOnce(
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit',
    );
    await util.updateFile(
      '<filename>',
      { search: /p/gu, replace: 'P' },
      { search: 'o', replace: 'O' },
    );
    expect(fs.writeFile).toHaveBeenCalledWith(
      '<filename>',
      'LOrem iPsum dolor sit amet, consectetur adiPiscing elit',
    );
  });
});

describe('extract', () => {
  it('extracts files from a tarball', async () => {
    (tool.extractTar as jest.Mock).mockResolvedValueOnce('<extractTar>');
    await expect(util.extract('<tarball>', 'tgz')).resolves.toBe(
      '<extractTar>',
    );
    expect(tool.extractTar).toHaveBeenCalledWith('<tarball>', undefined, [
      'xz',
      '--strip=1',
    ]);
  });

  it('extracts files from a zipfile', async () => {
    jest.spyOn(tool, 'extractZip').mockResolvedValueOnce('<extractZip>');
    await expect(util.extract('<zipfile>', 'zip')).resolves.toBe('<globbed>');
    expect(tool.extractZip).toHaveBeenCalledWith('<zipfile>');
  });

  it('throws an exception if the directory cannot be located', async () => {
    (glob.create as jest.Mock).mockResolvedValueOnce({
      glob: async (): Promise<Array<string>> => [],
    } as glob.Globber);
    (tool.extractZip as jest.Mock).mockResolvedValueOnce('<extractZip>');
    await expect(util.extract('<zipfile>', 'zip')).rejects.toThrow(
      'Unable to locate the unzipped directory',
    );
  });
});

describe('determine', () => {
  it('returns a unique path that matches the given pattern', async () => {
    await expect(util.determine('<pattern>')).resolves.toBe('<globbed>');
  });

  it.each<[Array<string>]>([[[]], [['<some>', '<other>']]])(
    'returns `undefined` if the matched path is not unique',
    async (matched) => {
      (glob.create as jest.Mock).mockResolvedValueOnce({
        glob: async () => matched,
      } as glob.Globber);
      await expect(util.determine('<pattern>')).resolves.toBeUndefined();
    },
  );
});

describe('saveToolCache', () => {
  it('saves tool to cache', async () => {
    await util.saveToolCache('<directory>', '<target>', '<version>');
    expect(tool.cacheDir).toHaveBeenCalled();
  });

  it("doesn't itself fail even if storing cache fails", async () => {
    (tool.cacheDir as jest.Mock).mockImplementationOnce(fail);
    await expect(
      util.saveToolCache('<directory>', '<target>', '<version>'),
    ).toResolve();
    expect(core.info).toHaveBeenCalledWith(
      expect.stringContaining('Failed to add to tool cache: '),
    );
  });
});

describe('restoreToolCache', () => {
  it('returns undefined if cache not found', async () => {
    await expect(
      util.restoreToolCache('<target>', '<version>'),
    ).resolves.toBeUndefined();
  });

  it('returns a cache key if cache found', async () => {
    (tool.find as jest.Mock).mockReturnValueOnce('<key>');
    await expect(util.restoreToolCache('<target>', '<version>')).resolves.toBe(
      '<key>',
    );
  });

  it('returns undefined if cache restoration fails', async () => {
    (tool.find as jest.Mock).mockImplementationOnce(fail);
    await expect(
      util.restoreToolCache('<target>', '<version>'),
    ).resolves.toBeUndefined();
    expect(core.info).toHaveBeenCalledWith(
      expect.stringContaining('Failed to restore tool cache: '),
    );
  });
});

describe('saveCache', () => {
  it('saves directory to cache', async () => {
    await expect(util.saveCache('<target>', '<key>')).toResolve();
    expect(cache.saveCache).toHaveBeenCalledOnce();
  });

  it("doesn't itself fail even if cache.saveCache fails", async () => {
    (cache.saveCache as jest.Mock).mockImplementationOnce(fail);
    await expect(util.saveCache('<target>', '<key>')).resolves.not.toThrow();
    expect(core.warning).toHaveBeenCalledWith(
      expect.stringContaining('Failed to save to cache: '),
    );
  });
});

describe('restoreCache', () => {
  it('returns undefined if cache not found', async () => {
    await expect(
      util.restoreCache('<target>', '<key>', []),
    ).resolves.toBeUndefined();
  });

  it("returns 'primary' if primary cache restored", async () => {
    (cache.restoreCache as jest.Mock).mockImplementationOnce(
      async (target, key) => key,
    );
    await expect(util.restoreCache('<target>', '<key>', [])).resolves.toBe(
      'primary',
    );
  });

  it("returns 'secondary' if secondary cache restored", async () => {
    (cache.restoreCache as jest.Mock).mockImplementationOnce(
      async (target, key, keys) => keys[0]!,
    );
    await expect(
      util.restoreCache('<target>', '<key>', ['<other key>']),
    ).resolves.toBe('secondary');
  });

  it('returns undefined if cache.restoreCache fails', async () => {
    (cache.restoreCache as jest.Mock).mockImplementationOnce(fail);
    await expect(
      util.restoreCache('<target>', '<key>', []),
    ).resolves.toBeUndefined();
    expect(core.info).toHaveBeenCalledWith(
      expect.stringContaining('Failed to restore cache: '),
    );
  });
});

describe('tmpdir', () => {
  it('returns $RUNNER_TEMP if set', () => {
    process.env['RUNNER_TEMP'] = '<RUNNER_TEMP>';
    expect(util.tmpdir()).toBe('<RUNNER_TEMP>');
  });

  it('returns `os.tmpdir()` if `RUNNER_TEMP` is not set', () => {
    delete process.env['RUNNER_TEMP'];
    expect(util.tmpdir()).toBe('<tmpdir>');
    process.env['RUNNER_TEMP'] = '';
    expect(util.tmpdir()).toBe('<tmpdir>');
  });
});
