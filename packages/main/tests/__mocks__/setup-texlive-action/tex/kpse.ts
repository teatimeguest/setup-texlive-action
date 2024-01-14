import { vi } from 'vitest';

export const varValue = vi.fn(async (key) => `<${key}>`);
