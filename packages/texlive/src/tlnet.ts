import type { IncomingHttpHeaders } from 'node:http';

import { match } from '@setup-texlive-action/data';
import tlnet from '@setup-texlive-action/data/tlnet.json';
import { getHeaders } from '@setup-texlive-action/utils/http';
import { parseTemplate } from 'url-template';

import { mirrors } from '#texlive/ctan';
import { Version } from '#texlive/version';

export type TlnetOptions = mirrors.CtanMirrorOptions;

export async function ctan(options?: TlnetOptions): Promise<URL> {
  return new URL(tlnet.ctan.path, await mirrors.resolve(options));
}

export async function contrib(options?: TlnetOptions): Promise<URL> {
  return new URL(tlnet.tlcontrib.path, await mirrors.resolve(options));
}

export function historic(version: Version, options?: TlnetOptions): URL {
  const [template] = match(tlnet.historic.path, { version });
  const tlnetPath = parseTemplate(template).expand({ version });
  const base = (options?.master ?? false)
    ? tlnet.historic.master
    : tlnet.historic.default;
  return new URL(tlnetPath, base);
}

export async function checkVersionFile(
  repository: Readonly<URL>,
  version: Version,
): Promise<IncomingHttpHeaders | undefined> {
  const pretest = repository.pathname.includes(tlnet.tlpretest.path);
  const template = tlnet[pretest ? 'tlpretest' : 'ctan'].versionFile;
  const file = parseTemplate(template).expand({ version });
  try {
    return await getHeaders(new URL(file, repository));
  } catch {
    return undefined;
  }
}
