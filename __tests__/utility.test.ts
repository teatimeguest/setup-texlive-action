import process from 'node:process';

import * as cache from '@actions/cache';
import * as core from '@actions/core';
import * as glob from '@actions/glob';
import * as tool from '@actions/tool-cache';

import * as log from '#/log';
import {
  determine,
  extract,
  getInput,
  restoreCache,
  saveCache,
  tmpdir,
} from '#/utility';

jest.mock('node:path', () => jest.requireActual('path').posix);
jest.unmock('#/utility');

describe('extract', () => {
  it('extracts files from a tarball', async () => {
    jest.mocked(tool.extractTar).mockResolvedValueOnce('<extractTar>');
    await expect(extract('<tarball>', 'tgz')).resolves.toBe(
      '<extractTar>',
    );
    expect(tool.extractTar).toHaveBeenCalledWith('<tarball>', undefined, [
      'xz',
      '--strip=1',
    ]);
  });

  it('extracts files from a zipfile', async () => {
    jest.spyOn(tool, 'extractZip').mockResolvedValueOnce('<extractZip>');
    await expect(extract('<zipfile>', 'zip')).resolves.toBe('<glob>');
    expect(tool.extractZip).toHaveBeenCalledWith('<zipfile>');
  });

  it('throws an exception if the directory cannot be located', async () => {
    jest.mocked(glob.create).mockResolvedValueOnce(
      { glob: async (): Promise<Array<string>> => [] } as glob.Globber,
    );
    jest.mocked(tool.extractZip).mockResolvedValueOnce('<extractZip>');
    await expect(extract('<zipfile>', 'zip')).rejects.toThrow(
      'Unable to locate subdirectory',
    );
  });
});

describe('determine', () => {
  it('returns a unique path that matches the given pattern', async () => {
    await expect(determine('<pattern>')).resolves.toBe('<glob>');
  });

  it.each<[Array<string>]>([[[]], [['<some>', '<other>']]])(
    'returns `undefined` if the matched path is not unique',
    async (matched) => {
      jest.mocked(glob.create).mockResolvedValueOnce(
        { glob: async () => matched } as glob.Globber,
      );
      await expect(determine('<pattern>')).rejects.toThrow('');
    },
  );
});

describe('getInput', () => {
  it('returns input as string', () => {
    jest.mocked(core.getInput).mockReturnValueOnce('<value>');
    expect(getInput('<name>')).toBe('<value>');
  });

  it('returns undefined if input is an empty string', () => {
    jest.mocked(core.getInput).mockReturnValueOnce('');
    expect(getInput('<name>')).toBeUndefined();
  });

  it('returns default value if input is empty', () => {
    jest.mocked(core.getInput).mockReturnValueOnce('');
    expect(getInput('<name>', { default: '<default>' })).toBe('<default>');
  });

  it.each([true, false])('returns input as boolean', (value) => {
    jest.mocked(core.getBooleanInput).mockReturnValueOnce(value);
    expect(getInput('<name>', { type: Boolean })).toBe(value);
  });
});

describe('saveCache', () => {
  it('saves directory to cache', async () => {
    await expect(saveCache('<target>', '<key>')).toResolve();
    expect(cache.saveCache).toHaveBeenCalledOnce();
  });

  it("doesn't itself fail even if cache.saveCache fails", async () => {
    jest.mocked(cache.saveCache).mockRejectedValueOnce(new Error(''));
    await expect(saveCache('<target>', '<key>')).resolves.not.toThrow();
    expect(log.warn).toHaveBeenCalledWith(
      expect.stringContaining('Failed to save to cache'),
      expect.any(Object),
    );
  });
});

describe('restoreCache', () => {
  it('returns undefined if cache not found', async () => {
    await expect(
      restoreCache('<target>', '<key>', []),
    )
      .resolves
      .toBeUndefined();
  });

  it("returns 'primary' if primary cache restored", async () => {
    jest
      .mocked(cache.restoreCache)
      .mockImplementationOnce(async (target, key) => key);
    await expect(restoreCache('<target>', '<key>', [])).resolves.toBe(
      '<key>',
    );
  });

  it("returns 'secondary' if secondary cache restored", async () => {
    jest
      .mocked(cache.restoreCache)
      .mockImplementationOnce(async (target, key, keys) => keys?.[0]);
    await expect(
      restoreCache('<target>', '<key>', ['<another key>']),
    )
      .resolves
      .toBe('<another key>');
  });

  it('returns undefined if cache.restoreCache fails', async () => {
    jest.mocked(cache.restoreCache).mockRejectedValueOnce(new Error(''));
    await expect(
      restoreCache('<target>', '<key>', []),
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
    expect(tmpdir()).toBe('<RUNNER_TEMP>');
  });

  it('returns `os.tmpdir()` if `RUNNER_TEMP` is not set', () => {
    delete process.env['RUNNER_TEMP'];
    expect(tmpdir()).toBe('<tmpdir>');
  });
});
