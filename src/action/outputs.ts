import { setOutput } from '@actions/core';
import { Expose, Type } from 'class-transformer';

import { Version } from '#/texlive';
import { Serializable } from '#/utility';

export class Outputs extends Serializable {
  @Expose({ name: 'cache-hit' })
  cacheHit: boolean = false;
  @Expose() @Type(() => String)
  version?: Version;

  emit(): void {
    for (const [key, value] of Object.entries(this.toJSON())) {
      setOutput(key, value);
    }
  }
}
