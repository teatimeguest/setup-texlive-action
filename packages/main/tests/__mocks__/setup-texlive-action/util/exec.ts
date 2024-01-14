import { vi } from 'vitest';

export const { ExecError, ExecResult } = await vi.importActual<
  typeof import('#/util/exec')
>('#/util/exec');

export const exec = vi.fn().mockImplementation(async (command, args) => {
  return new ExecResult({
    command,
    args,
    exitCode: 0,
    stderr: '',
    stdout: '',
  });
});
