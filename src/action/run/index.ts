import { getState, saveState } from '@actions/core';

import { main } from '#/action/run/main';
import { post } from '#/action/run/post';
import * as log from '#/log';

export async function run(): Promise<void> {
  const state = 'POST';
  try {
    if (getState(state) === '') {
      saveState(state, '1');
      await main();
    } else {
      await post();
    }
  } catch (error) {
    log.fatal({ error }, 'Failed to setup TeX Live');
  }
}
