import { env, stdout } from 'node:process';

import { isDebug } from '@actions/core';
import ansi, {
  type CSPair,
  type ForegroundColorName,
  type ModifierName,
} from 'ansi-styles';

export function hasColors(): boolean {
  if (env.GITHUB_ACTIONS === 'true' && !('ACT' in env)) {
    return !isDebug() && (env.NO_COLOR ?? '') === '';
  }
  // `internal.tty.hasColors` supports `NO_COLOR` (https://no-color.org/),
  // but its handling of empty strings does not conform to the spec.
  // https://github.com/nodejs/node/blob/v21.0.0/lib/internal/tty.js#L129
  if (env.NO_COLOR === '') {
    delete env.NO_COLOR;
  }
  // `process.stdout` is not necessarily an instance of `tty.WriteStream`.
  return (stdout as Partial<typeof stdout>).hasColors?.() ?? false;
}

function stylize(
  style: ForegroundColorName | ModifierName,
): (input: string | TemplateStringsArray) => string {
  const group = style in ansi.modifier ? ansi.modifier : ansi.color;
  const { open, close } = group[style as keyof typeof group] as CSPair;
  return (input) => {
    const text = (Array.isArray(input) ? input[0] : input) as string;
    return hasColors() ? `${open}${text}${close}` : text;
  };
}

export default {
  dim: stylize('dim'),
  red: stylize('red'),
  blue: stylize('blue'),
};
