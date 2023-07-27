export class CacheClient {
  async restore(): Promise<void> {}
  update(): void {}
  saveState(): void {}

  static {
    this.prototype.restore = jest.fn().mockResolvedValue({
      hit: false,
      full: false,
      restored: false,
    });
    this.prototype.update = jest.fn();
    this.prototype.saveState = jest.fn();
  }
}

export const save = jest.fn().mockResolvedValue(undefined);
