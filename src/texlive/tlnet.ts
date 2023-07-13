import posixPath from 'node:path/posix';

import { mirrors } from '#/ctan';
import type { Version } from '#/texlive/version';

export type TlnetOptions = mirrors.CtanMirrorOptions;

export async function ctan(options?: TlnetOptions): Promise<URL> {
  const tlnetPath = 'systems/texlive/tlnet/';
  return new URL(tlnetPath, await mirrors.resolve(options));
}

export async function contrib(options?: TlnetOptions): Promise<URL> {
  const tlnetPath = 'systems/texlive/tlcontrib/';
  return new URL(tlnetPath, await mirrors.resolve(options));
}

const HISTORIC_MASTER = 'ftp://tug.org/';
const HISTORIC_MIRROR = 'https://ftp.math.utah.edu/pub/tex/';

export function historic(version: Version, options?: TlnetOptions): URL {
  const tlnetPath = posixPath.join(
    'historic/systems/texlive',
    version.toString(),
    version.number < 2010 ? 'tlnet' : 'tlnet-final',
    '/',
  );
  const base = (options?.master ?? false) ? HISTORIC_MASTER : HISTORIC_MIRROR;
  return new URL(tlnetPath, base);
}
