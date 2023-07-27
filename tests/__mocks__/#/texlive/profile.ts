export const { Profile } = jest.requireActual('#/texlive/profile');

jest.spyOn(Profile.prototype, 'open').mockImplementation(
  function*() {},
);
