export const pkg = jest.fn(async (name: string) => {
  return JSON.parse(await loadFixture(`ctan-api-pkg-${name}.json`) ?? '{}');
});
