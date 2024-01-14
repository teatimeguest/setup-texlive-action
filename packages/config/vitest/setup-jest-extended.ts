import { expect } from 'vitest';

import * as matchers from 'jest-extended';

expect.extend(matchers);

declare module 'vitest' {
  interface Assertion<T = any> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining<T = any> extends CustomMatchers<T> {}
  interface ExpectStatic<T = any> extends CustomMatchers<T> {}
}
