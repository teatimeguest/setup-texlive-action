import { Version } from '#/texlive';

export interface Outputs {
  readonly cacheHit: boolean;
  readonly version: Version;
}
