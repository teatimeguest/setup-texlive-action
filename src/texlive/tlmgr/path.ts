import path from 'node:path';

import { addPath } from '@actions/core';

import { uniqueChild } from '#/util';

export class Path {
  constructor(private readonly options: { readonly TEXDIR: string }) {}

  async add(): Promise<void> {
    let dir: string;
    try {
      dir = await uniqueChild(path.join(this.options.TEXDIR, 'bin'));
    } catch (cause) {
      throw new Error("Unable to locate TeX Live's binary directory", {
        cause,
      });
    }
    addPath(dir);
  }
}
