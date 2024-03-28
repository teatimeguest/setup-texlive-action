import { posix as posixPath } from 'node:path';

import { getJson } from '@setup-texlive-action/utils/http';

const API_VERSION = '2.0';
const API_BASE_URL = `https://ctan.org/json/${API_VERSION}`;

export interface Pkg {
  version?: {
    number?: string;
  };
  texlive?: string;
}

export async function pkg(name: string): Promise<Pkg> {
  const path = `/pkg/${name}`;
  const endpoint = posixPath.join(API_BASE_URL, path);
  return await getJson<Pkg>(endpoint);
}
