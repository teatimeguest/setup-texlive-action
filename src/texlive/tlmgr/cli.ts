import type { DeepReadonly } from 'ts-essentials';

import * as cli from '#/texlive/tlmgr/actions';
import {
  type TlmgrConfig,
  TlmgrInternals,
  set,
} from '#/texlive/tlmgr/internals';

export type Tlmgr = DeepReadonly<typeof cli>;

export function useTlmgr(config: TlmgrConfig): Tlmgr {
  set(new TlmgrInternals(config));
  return cli;
}

export type { TlmgrAction } from '#/texlive/tlmgr/action';
export type { RepositoryConfig } from '#/texlive/tlmgr/actions/repository';
export type { UpdateOptions } from '#/texlive/tlmgr/actions/update';
export type { TlmgrConfig };
