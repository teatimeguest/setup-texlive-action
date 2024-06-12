import { EOL } from 'node:os';
import { type InspectOptions, formatWithOptions } from 'node:util';

import * as core from '@actions/core';
import type { MarkRequired } from 'ts-essentials';
import { P, match } from 'ts-pattern';

import type {} from '@setup-texlive-action/polyfill';

import styles, { hasColors } from './styles.js';
import * as symbols from './symbols.js';

export type LogLevel = keyof typeof LogLevel;

export const LogLevel = {
  debug: 20,
  info: 30,
  warn: 40,
  fatal: 60,
} as const;

export interface LogOptions {
  readonly error?: unknown;
  readonly linePrefix?: string;
}

export interface LogFn<Options extends LogOptions = LogOptions> {
  (format: string, ...values: readonly unknown[]): void;
  (options: Options, format: string, ...values: readonly unknown[]): void;
  (options: MarkRequired<Options, 'error'>): void;
}

export const notify: typeof warn = createLogMethod('info', core.notice);

export const debug = createLogMethod('debug', core.debug);
export const info = createLogMethod('info', core.info);
export const warn = createLogMethod('warn', core.warning);
export const fatal = createLogMethod('fatal', core.setFailed);

const defaultInspectOptions = {
  depth: 10,
  compact: false,
  maxArrayLength: 10,
  maxStringLength: 200,
} as const satisfies InspectOptions;

const logger = { debug, info, warn, fatal } as const;

function createLogMethod<
  const L extends LogLevel,
>(level: L, logFn: (msg: string) => void): LogFn<
  // dprint-ignore
  L extends ('warn' | 'error' | 'fatal')
    ? Omit<LogOptions, 'linePrefix'>
    : LogOptions
> {
  function log(
    ...args:
      | readonly [string, ...unknown[]]
      | readonly [LogOptions, string, ...unknown[]]
      | readonly [MarkRequired<LogOptions, 'error'>]
  ): void {
    if (LogLevel[level] <= LogLevel.debug && !core.isDebug()) {
      return;
    }
    const [message, options] = match(args)
      .returnType<[message: string, options?: LogOptions]>()
      .with(
        [P.string, ...P.array()],
        (inputs) => [format(...inputs)],
      )
      .with(
        [{ error: P._ }, P.string, ...P.array()],
        ([options, ...inputs]) => [
          `${format(...inputs)}: ${options.error}`,
          options,
        ],
      )
      .with(
        [P._, P.string, ...P.array()],
        ([options, ...inputs]) => [format(...inputs), options],
      )
      .with(
        [{ error: P._ }],
        ([options]) => [String(options.error), options],
      )
      .exhaustive();
    const { error, linePrefix } = options ?? {};
    const warning = LogLevel[level] > LogLevel.info;
    if (error !== undefined) {
      let prefix = styles[warning ? 'red' : 'dim']('|') + ' ';
      if (linePrefix !== undefined) {
        prefix = linePrefix + prefix;
      }
      logger[warning ? 'info' : level]({ linePrefix: prefix }, '%O', error);
    }
    if (!warning && linePrefix !== undefined) {
      logFn(indent(message, linePrefix));
    } else {
      logFn(message);
    }
    if (warning) {
      for (const note of new Set(collectNotes(error))) {
        core.notice(note);
      }
    }
  }
  return log;
}

function* collectNotes(error: unknown): Generator<string, void, void> {
  for (const e of traverseErrors(error, defaultInspectOptions.depth)) {
    if (Object.hasOwn(e, symbols.note)) {
      yield e[symbols.note]!;
    }
  }
}

abstract class Never {
  static [Symbol.hasInstance](instance: unknown): instance is Never {
    return false;
  }
}

interface Never {
  new(...args: readonly unknown[]): never;
}

/** @yields Suberrors in depth-first postorder. */
function* traverseErrors(
  root: unknown,
  depthLimit: number,
): Generator<Error, void, void> {
  if (root instanceof Error && depthLimit > 0) {
    const children = match(root)
      .with(
        P.instanceOf(AggregateError),
        { name: 'AggregateError', errors: P.array() },
        ({ errors }) => errors,
      )
      .with(
        P.instanceOf(
          Reflect.get(globalThis, 'SuppressedError') as (
            | SuppressedErrorConstructor
            | undefined
          ) ?? Never,
        ),
        { name: 'SuppressedError' },
        ({ error, suppressed }) => [error, suppressed],
      )
      .with(
        { cause: P._ },
        ({ cause }) => [cause],
      )
      .otherwise(() => []);
    for (const child of children) {
      yield* traverseErrors(child, depthLimit - 1);
    }
    yield root;
  }
}

function format(fmt: string, ...values: readonly unknown[]): string {
  return formatWithOptions(
    { colors: hasColors(), ...defaultInspectOptions },
    fmt,
    ...values,
  );
}

function indent(text: string, prefix: string): string {
  return text.split('\n').map((line) => `${prefix}${line}`.trimEnd()).join(EOL);
}
