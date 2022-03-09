import { promises as fs } from 'fs';

import * as glob from '@actions/glob';
import * as tool from '@actions/tool-cache';

import * as util from '#/utility';

jest.mock('fs', () => ({
  promises: jest.createMockFromModule('fs/promises'),
}));
jest.mock('os', () => ({
  tmpdir: jest.fn().mockReturnValue('<tmpdir>'),
}));
jest.mock('path', () => jest.requireActual('path').posix);
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
    await expect(util.extract('<tarball>', 'tar.gz')).resolves.toBe(
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
