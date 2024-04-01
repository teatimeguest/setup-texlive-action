import { vi } from 'vitest';

export const EOL = '\n';
export const arch = vi.fn().mockReturnValue('<arch>');
export const homedir = vi.fn().mockReturnValue('~');
export const platform = vi.fn().mockReturnValue('linux');
export const tmpdir = vi.fn().mockReturnValue('<tmpdir>');
