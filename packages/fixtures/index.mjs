import path from 'node:path';

/** @returns {import('vite').Plugin} */
export default function fixtures() {
  return {
    name: '@setup-texlive-action/fixtures',
    async transform(code, id) {
      const ext = path.extname(id);
      if (ext === '.http') {
        return {
          code: `
            import parseHttp from 'http-headers';

            const http = parseHttp(${JSON.stringify(code)});
            export const { version, statusCode, statusMessage, headers } = http;
            export default http;
          `,
        };
      } else if (
        ['.log', '.stderr', '.stdout', '.tlpdb'].includes(ext)
      ) {
        return {
          code: `
            export default ${JSON.stringify(code)};
          `,
        };
      }
    },
  };
}
