import { save as saveCache } from '#action/cache';

export async function post(): Promise<void> {
  await saveCache();
}
