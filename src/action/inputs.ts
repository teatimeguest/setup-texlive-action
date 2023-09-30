import path from 'node:path';
import { env } from 'node:process';

import { getBooleanInput, getInput } from '@actions/core';
import { Transform, instanceToInstance } from 'class-transformer';
import { defaultMetadataStorage } from 'class-transformer/esm5/storage';

import { ID } from '#/action/id';
import type { Env } from '#/texlive/install-tl/env';
import { AsPath, Case, FromEnv } from '#/util/decorators';

export class Inputs {
  @BooleanInput
  readonly cache: boolean = true;

  @Input
  readonly packageFile: string | undefined;

  @Input
  readonly packages: string | undefined;

  @Transform(() => path.join(env.RUNNER_TEMP, ID['kebab-case']))
  @FromEnv('TEXLIVE_INSTALL_PREFIX' satisfies keyof Env)
  @Input
  @AsPath
  readonly prefix!: string;

  @Input
  @AsPath
  readonly texdir: string | undefined;

  @BooleanInput
  readonly tlcontrib: boolean = false;

  @BooleanInput
  readonly updateAllPackages: boolean = false;

  @Input
  // eslint-disable-next-line @typescript-eslint/ban-types
  @Transform<Probably<String>>(({ value }) => value?.toLowerCase?.())
  readonly version: string = 'latest';

  static load(this: void): Inputs {
    return instanceToInstance(new Inputs(), { ignoreDecorators: true });
  }
}

type Probably<T> = Partial<T> | null | undefined;

function getExposedName(target: object, key: string | symbol): string {
  return defaultMetadataStorage
    .getExposedMetadatas(target.constructor)
    .find((data) => data.propertyName === key)
    ?.options
    .name ?? (key as string);
}

function Input(target: object, key: string | symbol): void {
  Case('kebab')(target, key);
  Transform(({ value }) => {
    const raw = getInput(getExposedName(target, key));
    return raw === '' ? (value as string) : raw;
  })(target, key);
}

function BooleanInput(target: object, key: string | symbol): void {
  Case('kebab')(target, key);
  Transform(({ value }) => {
    try {
      return getBooleanInput(getExposedName(target, key));
    } catch {
      return value as boolean;
    }
  })(target, key);
}
