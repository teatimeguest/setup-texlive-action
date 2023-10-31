import { platform } from 'node:os';
import * as path from 'node:path';
import { env } from 'node:process';
import type { InspectOptions, InspectOptionsStylized } from 'node:util';

import { isDebug } from '@actions/core';
import ansi from 'ansi-styles';
import cleanStack from 'clean-stack';

interface Inspect {
  (target: unknown, options?: Readonly<InspectOptions>): string;
}

const customInspect = Symbol.for('nodejs.util.inspect.custom');

Reflect.defineProperty(Error.prototype, customInspect, {
  value: function(
    this: Readonly<Error>,
    depth: number,
    options: Readonly<InspectOptionsStylized>,
    inspect: Inspect,
  ): string {
    if (depth < 0) {
      return `[${getErrorName(this)}]`;
    } else if (isDebug()) {
      return inspectNoCustom(this, options, inspect);
    } else {
      return formatError(this, options, inspect);
    }
  },
});

function formatError(
  error: Readonly<Error>,
  options: Readonly<InspectOptionsStylized>,
  inspect: Inspect,
): string {
  let stylized: string = inspectNoCustom(error, options, inspect);
  // Colorize error name in red to improve legibility.
  if (options.colors ?? false) {
    const prefix = getErrorName(error) + (error.message !== '' ? ':' : '');
    if (stylized.startsWith(prefix)) {
      const { open, close } = ansi.color.red;
      stylized = `${open}${prefix}${close}${stylized.slice(prefix.length)}`;
    }
  }
  return formatStack(stylized);
}

function getErrorName(error: Readonly<Error>): string {
  return error.name === error.constructor.name
    ? error.name
    : `${error.constructor.name} [${error.name}]`;
}

function inspectNoCustom(
  target: object,
  options: Readonly<InspectOptionsStylized>,
  inspect: Inspect,
): string {
  // Temporarily overrides `customInspect` to prevent circular calls.
  const success = Reflect.defineProperty(target, customInspect, {
    value: undefined,
    configurable: true,
  });
  if (success) {
    try {
      return inspect(target, options);
    } catch {
      // Suppress errors.
    } finally {
      Reflect.deleteProperty(target, customInspect);
    }
  }
  return inspect(target, { ...options, customInspect: false });
}

/**
 * ```regex
 * ^.*                # error message
 * (?:
 *   \r?\n            # newline
 *   (?:.\[[\d;]+m)*  # ansi escapes
 *   \ {4}at.*        # callsite
 * )*
 * ```
 */
const reStack = /^.*(?:\r?\n(?:.\[[\d;]+m)* {4}at.*)*/v;

function formatStack(text: string): string {
  let stack = reStack.exec(text)?.[0];
  if (stack === undefined) {
    return text;
  }
  if (stack.endsWith(' {')) {
    stack = stack.slice(0, -2);
  }
  let basePath = getBasePath();
  // Make sure disk designators are handled properly.
  // https://nodejs.org/api/url.html#urlpathtofileurlpath
  if (platform() === 'win32' && basePath?.charAt(1) === ':') {
    basePath = '/' + basePath;
  }
  return cleanStack(stack, { basePath: basePath! }) + text.slice(stack.length);
}

/**
 * @returns Same value as `$GITHUB_ACTION_PATH/../../..`.
 * @example
 *   On Linux:
 *   ```env
 *   GITHUB_ACTION_PATH = /home/runner/work/_actions/<owner>/<repository>/<ref>
 *   GITHUB_WORKSPACE   = /home/runner/work/<owner>/<repository>
 *   ```
 * @see {@link https://docs.github.com/en/actions/learn-github-actions/variables#default-environment-variables}
 */
function getBasePath(): string | undefined {
  const workspace = env['GITHUB_WORKSPACE'];
  if (workspace === undefined) {
    return undefined;
  }
  return path.resolve(workspace, '..', '..', '_actions');
}
