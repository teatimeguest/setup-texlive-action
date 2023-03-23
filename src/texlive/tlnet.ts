import type { Version } from '#/texlive/version';

export const CTAN = new URL('https://mirror.ctan.org/systems/texlive/tlnet/');

export const CONTRIB = new URL(
  'https://mirror.ctan.org/systems/texlive/tlcontrib/',
);

export function historic(
  version: Version,
  options?: { readonly master?: boolean },
): URL {
  const base = new URL(
    `historic/systems/texlive/${version}/`,
    (options?.master ?? false)
      ? 'ftp://tug.org/'
      : 'https://ftp.math.utah.edu/pub/tex/',
  );
  return new URL(version.number < 2010 ? 'tlnet/' : 'tlnet-final/', base);
}
