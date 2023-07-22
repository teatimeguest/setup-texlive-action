export type MarkNonNullable<T, Keys extends keyof T> =
  & Omit<T, Keys>
  & { [K in Keys]-?: NonNullable<T[K]> };

export function isIterable(value: unknown): value is Iterable<unknown> {
  return typeof (
    (value as Record<symbol, unknown> | null | undefined)?.[Symbol.iterator]
  ) === 'function';
}
