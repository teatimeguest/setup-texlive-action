import { vi } from 'vitest';

const actual = await vi.importActual<
  typeof import('#/texlive/tlmgr/actions/conf')
>('#/texlive/tlmgr/actions/conf');

vi.spyOn(actual, 'texmf');

export const { texmf } = actual;
