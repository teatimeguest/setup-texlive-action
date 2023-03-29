export interface IterableIterator<T, TReturn = unknown, TNext = undefined>
  extends Iterator<T, TReturn, TNext>
{
  [Symbol.iterator](): IterableIterator<T, TReturn, TNext>;
}
