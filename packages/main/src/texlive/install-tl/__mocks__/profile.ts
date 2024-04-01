import { vi } from 'vitest';

export const { Profile } = await vi.importActual<
  typeof import('#/texlive/install-tl/profile')
>('#/texlive/install-tl/profile');

vi.spyOn(Profile.prototype, 'open').mockResolvedValue('texlive.profile');
