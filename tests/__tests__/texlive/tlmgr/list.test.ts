import { readFile } from 'node:fs/promises';

import { list } from '#/texlive/tlmgr/actions/list';
import { TlmgrInternals, set } from '#/texlive/tlmgr/internals';
import type { Tlpobj } from '#/texlive/tlpkg';

jest.unmock('#/texlive/tlmgr/actions/list');

const tlpdb: Array<Tlpobj> = [];

beforeAll(async () => {
  set(new TlmgrInternals({ TEXDIR: '', version: LATEST_VERSION }));
  jest.mocked(readFile).mockResolvedValue(await loadFixture('texlive.tlpdb'));
  for await (const tlpobj of list()) {
    tlpdb.push(tlpobj);
  }
});

it.skip('strips comments and escaped line breaks', () => {
  expect(tlpdb).toContainEqual(
    expect.objectContaining({
      name: 'latex',
      version: '2021-11-15 PL1',
      revision: '61232',
    }),
  );
});

it('lists texlive.infra', () => {
  expect(tlpdb).toContainEqual(
    expect.objectContaining({
      name: 'texlive.infra',
      version: undefined,
      revision: '66822',
    }),
  );
});

it('does not list schemes and collections', () => {
  expect(tlpdb).not.toContainEqual(
    expect.objectContaining({ name: 'scheme-infraonly' }),
  );
});

it('does not list architecture-specific packages', () => {
  expect(tlpdb).not.toContainEqual(
    expect.objectContaining({ name: 'kpathsea.x86_64-linux' }),
  );
});

it('does not list texlive metadata', () => {
  expect(tlpdb).not.toContainEqual(
    expect.objectContaining({ name: '00texlive.config' }),
  );
});

it.skip('lists normal packages', () => {
  expect(tlpdb).toContainEqual(
    expect.objectContaining({
      name: 'hyphen-base',
      version: '7.00n',
      revision: '62142',
    }),
  );
});
