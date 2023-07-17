export function Exception<
  T extends (
    // dprint-ignore
    InstanceType<T> extends Error
      ? {
        new(...args: ConstructorParameters<T>): InstanceType<T>;
        prototype: InstanceType<T>;
      }
      : never
  ),
>(constructor: T): void {
  const name = constructor.name;
  Object.defineProperties(constructor.prototype, {
    name: {
      value: name,
    },
    [Symbol.toStringTag]: {
      get: function(this: Readonly<Error>) {
        return this.name;
      },
    },
    toJSON: {
      value: function() {
        return {};
      },
    },
  });
}
