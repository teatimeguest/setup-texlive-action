export function toUpperCase<T extends string>(text: T): Uppercase<T> {
  return text.toUpperCase() as Uppercase<T>;
}
