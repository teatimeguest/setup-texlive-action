export const note = Symbol('note');

declare global {
  interface Error {
    [note]?: string;
  }
}
