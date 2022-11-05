import type { Version } from '#/texlive/version';

export const CTAN = new URL('https://mirror.ctan.org/systems/texlive/tlnet/');

export const CONTRIB = new URL(
  'https://mirror.ctan.org/systems/texlive/tlcontrib/',
);

export function historic({ number: version }: Version): URL {
  return new URL(
    version < 2010 ? 'tlnet/' : 'tlnet-final/',
    `https://ftp.math.utah.edu/pub/tex/historic/systems/texlive/${version}/`,
  );
}
