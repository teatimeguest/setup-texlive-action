// @ts-expect-error - no type definition
import fromAsync from 'array-from-async';

if (typeof Array.fromAsync !== 'function') {
  Object.defineProperty(Array, 'fromAsync', {
    value: fromAsync as typeof Array.fromAsync,
    configurable: false,
    enumerable: false,
    writable: false,
  });
}

declare global {
  interface ArrayConstructor {
    fromAsync<T>(
      items: Iterable<T> | AsyncIterable<T> | ArrayLike<T>,
    ): PromiseLike<T[]>;

    fromAsync<T, U, This = undefined>(
      items: Iterable<T> | AsyncIterable<T> | ArrayLike<T>,
      mapfn: (this: This, item: T, index: number) => U,
      thisArg?: This,
    ): PromiseLike<U[]>;
  }
}
