import path from 'node:path';

import { addPath } from '@actions/core';

import { use } from '#/texlive/tlmgr/internals';
import { uniqueChild } from '#/util';

export async function add(): Promise<void> {
  let dir: string;
  try {
    dir = await uniqueChild(path.join(use().TEXDIR, 'bin'));
  } catch (cause) {
    throw new Error(
      "Unable to locate TeX Live's binary directory",
      { cause },
    );
  }
  addPath(dir);
}
