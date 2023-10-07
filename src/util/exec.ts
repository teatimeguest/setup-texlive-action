import { Buffer } from 'node:buffer';

import * as actions from '@actions/exec';

import { Exception, isIterable } from '#/util';

export interface ExecOptions
  extends Readonly<Omit<actions.ExecOptions, 'input'>>
{
  readonly stdin?: Buffer | string | null;
}

export type ExecOutput = actions.ExecOutput;

export interface ExecResultConfig
  extends Omit<ExecResult, 'args' | 'check' | 'config'>
{
  args?: readonly string[] | undefined;
}

export class ExecResult implements Readonly<ExecOutput> {
  constructor(private readonly config: Readonly<ExecResultConfig>) {}

  get command(): string {
    return this.config.command;
  }

  get args(): readonly string[] | undefined {
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

@Exception
export class ExecError extends Error {
  constructor(private readonly config: Readonly<ExecResultConfig>) {
    const { command, exitCode, stderr } = config;
    super(`\`${command}\` exited with status ${exitCode}: ${stderr}`);
    void this.config;
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
  args?: string[],
  // eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types
  options?: ExecOptions,
): Promise<ExecResult> {
  const { stdin, ...rest } = options ?? {};
  const execOptions: actions.ExecOptions = { ...rest, ignoreReturnCode: true };
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
    ...await actions.getExecOutput(command, args, execOptions),
  });
  if (options?.ignoreReturnCode !== true) {
    result.check();
  }
  return result;
}

export function processArgsAndOptions<T extends object>(
  argsOrOptions?: Iterable<string> | T,
  options?: T,
): [args: Iterable<string> | undefined, options: T | undefined] {
  if (isIterable(argsOrOptions)) {
    return [argsOrOptions, options];
  } else {
    return [undefined, options ?? argsOrOptions];
  }
}
