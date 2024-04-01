// @ts-check
import * as path from 'node:path';

/** @returns {import('vite').Plugin} */
export default function fixtures() {
  return {
    name: '@setup-texlive-action/fixtures',
    async transform(src, id) {
      switch (path.extname(id)) {
        case '.http':
          return {
            code: `
              import parseHttp from 'http-headers';

              const http = parseHttp(${JSON.stringify(src)});

              export const {
                version,
                statusCode,
                statusMessage,
                headers,
              } = http;
              export default http;
            `,
          };
        case '.log':
        case '.stderr':
        case '.stdout':
        case '.tlpdb':
          return {
            code: `
              export default ${JSON.stringify(src)};
            `,
          };
      }
    },
  };
}
