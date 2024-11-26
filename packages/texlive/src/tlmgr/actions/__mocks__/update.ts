import { vi } from 'vitest';

const actual = await vi.importActual<
  typeof import('#texlive/tlmgr/actions/update')
>('#texlive/tlmgr/actions/update');

vi.spyOn(actual, 'update');

export const { update } = actual;
