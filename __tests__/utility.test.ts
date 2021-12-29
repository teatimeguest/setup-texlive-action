import { promises as fs } from 'fs';

import * as core from '@actions/core';
import * as glob from '@actions/glob';
import * as tool from '@actions/tool-cache';

import * as util from '#/utility';

jest.mock('os', () => ({
  tmpdir: jest.fn().mockReturnValue('<tmpdir>'),
}));
jest.mock('path', () => jest.requireActual('path').posix);
jest.spyOn(core, 'debug').mockImplementation();

describe('updateFile', () => {
  it('updates the contents of the file', async () => {
    jest
      .spyOn(fs, 'readFile')
      .mockResolvedValueOnce(
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit',
      );
    jest.spyOn(fs, 'writeFile').mockImplementationOnce(jest.fn());
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
    jest.spyOn(tool, 'extractTar').mockResolvedValueOnce('<extractTar>');
    await expect(util.extract('<tarball>', 'tar.gz')).resolves.toBe(
      '<extractTar>',
    );
    expect(tool.extractTar).toHaveBeenCalledWith('<tarball>', undefined, [
      'xz',
      '--strip=1',
    ]);
  });

  it('extracts files from a zipfile', async () => {
    jest.spyOn(glob, 'create').mockImplementationOnce(
      async (pattern) =>
        ({
          glob: async () => [pattern.replace(/\*/gu, '<subdir>')],
        } as glob.Globber),
    );
    jest.spyOn(tool, 'extractZip').mockResolvedValueOnce('<extractZip>');
    await expect(util.extract('<zipfile>', 'zip')).resolves.toBe(
      '<extractZip>/<subdir>',
    );
    expect(tool.extractZip).toHaveBeenCalledWith('<zipfile>');
  });

  it('throws an exception if the directory cannot be located', async () => {
    jest
      .spyOn(glob, 'create')
      .mockResolvedValueOnce({
        glob: async (): Promise<Array<string>> => [],
      } as glob.Globber)
      .mockResolvedValueOnce({
        glob: async () => [undefined] as any as Array<string>,
      } as glob.Globber);
    jest
      .spyOn(tool, 'extractZip')
      .mockResolvedValueOnce('<extractZip>')
      .mockResolvedValueOnce('<extractZip>');
    await expect(util.extract('<zipfile>', 'zip')).rejects.toThrow(
      'Unable to locate the unzipped directory',
    );
    await expect(util.extract('<zipfile>', 'zip')).rejects.toThrow(
      'Unable to locate the unzipped directory',
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
