import { dedent } from 'ts-dedent';

import * as tlpdb from '#/texlive/tlpdb';

jest.unmock('#/texlive/tlpdb');

describe('parse', () => {
  // editorconfig-checker-disable
  const db = dedent`
    name 00texlive.config
    category Package
    depend minrelease/2016
    depend release/2022

    name texlive.infra
    category TLCore
    revision 63645
    shortdesc basic TeX Live infrastructure
    containersize 351180
    docfiles size=139
     README
    runfiles size=320
     LICENSE.CTAN

    name texlive.infra.universal-darwin
    category TLCore
    revision 62358
    shortdesc universal-darwin files of texlive.infra
    containersize 308304
    binfiles arch=universal-darwin size=246
     bin/universal-darwin/mktexlsr
     bin/universal-darwin/tlmgr
     tlpkg/installer/lz4/lz4.universal-darwin
     tlpkg/installer/xz/xz.universal-darwin

    name scheme-basic
    category Scheme
    revision 54191
    shortdesc basic scheme (plain and latex)
    relocated 1
    depend collection-basic
    depend collection-latex
    containersize 440

    name la\\
    tex#comment
    category Package
    revision 61232
    shortdesc A TeX macro package that defines LaTeX
    depend latexconfig
    depend luatex
    depend pdftex
    containersize 221228
    catalogue-contact-home http://www.latex-project.org/
    catalogue-license lppl1.3c
    catalogue-topics format
    catalogue-version 2021-11-15 PL1

    name hyperref
    category Package
    revision 62142
    shortdesc Extensive support for hypertext in LaTeX
    catalogue-contact-bugs https://github.com/latex3/hyperref/issues
    catalogue-contact-home https://github.com/latex3/hyperref
    catalogue-ctan /macros/latex/contrib/hyperref
    catalogue-license lppl1.3
    catalogue-topics hyper pdf-feat adobe-distiller form-fillin etex
    catalogue-version 7.00n
  `;
  // editorconfig-checker-enable

  it('strips comments and escaped line breaks', () => {
    expect([...tlpdb.parse(db)]).toContainEqual(
      expect.objectContaining({
        name: 'latex',
        version: '2021-11-15 PL1',
        revision: '61232',
      }),
    );
  });

  it('lists texlive.infra', () => {
    expect([...tlpdb.parse(db)]).toContainEqual(
      expect.objectContaining({
        name: 'texlive.infra',
        version: undefined,
        revision: '63645',
      }),
    );
  });

  it('does not list schemes and collections', () => {
    expect([...tlpdb.parse(db)]).not.toContainEqual(
      expect.objectContaining({ name: 'scheme-basic' }),
    );
  });

  it('does not list architecture-specific packages', () => {
    expect([...tlpdb.parse(db)]).not.toContainEqual(
      expect.objectContaining({ name: 'texlive.infra.universal-darwin' }),
    );
  });

  it('does not list texlive metadata', () => {
    expect([...tlpdb.parse(db)]).not.toContainEqual(
      expect.objectContaining({ name: '00texlive.config' }),
    );
  });

  it('lists normal packages', () => {
    expect([...tlpdb.parse(db)]).toContainEqual(
      expect.objectContaining({
        name: 'hyperref',
        version: '7.00n',
        revision: '62142',
      }),
    );
  });
});
