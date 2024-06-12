import { Range } from 'semver';

export type TlmgrAction =
  | 'conf'
  | 'install'
  | 'list'
  // | 'option'
  | 'path'
  | 'pinning'
  | 'repository'
  | 'update'
  | 'version';

export const SUPPORTED_VERSIONS = {
  conf: new Range('>=2010'),
  install: new Range('*'),
  // list: new Range('*'),
  // option: new Range('*'),
  pinning: new Range('>=2013'),
  repository: new Range('>=2012'),
  update: new Range('*'),
  version: new Range('*'),
} as const satisfies Partial<Record<TlmgrAction, Range>>;
