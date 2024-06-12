import { vi } from 'vitest';

export const {
  TlmgrInternals,
  set,
  use,
} = await vi.importActual<typeof import('#texlive/tlmgr/internals')>(
  '#texlive/tlmgr/internals',
);

vi.spyOn(TlmgrInternals.prototype, 'exec');
