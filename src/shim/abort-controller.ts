import { Exception } from '#/util/decorators';

@Exception
export class AbortError extends Error {
  type = 'aborted';
}

export const { AbortController, AbortSignal } = globalThis;
