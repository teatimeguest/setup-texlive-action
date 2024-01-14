export function serialize(val: string): string {
  return val;
}

export function test(val: unknown): val is string {
  return typeof val === 'string';
}
