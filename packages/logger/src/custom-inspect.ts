import { EOL, platform } from 'node:os';
import { posix as posixPath } from 'node:path/posix';
import {
  type InspectOptions,
  type InspectOptionsStylized,
  inspect as utilInspect,
} from 'node:util';

import id from '@setup-texlive-action/utils/id';
import ansi from 'ansi-styles';
import cleanStack from 'clean-stack';

import { hasColors } from './styles.js';

interface Inspect {
  (target: unknown, options?: Readonly<InspectOptions>): string;
}

const customInspect = Symbol.for('nodejs.util.inspect.custom');

Reflect.defineProperty(Error.prototype, customInspect, {
  value: function(
    this: Readonly<Error>,
    depth: number,
    options: Readonly<InspectOptionsStylized>,
    inspect: Inspect = utilInspect,
  ): string {
    if (depth < 0) {
      return `[${getErrorName(this)}]`;
    } else if (!hasColors()) {
      return inspectNoCustom(this, options, inspect);
    } else {
      return formatError(this, options, inspect);
    }
  },
});

function formatError(
  error: Readonly<Error>,
  options: Readonly<InspectOptionsStylized>,
  inspect: Inspect = utilInspect,
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
  inspect: Inspect = utilInspect,
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
 * (?:
 *   \r?\n            # newline
 *   (?:.\[[\d;]+m)*  # ansi escapes
 *   \ {4}at.*        # callsite
 * )+
 * ```
 */
const reStack = /(?:\r?\n(?:.\[[\d;]+m)* {4}at.*)+/v;

function formatStack(text: string): string {
  return text.replace(reStack, (stack) => {
    const braceOpen = ' {';
    const endsWithBraceOpen = stack.endsWith(braceOpen);
    if (endsWithBraceOpen) {
      stack = stack.slice(0, -braceOpen.length);
    }
    let basePath = import.meta.url.split(id['kebab-case'], 1)[0]!;
    if (basePath.length === import.meta.url.length) {
      basePath = posixPath.dirname(import.meta.url);
    }
    // Make sure disk designators are handled properly.
    // https://nodejs.org/api/url.html#urlpathtofileurlpath-options
    if (platform() === 'win32' && basePath.charAt(1) === ':') {
      basePath = '/' + basePath;
    }
    return EOL
      + cleanStack(stack, { basePath: basePath })
      + (endsWithBraceOpen ? braceOpen : '');
  });
}
