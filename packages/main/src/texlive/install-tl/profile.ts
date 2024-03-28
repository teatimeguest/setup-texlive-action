import { writeFile } from 'node:fs/promises';
import { arch, platform } from 'node:os';
import * as path from 'node:path';

import { Case, type Tmpdir, mkdtemp } from '@setup-texlive-action/utils';
import { Exclude, Expose, Type, instanceToPlain } from 'class-transformer';
import { Mixin } from 'ts-mixer';

import {
  SystemTrees,
  type TexmfOptions,
  UserTrees,
} from '#/texlive/install-tl/texmf';
import type { Version } from '#/texlive/version';

@Exclude()
export class Profile extends Mixin(SystemTrees, UserTrees) {
  constructor(version: Version, options: TexmfOptions) {
    super(version, options);
    if (version < '2020' && platform() === 'darwin' && arch() === 'arm64') {
      this.binary = 'universal-darwin';
    }
  }

  @Case('snake')
  get selectedScheme(): string {
    // `scheme-infraonly` was first introduced in TeX Live 2016.
    return `scheme-${this.version < '2016' ? 'minimal' : 'infraonly'}`;
  }
  @Expose()
  readonly instopt = new InstOpt();
  @Expose()
  readonly tlpdbopt = new TlpdbOpt();
  @Expose({ until: 2017, groups: ['darwin'] })
  declare readonly binary?: string;

  #tmpdir: Tmpdir | undefined;
  #path: string | undefined;

  async open(): Promise<string> {
    this.#tmpdir ??= await mkdtemp();
    if (this.#path === undefined) {
      const profilePath = path.join(this.#tmpdir.path, 'texlive.profile');
      await writeFile(profilePath, this.toString());
      this.#path = profilePath;
    }
    return this.#path;
  }

  async [Symbol.asyncDispose](): Promise<void> {
    this.#path = undefined;
    try {
      await this.#tmpdir?.[Symbol.asyncDispose]();
    } finally {
      this.#tmpdir = undefined;
    }
  }

  override toString(): string {
    return Object
      .entries(this.toJSON())
      .map((entry) => entry.join(' '))
      .join('\n');
  }

  toJSON(): object {
    const { instopt, tlpdbopt, binary, ...plain } = instanceToPlain(this, {
      version: Number.parseInt(this.version),
      groups: [platform()],
    }) as Record<string, unknown> & {
      readonly instopt: object;
      readonly tlpdbopt: object;
    };
    const options = this.version < '2017'
      ? { option: { ...instopt, ...tlpdbopt } }
      : { instopt, tlpdbopt };
    for (const [prefix, values] of Object.entries(options)) {
      for (const [key, value] of Object.entries(values ?? {})) {
        plain[`${prefix}_${key}`] = value;
      }
    }
    if (binary !== undefined) {
      plain[`binary_${binary}`] = '1';
    }
    return plain;
  }
}

const AsNumber: PropertyDecorator = Type(() => Number);

@Case('snake')
export class InstOpt {
  @Expose({ since: 2019 })
  @AsNumber
  readonly adjustpath: boolean = false;
  @Expose({ since: 2011 })
  @AsNumber
  readonly adjustrepo: boolean = false;

  // Old option names
  @Expose({ until: 2009 })
  @AsNumber
  get symlinks(): boolean {
    return this.adjustpath;
  }
}

@Case('snake')
export class TlpdbOpt {
  @Expose()
  readonly autobackup: number = 0;
  @Expose({ since: 2017 })
  @AsNumber
  readonly installDocfiles: boolean = false;
  @Expose({ since: 2017 })
  @AsNumber
  readonly installSrcfiles: boolean = false;

  // Options for Windows
  @Expose({ since: 2009, groups: ['win32'] })
  @AsNumber
  readonly desktopIntegration: boolean = false;
  @Expose({ groups: ['win32'] })
  @AsNumber
  readonly fileAssocs: boolean = false;
  @Expose({ since: 2009, groups: ['win32'] })
  @AsNumber
  readonly w32MultiUser: boolean = false;

  // Removed option
  @Expose({ since: 2012, until: 2017, groups: ['win32'] })
  @AsNumber
  readonly menuIntegration: boolean = false;

  // Old option names
  @Expose({ until: 2017 })
  @AsNumber
  get doc(): boolean {
    return this.installDocfiles;
  }
  @Expose({ until: 2017 })
  @AsNumber
  get src(): boolean {
    return this.installSrcfiles;
  }
}
