import { vi } from 'vitest';

export const readFile = vi.fn().mockResolvedValue('<readFile>');
export const readdir = vi.fn().mockResolvedValue(['<readdir>']);
export const writeFile = vi.fn();
