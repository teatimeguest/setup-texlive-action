import * as fs from 'node:fs/promises';

import * as tool from '@actions/tool-cache';

import { extract } from '#/util/fs';

vi.mock('node:path', async () => {
  const { posix } = await vi.importActual<typeof import('node:path')>(
    'node:path',
  );
  return posix;
});
vi.unmock('#/util/fs');

describe('extract', () => {
  it('extracts files from a tarball', async () => {
    vi.mocked(tool.extractTar).mockResolvedValueOnce('<extractTar>');
    await expect(extract('<tarball>', 'tgz')).resolves.toBe(
      '<extractTar>',
    );
    expect(tool.extractTar).toHaveBeenCalledWith('<tarball>', undefined, [
      'xz',
      '--strip=1',
    ]);
  });

  it('extracts files from a zipfile', async () => {
    vi.spyOn(tool, 'extractZip').mockResolvedValueOnce('<extractZip>');
    await expect(extract('<zipfile>', 'zip')).toResolve();
    expect(tool.extractZip).toHaveBeenCalledWith('<zipfile>');
  });

  it.each([[[]], [['', '']]])(
    'throws an exception if the directory cannot be located',
    async (files) => {
      vi.spyOn(fs, 'readdir').mockResolvedValueOnce(
        files as unknown as import('node:fs').Dirent[],
      );
      vi.spyOn(tool, 'extractZip').mockResolvedValueOnce('<extractZip>');
      await expect(extract('<zipfile>', 'zip')).rejects.toThrow(
        'Unable to locate unzipped subdirectory',
      );
    },
  );
});
