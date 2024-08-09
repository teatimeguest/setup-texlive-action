import { getJson } from '@setup-texlive-action/utils/http';
import { parseTemplate } from 'url-template';

const API_BASE_URL: Readonly<URL> = new URL(
  parseTemplate('https://ctan.org/json/{version}/pkg/{?drop}').expand({
    version: '2.0',
    drop: [
      'aliases',
      'announce',
      'bugs',
      'ctan',
      'descriptions',
      'development',
      'documentation',
      'home',
      'index',
      'install',
      'repository',
      'support',
      'topics',
    ],
  }),
);

export interface Pkg {
  version?: {
    number?: string;
  };
  texlive?: string;
}

export async function pkg(name: string): Promise<Pkg> {
  const url = new URL(name, API_BASE_URL);
  url.search = API_BASE_URL.search;
  return await getJson<Pkg>(url);
}
