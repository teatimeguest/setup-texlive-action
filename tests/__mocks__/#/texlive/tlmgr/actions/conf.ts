const actual = jest.requireActual('#/texlive/tlmgr/actions/conf');

jest.spyOn(actual, 'texmf');

export const { texmf } = actual;
