// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Constructor = abstract new(...args: Array<any>) => unknown;

export function isIterable(value: unknown): value is Iterable<unknown> {
  return typeof (
    (value as Record<symbol, unknown> | null | undefined)?.[Symbol.iterator]
  ) === 'function';
}
