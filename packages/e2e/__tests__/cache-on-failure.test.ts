import { beforeEach, expect, test, vi } from 'vitest';

import * as path from 'node:path';
import { env } from 'node:process';

import { Act, type RunOpts } from '@kie/act-js';

vi.mock('@kie/act-js');

// Use the repository root as cwd:
const cwd = env['npm_config_local_prefix']
  ?? path.resolve(import.meta.dirname, '../../../');

const job = 'test';
const workflow = path.resolve(
  import.meta.dirname,
  '../workflows/cache-on-failure.yml',
);
// Send logs to stderr:
const opts = { logFile: '/dev/stderr' } as const satisfies RunOpts;

const key = 'SETUP_TEXLIVE_ACTION_NO_CACHE_ON_FAILURE';
const msg = /^Cache saved successfully$/gmv;
const act = new Act(cwd, workflow);

beforeEach(() => {
  act.clearEnv();
});

test('default', async () => {
  const steps = await act.runJob(job, opts);
  expect(steps[1]?.name).toMatchSnapshot();
  expect(steps[1]?.status).toBe(0);
  expect(steps[2]?.name).toMatchSnapshot();
  expect(steps[2]?.status).toBe(0);
  expect(steps[3]?.status).toBe(1);
  expect(steps[4]?.name).toMatchSnapshot();
  expect(steps[4]?.status).toBe(0);
  expect(steps[4]?.output).toMatch(msg);
});

test('with-0', async () => {
  act.setEnv(key, '0');
  const steps = await act.runJob(job, opts);
  expect(steps[1]?.name).toMatchSnapshot();
  expect(steps[1]?.status).toBe(0);
  expect(steps[2]?.name).toMatchSnapshot();
  expect(steps[2]?.status).toBe(0);
  expect(steps[3]?.status).toBe(1);
  expect(steps[4]?.name).toMatchSnapshot();
  expect(steps[4]?.status).toBe(0);
  expect(steps[4]?.output).toMatch(msg);
});

test.for(['1', 'true', ''])('with-%s', async (value) => {
  act.setEnv(key, value);
  const steps = await act.runJob(job, opts);
  expect(steps[1]?.name).toMatchSnapshot();
  expect(steps[1]?.status).toBe(0);
  expect(steps[2]?.name).toMatchSnapshot();
  expect(steps[2]?.status).toBe(0);
  expect(steps[3]?.status).toBe(1);
  expect(steps[4]).toBeUndefined();
});
