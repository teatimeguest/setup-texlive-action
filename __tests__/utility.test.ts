import { promises as fs } from 'fs';

import * as glob from '@actions/glob';
import * as tool from '@actions/tool-cache';

import * as util from '#/utility';

jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
  },
}));
jest.mock('os', () => ({
  tmpdir: jest.fn().mockReturnValue('<tmpdir>'),
}));
jest.mock('path', () => jest.requireActual('path').posix);
jest.mock('@actions/core', () => ({
  debug: jest.fn(),
}));
jest.mock('@actions/glob', () => ({
  create: jest.fn((pattern) => ({
    glob: async () => [pattern.replace(/\*/gu, '<matched>')],
  })),
}));
jest.mock('@actions/tool-cache', () => ({
  extractTar: jest.fn().mockResolvedValue('<extractTar>'),
  extractZip: jest.fn().mockResolvedValue('<extractZip>'),
}));

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
    await expect(util.extract('<tarball>', 'tar.gz')).resolves.toBe(
      '<extractTar>',
    );
    expect(tool.extractTar).toHaveBeenCalledWith('<tarball>', undefined, [
      'xz',
      '--strip=1',
    ]);
  });

  it('extracts files from a zipfile', async () => {
    await expect(util.extract('<zipfile>', 'zip')).resolves.toBe(
      '<extractZip>/<matched>',
    );
    expect(tool.extractZip).toHaveBeenCalledWith('<zipfile>');
  });

  it('throws an exception if the directory cannot be located', async () => {
    (glob.create as jest.Mock)
      .mockResolvedValueOnce({
        glob: async (): Promise<Array<string>> => [],
      })
      .mockResolvedValueOnce({
        glob: async () => [undefined] as any as Array<string>,
      });
    await expect(util.extract('<zipfile>', 'zip')).rejects.toThrow(
      'Unable to locate the unzipped directory',
    );
    await expect(util.extract('<zipfile>', 'zip')).rejects.toThrow(
      'Unable to locate the unzipped directory',
    );
  });
});

describe('determine', () => {
  it('returns a unique path that matches the given pattern', async () => {
    await expect(util.determine('<path>/*')).resolves.toBe('<path>/<matched>');
  });

  it('returns `undefined` if the matched path is not unique', async () => {
    (glob.create as jest.Mock)
      .mockResolvedValueOnce({
        glob: async (): Promise<Array<string>> => [],
      })
      .mockResolvedValueOnce({
        glob: async () => ['<some path>', '<other path>'],
      });
    await expect(util.determine('<some pattern>')).resolves.toBeUndefined();
    await expect(util.determine('<some pattern>')).resolves.toBeUndefined();
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
