import { vi } from 'vitest';

import { ExecResult } from '../exec.js';

export const exec = vi.fn(async (command: string, args?: readonly string[]) =>
  new ExecResult({
    command,
    args,
    stderr: '<stderr>',
    stdout: '<stdout>',
    exitCode: 0,
  })
);

export { ExecError, ExecResult } from '../exec.js';
