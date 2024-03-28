import { vi } from 'vitest';

export const extract = vi.fn().mockResolvedValue('<extract>');
export const uniqueChild = vi.fn();
export const mkdtemp = vi.fn();

export { tmpdir } from '../fs.js';
