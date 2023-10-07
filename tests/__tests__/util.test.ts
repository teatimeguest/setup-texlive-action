import fs from 'node:fs/promises';

import * as tool from '@actions/tool-cache';

import { extract } from '#/util/fs';

jest.mock('node:path', () => jest.requireActual('path').posix);
jest.unmock('#/util/fs');

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
    await expect(extract('<zipfile>', 'zip')).toResolve();
    expect(tool.extractZip).toHaveBeenCalledWith('<zipfile>');
  });

  it.each<[string[]]>([[[]], [['', '']]])(
    'throws an exception if the directory cannot be located',
    async (files) => {
      jest.spyOn(fs, 'readdir').mockResolvedValueOnce(files as any[]);
      jest.spyOn(tool, 'extractZip').mockResolvedValueOnce('<extractZip>');
      await expect(extract('<zipfile>', 'zip')).rejects.toThrow(
        'Unable to locate unzipped subdirectory',
      );
    },
  );
});
