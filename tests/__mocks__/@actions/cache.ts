export const { ReserveCacheError } = await vi.importActual<
  typeof import('@actions/cache')
>('@actions/cache');
export const saveCache = vi.fn().mockResolvedValue(1);
export const restoreCache = vi.fn();
export const isFeatureAvailable = vi.fn().mockReturnValue(true);
