import { snakeCase } from 'scule';

const name = 'setup-texlive-action';

export default {
  'kebab-case': name,
  SCREAMING_SNAKE_CASE: toUpperCase(snakeCase(name)),
} as const;

function toUpperCase<T extends string>(text: T): Uppercase<T> {
  return text.toUpperCase() as Uppercase<T>;
}

/* eslint @typescript-eslint/naming-convention: off */
