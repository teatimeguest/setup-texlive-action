import { vi } from 'vitest';

const actual = await vi.importActual<
  typeof import('#/action/inputs')
>('#/action/inputs');

export namespace Inputs {
  export const load = vi.fn().mockImplementation(() => {
    const inputs = new actual.Inputs();
    (inputs as Writable<typeof inputs>).prefix = '<prefix>';
    return inputs;
  });
}
