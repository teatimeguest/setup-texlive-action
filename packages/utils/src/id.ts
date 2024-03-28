import { snakeCase } from 'scule';

import { toUpperCase } from './string.js';

const name = 'setup-texlive-action';

export const SCREAMING_SNAKE_CASE = toUpperCase(snakeCase(name));

export default { 'kebab-case': name, SCREAMING_SNAKE_CASE } as const;

/* eslint @typescript-eslint/naming-convention: off */
