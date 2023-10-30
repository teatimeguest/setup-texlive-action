import { Buffer } from 'node:buffer';

import {
  type ExecOptions as ActionsExecOptions,
  type ExecOutput,
  getExecOutput,
} from '@actions/exec';
import { P, match } from 'ts-pattern';

import { Exception, type Lax } from '#/util';

export interface ExecOptions
  extends Readonly<Omit<ActionsExecOptions, 'input'>>
{
  readonly stdin?: Buffer | string | null;
}

export type ExecResultConfig =
  & Omit<ExecResult, 'args' | 'check' | 'silenced'>
  & Lax<Pick<ExecResult, 'args' | 'silenced'>>;

export class ExecResult implements ExecOutput {
  readonly command: string;
  declare readonly args?: readonly string[];
  readonly exitCode: number;
  readonly stderr: string;
  readonly stdout: string;
  declare readonly silenced: boolean;

  constructor(config: ExecResultConfig) {
    this.command = config.command;
    if (config.args !== undefined) {
      this.args = config.args;
    }
    this.exitCode = config.exitCode;
    this.stderr = config.stderr;
    this.stdout = config.stdout;
    Object.defineProperty(this, 'silenced', {
      value: config.silenced ?? false,
      enumerable: false,
    });
  }

  check(): void {
    if (this.exitCode !== 0) {
      throw new ExecError(this);
    }
  }
}

export interface ExecError extends Omit<ExecResult, 'check' | 'silenced'> {}

@Exception
export class ExecError extends Error {
  constructor(config: Lax<ExecResultConfig, 'silenced'>) {
    const { command, exitCode, stderr, silenced = false } = config;
    super(`\`${command}\` exited with status ${exitCode}: ${stderr}`);
    Object.assign(this, config);
    // Prevents `stderr` from inspecting as it is included in the error message.
    Object.defineProperty(this, 'stderr', { enumerable: false });
    if (!silenced) {
      // Prevents `stdout` from inspecting as it is output to the log.
      Object.defineProperty(this, 'stdout', { enumerable: false });
    }
  }
}

export async function exec(
  command: string,
  // eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types
  args?: string[],
  // eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types
  options?: ExecOptions,
): Promise<ExecResult> {
  const { stdin, ...rest } = options ?? {};
  const execOptions: ActionsExecOptions = { ...rest, ignoreReturnCode: true };
  if (stdin !== undefined) {
    execOptions.input = match(stdin)
      .with(null, () => Buffer.alloc(0)) // eslint-disable-line unicorn/no-null
      .with(P.string, (input) => Buffer.from(input))
      .with(P.instanceOf(Buffer), (input) => input)
      .exhaustive();
  }
  const outputs = await getExecOutput(command, args, execOptions);
  const result = new ExecResult({
    command,
    args,
    ...outputs,
    silenced: options?.silent,
  });
  if (options?.ignoreReturnCode !== true) {
    result.check();
  }
  return result;
}

export type { ExecOutput };
