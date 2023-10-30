export type Strict<T, Keys extends keyof T = keyof T> =
  & Omit<T, Keys>
  & { [K in Keys]-?: NonNullable<T[K]> };

export type Lax<T, Keys extends keyof T = keyof T> =
  & Omit<T, Keys>
  & { [K in Keys]?: T[K] | undefined };

export function isIterable(value: unknown): value is Iterable<unknown> {
  return typeof (
    (value as Record<symbol, unknown> | null | undefined)?.[Symbol.iterator]
  ) === 'function';
}
