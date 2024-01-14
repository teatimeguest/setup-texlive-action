import { vi } from 'vitest';

export const ctan = vi.fn().mockResolvedValue(new URL(MOCK_URL));
export const contrib = vi.fn().mockResolvedValue(new URL(MOCK_URL));
export const historic = vi.fn().mockResolvedValue(new URL(MOCK_URL));
