import { vi } from 'vitest';

export const getCache = vi.fn().mockReturnValue(true);
export const getPackageFile = vi.fn();
export const getPackages = vi.fn();
export const getPrefix = vi.fn().mockReturnValue('<prefix>');
export const getRepository = vi.fn();
export const getTexdir = vi.fn();
export const getTlcontrib = vi.fn().mockReturnValue(false);
export const getUpdateAllPackages = vi.fn().mockReturnValue(false);
export const getVersion = vi.fn();
