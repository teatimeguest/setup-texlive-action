import { getState, saveState, setFailed } from '@actions/core';

import { main } from '#/action/run/main';
import { post } from '#/action/run/post';
import * as log from '#/log';

export async function run(): Promise<void> {
  const state = 'POST';
  try {
    if (getState(state) === '') {
      await main();
      saveState(state, '1');
    } else {
      await post();
    }
  } catch (error) {
    if (error instanceof Error) {
      log.info(error.stack ?? `${error}`);
      setFailed(error.message);
    } else {
      setFailed(`${error}`);
    }
  }
}
