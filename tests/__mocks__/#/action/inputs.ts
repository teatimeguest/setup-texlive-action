const actual = jest.requireActual<
  Awaited<typeof import('#/action/inputs')>
>('#/action/inputs');

export namespace Inputs {
  export const load = jest.fn().mockImplementation(() => {
    const inputs = new actual.Inputs();
    (inputs as Writable<typeof inputs>).prefix = '<prefix>';
    return inputs;
  });
}
