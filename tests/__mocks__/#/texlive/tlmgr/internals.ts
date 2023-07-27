export const {
  TlmgrInternals,
  set,
  use,
} = jest.requireActual('#/texlive/tlmgr/internals');

jest.spyOn(TlmgrInternals.prototype, 'exec');
