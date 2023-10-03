import { formatWithOptions } from 'node:util';

import * as core from '@actions/core';

export type LogLevel = keyof typeof LogLevel;

export const LogLevel = {
  debug: 20,
  info: 30,
  warn: 40,
  fatal: 60,
} as const;

export interface LogOptions {
  readonly error?: unknown;
}

export interface LogFn {
  (format: string, ...values: readonly unknown[]): void;
  (options: LogOptions, format: string, ...values: readonly unknown[]): void;
}

export const debug = setLogFn('debug', core.debug);
export const info = setLogFn('info', core.info);
export const warn = setLogFn('warn', core.warning);
export const fatal = setLogFn('fatal', core.setFailed);

const logger = { debug, info, warn, fatal } as const;
const inspectOptions = { depth: 10, colors: true } as const;

function setLogFn(level: LogLevel, logFn: (msg: string) => void): LogFn {
  function log(
    // eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types
    ...args:
      | [string, ...unknown[]]
      | [LogOptions, string, ...unknown[]]
  ): void {
    if (LogLevel[level] <= LogLevel.debug && !core.isDebug()) {
      return;
    }
    const warning = LogLevel[level] > LogLevel.info;
    const options = (
      typeof args[0] === 'string' ? {} : args.shift()
    ) as LogOptions;
    let message = formatWithOptions(inspectOptions, ...args);
    if ('error' in options) {
      logger[warning ? 'info' : 'debug']('%O', options.error);
      message += `: ${options.error}`;
    }
    logFn(message);
    if (warning && options.error instanceof Error) {
      notes(options.error);
    }
  }
  return log;
}

function notes(
  err: Readonly<Error>,
  depth: number = inspectOptions.depth,
): void {
  if (depth > 0) {
    if (err instanceof AggregateError) {
      for (const e of err.errors) {
        if (e instanceof Error) {
          notes(e, depth - 1);
        }
      }
    } else if (err.cause instanceof Error) {
      notes(err.cause, depth - 1);
    }
    const desc = Object.getOwnPropertyDescriptor(err, 'note');
    if (desc?.enumerable === true && typeof desc.value === 'string') {
      core.notice(desc.value);
    }
  }
}

export { group } from '@actions/core';
