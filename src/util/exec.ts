import { Buffer } from 'node:buffer';

import {
  type ExecOptions as ActionsExecOptions,
  type ExecOutput,
  getExecOutput,
} from '@actions/exec';

export interface ExecOptions extends Omit<ActionsExecOptions, 'input'> {
  stdin?: Buffer | string | null;
}

export interface ExecResultConfig
  extends Omit<ExecResult, 'config' | 'args' | 'check'>
{
  args?: ReadonlyArray<string> | undefined;
}

export class ExecResult implements Readonly<ExecOutput> {
  constructor(private readonly config: Readonly<ExecResultConfig>) {}

  get command(): string {
    return this.config.command;
  }

  get args(): ReadonlyArray<string> | undefined {
    return this.config.args;
  }

  get exitCode(): number {
    return this.config.exitCode;
  }

  get stderr(): string {
    return this.config.stderr;
  }

  get stdout(): string {
    return this.config.stdout;
  }

  check(): void {
    if (this.exitCode !== 0) {
      throw new ExecError(this);
    }
  }
}

export interface ExecError extends ExecResultConfig {}

export class ExecError extends Error {
  constructor(private readonly config: Readonly<ExecResultConfig>) {
    const { command, exitCode, stderr } = config;
    super(`\`${command}\` exited with status ${exitCode}: ${stderr}`);
    void this.config;
  }

  override readonly name = 'ExecError';

  get [Symbol.toStringTag](): string {
    return this.name;
  }

  toJSON(this: void): object {
    return {};
  }

  static {
    const { check, ...descriptors } = Object.getOwnPropertyDescriptors(
      ExecResult.prototype,
    );
    Object.defineProperties(this.prototype, descriptors);
  }
}

export async function exec(
  command: string,
  // eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types
  args?: Array<string>,
  // eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types
  options?: Readonly<ExecOptions>,
): Promise<ExecResult> {
  const { stdin, ...rest } = options ?? {};
  const execOptions: ActionsExecOptions = { ...rest, ignoreReturnCode: true };
  if (stdin !== undefined) {
    if (stdin === null) {
      execOptions.input = Buffer.alloc(0);
    } else if (typeof stdin === 'string') {
      execOptions.input = Buffer.from(stdin);
    } else {
      execOptions.input = stdin;
    }
  }
  const result = new ExecResult({
    command,
    args,
    ...await getExecOutput(command, args, execOptions),
  });
  if (options?.ignoreReturnCode !== true) {
    result.check();
  }
  return result;
}

export type { ExecOutput };
