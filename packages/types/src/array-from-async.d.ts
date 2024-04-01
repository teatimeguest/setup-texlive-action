declare module 'array-from-async' {
  export default function fromAsync<T>(
    items: Iterable<T> | AsyncIterable<T> | ArrayLike<T>,
  ): PromiseLike<T[]>;

  export default function fromAsync<T, U, This = undefined>(
    items: Iterable<T> | AsyncIterable<T> | ArrayLike<T>,
    mapfn: (this: This, item: T, index: number) => U,
    thisArg?: This,
  ): PromiseLike<U[]>;
}
