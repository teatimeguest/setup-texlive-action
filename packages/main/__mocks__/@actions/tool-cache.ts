import { vi } from 'vitest';

export const downloadTool = vi.fn().mockResolvedValue('<downloadTool>');
export const find = vi.fn().mockReturnValue('');
export const cacheDir = vi.fn();
export const extractTar = vi.fn();
export const extractZip = vi.fn();
