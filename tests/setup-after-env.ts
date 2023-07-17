import 'jest-extended';
import 'jest-extended/all';

import '#/globals';

// https://www.rfc-editor.org/rfc/rfc2606.html
const mockUrl = 'https://example.com/';

for (const mod of ['fs/promises', 'os', 'path', 'process']) {
  jest.mock(`node:${mod}`, () => jest.requireMock(mod));
}

jest.mock('#/action/cache', () => {
  class CacheClient {
    async restore(): Promise<void> {}
    update(): void {}
    saveState(): void {}
  }
  CacheClient.prototype.restore = jest.fn().mockResolvedValue({
    hit: false,
    full: false,
    restored: false,
  });
  CacheClient.prototype.update = jest.fn();
  CacheClient.prototype.saveState = jest.fn();
  return { CacheClient, save: jest.fn().mockResolvedValue(undefined) };
});

jest.unmock('#/ctan');

jest.mock('#/ctan/api', () => ({
  pkg: jest.fn(async (name: string) => {
    return JSON.parse(await loadFixture(`ctan-api-pkg-${name}.json`) ?? '{}');
  }),
}));

jest.mock('#/ctan/mirrors', () => ({
  resolve: jest.fn().mockResolvedValue(new URL(mockUrl)),
}));

jest.unmock('#/tex');

jest.mock('#/tex/kpse', () => ({
  varValue: jest.fn(async (key) => `<${key}>`),
}));

jest.unmock('#/tex/texmf');

jest.unmock('#/texlive');
jest.unmock('#/texlive/depends-txt');

jest.mock('#/texlive/tlnet', () => ({
  ctan: jest.fn().mockResolvedValue(new URL(mockUrl)),
  contrib: jest.fn().mockResolvedValue(new URL(mockUrl)),
  historic: jest.fn().mockReturnValue(new URL(mockUrl)),
}));

jest.unmock('#/texlive/tlmgr');
jest.unmock('#/texlive/tlmgr/action');
jest.unmock('#/texlive/tlmgr/actions');
jest.unmock('#/texlive/tlmgr/cli');
jest.unmock('#/texlive/tlmgr/errors');

jest.mock('#/texlive/tlmgr/internals', () => {
  const actual = jest.requireActual('#/texlive/tlmgr/internals');
  jest.spyOn(actual.TlmgrInternals.prototype, 'exec');
  return actual;
});

jest.mock('#/texlive/tlmgr/actions/conf', () => {
  const actual = jest.requireActual('#/texlive/tlmgr/actions/conf');
  jest.spyOn(actual, 'texmf');
  return actual;
});

jest.mock('#/texlive/tlmgr/actions/list', () => ({
  list: jest.fn(function*() {}),
}));

jest.unmock('#/texlive/tlpkg');
jest.unmock('#/texlive/tlpkg/errors');
jest.unmock('#/texlive/tlpkg/tlpdb');

jest.unmock('#/texlive/version');
jest.unmock('#/texlive/version/types');

jest.mock('#/texlive/version/latest', () => {
  const { config } = jest.requireActual('##/package.json');
  const LATEST_VERSION = config.texlive.latest.version;
  return {
    __esModule: true,
    default: {
      getVersion: jest.fn().mockResolvedValue(LATEST_VERSION),
      getReleaseDate: jest.fn().mockResolvedValue(
        Temporal.PlainDate.from(`${LATEST_VERSION}-04-01`),
      ),
      isLatest: jest.fn(async (v) => v === LATEST_VERSION),
    },
  };
});

jest.unmock('#/util');
jest.unmock('#/util/decorators');

jest.mock('#/util/exec', () => {
  const exec = jest.requireActual('#/util/exec');
  jest.spyOn(exec, 'exec').mockImplementation(async (command, args) => {
    return new exec.ExecResult({
      command,
      args,
      exitCode: 0,
      stderr: '',
      stdout: '',
    });
  });
  return exec;
});

jest.mock('#/util/fs', () => ({
  extract: jest.fn().mockResolvedValue('<extract>'),
  mkdtemp: jest.fn(async function*() {
    yield '<mkdtemp>';
  }),
  tmpdir: jest.fn().mockReturnValue('<tmpdir>'),
  uniqueChild: jest.fn().mockResolvedValue('<uniqueChild>'),
}));

jest.unmock('#/util/serializable');
jest.unmock('#/util/types');
