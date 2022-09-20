import process from 'node:process';

import * as cache from '@actions/cache';
import * as glob from '@actions/glob';
import * as tool from '@actions/tool-cache';
import 'jest-extended';

import * as log from '#/log';
import * as util from '#/utility';

jest.mock('node:os', () => ({ tmpdir: jest.fn().mockReturnValue('<tmpdir>') }));
jest.mock('node:path', () => jest.requireActual('path').posix);
jest.mock('node:process', () => ({ env: {} }));
jest.spyOn(glob, 'create').mockResolvedValue(
  { glob: async () => ['<globbed>'] } as glob.Globber,
);
jest.unmock('#/utility');

describe('extract', () => {
  it('extracts files from a tarball', async () => {
    jest.mocked(tool.extractTar).mockResolvedValueOnce('<extractTar>');
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
    jest.mocked(glob.create).mockResolvedValueOnce(
      { glob: async (): Promise<Array<string>> => [] } as glob.Globber,
    );
    jest.mocked(tool.extractZip).mockResolvedValueOnce('<extractZip>');
    await expect(util.extract('<zipfile>', 'zip')).rejects.toThrow(
      'Unable to locate subdirectory',
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
      jest.mocked(glob.create).mockResolvedValueOnce(
        { glob: async () => matched } as glob.Globber,
      );
      await expect(util.determine('<pattern>')).rejects.toThrow('');
    },
  );
});

describe('saveCache', () => {
  it('saves directory to cache', async () => {
    await expect(util.saveCache('<target>', '<key>')).toResolve();
    expect(cache.saveCache).toHaveBeenCalledOnce();
  });

  it("doesn't itself fail even if cache.saveCache fails", async () => {
    jest.mocked(cache.saveCache).mockRejectedValueOnce(new Error(''));
    await expect(util.saveCache('<target>', '<key>')).resolves.not.toThrow();
    expect(log.warn).toHaveBeenCalledWith(
      expect.stringContaining('Failed to save to cache'),
      expect.any(Object),
    );
  });
});

describe('restoreCache', () => {
  it('returns undefined if cache not found', async () => {
    await expect(
      util.restoreCache('<target>', '<key>', []),
    )
      .resolves
      .toBeUndefined();
  });

  it("returns 'primary' if primary cache restored", async () => {
    jest
      .mocked(cache.restoreCache)
      .mockImplementationOnce(async (target, key) => key);
    await expect(util.restoreCache('<target>', '<key>', [])).resolves.toBe(
      'primary',
    );
  });

  it("returns 'secondary' if secondary cache restored", async () => {
    jest
      .mocked(cache.restoreCache)
      .mockImplementationOnce(async (target, key, keys) => keys?.[0]);
    await expect(
      util.restoreCache('<target>', '<key>', ['<other key>']),
    )
      .resolves
      .toBe('secondary');
  });

  it('returns undefined if cache.restoreCache fails', async () => {
    jest.mocked(cache.restoreCache).mockRejectedValueOnce(new Error(''));
    await expect(
      util.restoreCache('<target>', '<key>', []),
    )
      .resolves
      .toBeUndefined();
    expect(log.warn).toHaveBeenCalledWith(
      expect.stringContaining('Failed to restore cache'),
      expect.any(Object),
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
  });
});
