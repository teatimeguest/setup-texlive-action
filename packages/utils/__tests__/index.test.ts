import { describe, expect, it, vi } from 'vitest';

import type { Dirent } from 'node:fs';
import * as fs from 'node:fs/promises';

import * as tool from '@actions/tool-cache';
import '@setup-texlive-action/polyfill/shims';
import { extract } from '@setup-texlive-action/utils';

vi.mock('node:fs/promises', () => ({
  readdir: vi.fn().mockResolvedValue(['<readdir>']),
}));
vi.mock('node:path', async () => await import('node:path/posix'));
vi.mock('@actions/tool-cache');

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
    await expect(extract('<zipfile>', 'zip')).resolves.not.toThrow();
    expect(tool.extractZip).toHaveBeenCalledWith('<zipfile>');
  });

  it.each([[[]], [['', '']]])(
    'throws an exception if the directory cannot be located',
    async (files) => {
      vi.spyOn(fs, 'readdir').mockResolvedValueOnce(
        files as unknown as Dirent[],
      );
      vi.spyOn(tool, 'extractZip').mockResolvedValueOnce('<extractZip>');
      await expect(extract('<zipfile>', 'zip')).rejects.toThrow(
        'Unable to locate unzipped subdirectory',
      );
    },
  );
});
