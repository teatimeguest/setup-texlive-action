import { getState, saveState } from '@actions/core';
import { Expose, plainToClassFromExist } from 'class-transformer';

import { Serializable } from '#/utility';

export class State extends Serializable {
  static readonly NAME = 'post';

  readonly post: boolean = false;
  @Expose()
  key?: string;
  @Expose()
  texdir?: string;

  constructor() {
    super();
    const state = getState(State.NAME);
    if (state !== '') {
      plainToClassFromExist(this, JSON.parse(state));
      this.post = true;
    }
  }

  save(): void {
    saveState(State.NAME, JSON.stringify(this));
  }
}
