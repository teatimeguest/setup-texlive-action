import { Exception } from '@setup-texlive-action/utils';

import type { Version } from '#/texlive/version';

export interface TLErrorOptions extends ErrorOptions {
  code?: string;
  version?: Version | undefined;
  repository?: Readonly<URL> | string | undefined;
  remoteVersion?: string | undefined;
}

@Exception
export abstract class TLError extends Error implements TLErrorOptions {
  declare code?: string;
  declare version?: Version;
  declare repository?: string;
  declare remoteVersion?: string;

  constructor(msg: string, options?: Readonly<TLErrorOptions>) {
    super(msg, options);
    if (options?.code !== undefined) {
      this.code = options.code;
    }
    if (options?.version !== undefined) {
      this.version = options.version;
    }
    if (options?.repository !== undefined) {
      this.repository = options.repository.toString();
    }
    if (options?.remoteVersion !== undefined) {
      this.remoteVersion = options.remoteVersion;
    }
  }
}
