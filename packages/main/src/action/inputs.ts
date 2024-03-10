import * as path from 'node:path';
import { env } from 'node:process';

import { getBooleanInput, getInput } from '@actions/core';
import { Transform, instanceToInstance } from 'class-transformer';

import id from '#/action/id';
import type { Env } from '#/texlive/install-tl/env';
import { AsPath, Case, FromEnv, getExposedName } from '#/util/decorators';
import type { Lax } from '#/util/types';

export class Inputs {
  @BooleanInput
  readonly cache: boolean = true;

  @Case('kebab')
  @Input
  readonly packageFile: string | undefined;

  @Input
  readonly packages: string | undefined;

  @Transform(() => path.join(env.RUNNER_TEMP!, id['kebab-case']))
  @FromEnv('TEXLIVE_INSTALL_PREFIX' satisfies keyof Env)
  @Input
  @AsPath
  readonly prefix!: string;

  @Input
  readonly repository: string | undefined;

  @Input
  @AsPath
  readonly texdir: string | undefined;

  @BooleanInput
  readonly tlcontrib: boolean = false;

  @Case('kebab')
  @BooleanInput
  readonly updateAllPackages: boolean = false;

  @Input
  // eslint-disable-next-line @typescript-eslint/ban-types
  @Transform(({ value }) => (value as Lax<String> | undefined)?.toLowerCase?.())
  readonly version: string = 'latest';

  static load(this: void): Inputs {
    return instanceToInstance(new Inputs(), { ignoreDecorators: true });
  }
}

function Input(target: object, key: string | symbol): void {
  Transform(({ value }) => {
    const raw = getInput(getExposedName(target, key));
    return raw === '' ? (value as string) : raw;
  })(target, key);
}

function BooleanInput(target: object, key: string | symbol): void {
  Transform(({ value }) => {
    try {
      return getBooleanInput(getExposedName(target, key));
    } catch {
      return value as boolean;
    }
  })(target, key);
}
