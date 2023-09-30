import path from 'node:path';

import { Exclude, Expose, instanceToPlain } from 'class-transformer';
import { decorate as Decorate } from 'ts-mixer';

import { Texmf } from '#/tex/texmf';
import type { Env } from '#/texlive/install-tl/env';
import type { Version } from '#/texlive/version';
import { AsPath, FromEnv } from '#/util/decorators';

export interface TexmfOptions {
  readonly prefix: string;
  readonly texdir?: string | undefined;
  readonly texuserdir?: string | undefined;
}

@Exclude()
export class SystemTrees implements Texmf.SystemTrees {
  @Decorate(Expose())
  declare readonly TEXDIR: string;

  @Decorate(Expose())
  @FromEnv('TEXLIVE_INSTALL_TEXMFLOCAL' satisfies keyof Env)
  @AsPath
  declare readonly TEXMFLOCAL: string;

  @Decorate(Expose())
  @FromEnv('TEXLIVE_INSTALL_TEXMFSYSCONFIG' satisfies keyof Env)
  @AsPath
  declare readonly TEXMFSYSCONFIG: string;

  @Decorate(Expose())
  @FromEnv('TEXLIVE_INSTALL_TEXMFSYSVAR' satisfies keyof Env)
  @AsPath
  declare readonly TEXMFSYSVAR: string;

  constructor(readonly version: Version, options: TexmfOptions) {
    if (options.texdir !== undefined) {
      this.#withTexdir(options.texdir);
    } else {
      this.#withPrefix(options.prefix);
      Object.assign(this, instanceToPlain(this));
    }
  }

  #withPrefix(this: Writable<this>, prefix: string): void {
    (this as this).#withTexdir(path.join(prefix, this.version));
    this.TEXMFLOCAL = path.join(prefix, 'texmf-local');
  }

  #withTexdir(this: Writable<this>, texdir: string): void {
    this.TEXDIR = texdir;
    this.TEXMFLOCAL = path.join(texdir, 'texmf-local');
    this.TEXMFSYSCONFIG = path.join(texdir, 'texmf-config');
    this.TEXMFSYSVAR = path.join(texdir, 'texmf-var');
  }

  get TEXMFROOT(): string {
    return this.TEXDIR;
  }
}

@Exclude()
export class UserTrees implements Texmf.UserTrees {
  @Decorate(Expose())
  @FromEnv('TEXLIVE_INSTALL_TEXMFHOME' satisfies keyof Env)
  @AsPath
  declare readonly TEXMFHOME: string;

  @Decorate(Expose())
  @FromEnv('TEXLIVE_INSTALL_TEXMFCONFIG' satisfies keyof Env)
  @AsPath
  declare readonly TEXMFCONFIG: string;

  @Decorate(Expose())
  @FromEnv('TEXLIVE_INSTALL_TEXMFVAR' satisfies keyof Env)
  @AsPath
  declare readonly TEXMFVAR: string;

  constructor(readonly version: Version, options: TexmfOptions) {
    if (options.texuserdir !== undefined) {
      this.#withTexuserdir(options.texuserdir);
    } else {
      this.#withSystemTrees(options);
      Object.assign(this, instanceToPlain(this));
    }
  }

  #withTexuserdir(this: Writable<this>, texuserdir: string): void {
    this.TEXMFHOME = path.join(texuserdir, 'texmf');
    this.TEXMFCONFIG = path.join(texuserdir, 'texmf-config');
    this.TEXMFVAR = path.join(texuserdir, 'texmf-var');
  }

  #withSystemTrees(this: Writable<this>, options: TexmfOptions): void {
    const trees = new SystemTrees(this.version, options);
    this.TEXMFHOME = trees.TEXMFLOCAL;
    this.TEXMFCONFIG = trees.TEXMFSYSCONFIG;
    this.TEXMFVAR = trees.TEXMFSYSVAR;
  }
}

/* eslint @typescript-eslint/prefer-readonly-parameter-types: off */
