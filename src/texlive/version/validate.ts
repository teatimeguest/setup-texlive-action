import { platform } from 'node:os';

import latest from '#/texlive/version/latest';
import type { Version } from '#/texlive/version/types';

export async function validateReleaseYear(version: Version): Promise<void> {
  if (version < '2008') {
    throw new RangeError('Versions prior to 2008 are not supported');
  }
  if (platform() === 'darwin' && version <= '2013') {
    throw new RangeError(
      'Versions prior to 2013 does not work on 64-bit macOS',
    );
  }
  if (version > await latest.getVersion()) {
    throw new RangeError(`${version} is not a valid version`);
  }
}
