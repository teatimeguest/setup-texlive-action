import type { CacheEntry, CacheInfo, CacheServiceConfig } from '#/action/cache';

export class CacheService {
  readonly disabled: boolean;
  hit: boolean = false;
  restored: boolean = false;

  constructor(entry: CacheEntry, config?: CacheServiceConfig) {
    this.disabled = config?.disable ?? false;
  }

  async restore(): Promise<CacheInfo> {
    return this;
  }
  update(): void {}
  saveState(): void {}

  static {
    this.prototype.restore = jest.fn().mockImplementation(
      function(this: CacheService) {
        return this;
      },
    );
    this.prototype.update = jest.fn();
    this.prototype.saveState = jest.fn();
  }
}

export const save = jest.fn().mockResolvedValue(undefined);
