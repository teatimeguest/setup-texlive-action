import { afterEach, vi } from 'vitest';

import type { UseContext } from 'unctx';

const unctx = await vi.importActual<typeof import('unctx')>('unctx');

export function createContext<T = any>(): UseContext<T> {
  const ctx = unctx.createContext<T>();
  afterEach(ctx.unset);
  return ctx;
}
