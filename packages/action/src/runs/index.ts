import { getState, saveState } from '@actions/core';
import * as log from '@setup-texlive-action/logger';

import { main } from '#action/runs/main';
import { post } from '#action/runs/post';

export default async function run(): Promise<void> {
  const state = 'POST';
  try {
    if (getState(state) === '') {
      saveState(state, '1');
      await main();
    } else {
      await post();
    }
  } catch (error) {
    log.fatal({ error });
  }
}
