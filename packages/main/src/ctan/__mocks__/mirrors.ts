import { vi } from 'vitest';

export const resolve = vi.fn().mockResolvedValue(new URL(MOCK_URL));
