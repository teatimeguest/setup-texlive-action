import { vi } from 'vitest';

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';

import { Act } from '@kie/act-js';

const originalRun = Reflect.get(Act.prototype, 'run') as typeof run;

// Ensure that a new cache entry is created each time
vi
  .spyOn(Act.prototype, 'run' as keyof Act)
  .mockImplementation(run as ReturnType<typeof vi.fn>);

// Prevent `act-js` from creating `.actrc` file in home directory
vi
  .spyOn(Act.prototype, 'setDefaultImage' as keyof Act)
  .mockImplementation(vi.fn());

async function run(
  this: Act,
  cmd: string[],
  ...args: unknown[]
): Promise<unknown> {
  const tmp = await mkdtemp(path.join(tmpdir(), 'act-'));
  await using _ = { // eslint-disable-line @typescript-eslint/no-unused-vars
    async [Symbol.asyncDispose]() {
      await rm(tmp, { force: true, recursive: true });
    },
  };
  console.error(`Using ${tmp} as cache server path`);
  cmd.push('--cache-server-path', tmp);
  return await originalRun.call(this, cmd, ...args);
}

export { Act };
