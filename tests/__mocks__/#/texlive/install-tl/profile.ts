export const { Profile } = jest.requireActual('#/texlive/install-tl/profile');

jest.spyOn(Profile.prototype, 'open').mockImplementation(
  function*() {},
);
