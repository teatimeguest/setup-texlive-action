import * as os from 'node:os';

export const { posix, win32 } = await vi.importActual<
  typeof import('node:path')
>('node:path');

function getPath(): any {
  return os.platform() === 'win32' ? win32 : posix;
}

export const basename = vi.fn((...args) => getPath().basename(...args));
export const format = vi.fn((...args) => getPath().format(...args));
export const join = vi.fn((...args) => getPath().join(...args));
export const normalize = vi.fn((...args) => getPath().normalize(...args));
export const resolve = vi.fn((...args) => getPath().resolve(...args));
