import { getLocation } from '#/util/http';

const CTAN_MASTER = 'http://ftp.dante.de/tex-archive/';
const CTAN_MIRROR = 'https://mirror.ctan.org/';

let resolvedMirrorLocation: Readonly<URL> | undefined;

export interface CtanMirrorOptions {
  /** @defaultValue `false` */
  readonly master?: boolean | undefined;
}

export async function resolve(options?: CtanMirrorOptions): Promise<URL> {
  if (options?.master ?? false) {
    return new URL(CTAN_MASTER);
  }
  try {
    resolvedMirrorLocation ??= await getLocation(CTAN_MIRROR);
    return new URL(resolvedMirrorLocation.href);
  } catch (cause) {
    throw new Error(
      `Failed to resolve the location of ${CTAN_MIRROR}`,
      { cause },
    );
  }
}
