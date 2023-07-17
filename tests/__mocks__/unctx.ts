import type { UseContext } from 'unctx';

const unctx = jest.requireActual<Awaited<typeof import('unctx')>>('unctx');

export function createContext<T = any>(): UseContext<T> {
  const ctx = unctx.createContext<T>();
  afterEach(ctx.unset);
  return ctx;
}
