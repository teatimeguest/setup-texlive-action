import { isNativeError } from 'util/types';

import * as core from '@actions/core';

export interface LogOptions {
  readonly level?: LogLevel;
  readonly cause?: unknown;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export function log(
  message: string,
  { level = 'info', cause }: LogOptions = {},
): void {
  const logger = core[level === 'warn' ? 'warning' : level];
  if (cause === undefined) {
    logger(message);
  } else {
    logger(`${message}: Caused by ${cause}`);
    if (isNativeError(cause)) {
      core.debug(cause.stack);
    }
  }
}

export function debug(
  message: string,
  options?: Omit<LogOptions, 'level'>,
): void {
  log(message, { ...options, level: 'debug' });
}

export function info(
  message: string,
  options?: Omit<LogOptions, 'level'>,
): void {
  log(message, { ...options, level: 'info' });
}

export function warn(
  message: string,
  options?: Omit<LogOptions, 'level'>,
): void {
  log(message, { ...options, level: 'warn' });
}

export function error(
  message: string,
  options?: Omit<LogOptions, 'level'>,
): void {
  log(message, { ...options, level: 'error' });
}
