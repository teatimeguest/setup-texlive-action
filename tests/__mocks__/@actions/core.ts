const actual = await vi.importActual<typeof import('@actions/core')>(
  '@actions/core',
);

export const addPath = vi.fn();
export const debug = vi.fn();
export const error = vi.fn();
export const exportVariable = vi.fn();
export const getBooleanInput = vi.fn(actual.getBooleanInput);
export const getInput = vi.fn(actual.getInput);
export const getState = vi.fn().mockResolvedValue('');
export const group = vi.fn(async (name, fn) => await fn());
export const info = vi.fn();
export const isDebug = vi.fn().mockReturnValue(false);
export const notice = vi.fn();
export const saveState = vi.fn();
export const setFailed = vi.fn((error) => {
  throw new Error(`${error}`);
});
export const setOutput = vi.fn();
export const warning = vi.fn();
