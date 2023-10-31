import { readFile } from 'node:fs/promises';

import { list } from '#/texlive/tlmgr/actions/list';
import { TlmgrInternals, set } from '#/texlive/tlmgr/internals';
import type { Tlpobj } from '#/texlive/tlpkg';

vi.unmock('#/texlive/tlmgr/actions/list');

const years = ['2008', '2023'] as const;
const tlpdb = {
  '2008': new Set<Tlpobj>(),
  '2023': new Set<Tlpobj>(),
} as const;

beforeAll(async () => {
  for (const year of years) {
    set(new TlmgrInternals({ TEXDIR: '', version: year }), true);
    vi.mocked(readFile).mockResolvedValueOnce(
      await fixtures(`texlive.${year}.tlpdb`),
    );
    for await (const tlpobj of list()) {
      tlpdb[year].add(tlpobj);
    }
  }
});

it('lists texlive.infra', () => {
  expect(tlpdb['2008']).toContainEqual(
    expect.objectContaining({
      name: 'texlive.infra',
      version: undefined,
      revision: '12186',
    }),
  );
  expect(tlpdb['2023']).toContainEqual(
    expect.objectContaining({
      name: 'texlive.infra',
      version: undefined,
      revision: '66822',
    }),
  );
});

it('does not list schemes and collections', () => {
  expect(tlpdb['2008']).not.toContainEqual(
    expect.objectContaining({ name: 'scheme-minimal' }),
  );
  expect(tlpdb['2008']).not.toContainEqual(
    expect.objectContaining({ name: 'collection-basic' }),
  );
  expect(tlpdb['2023']).not.toContainEqual(
    expect.objectContaining({ name: 'scheme-infraonly' }),
  );
});

it.each(years)('does not list architecture-specific packages (%s)', (year) => {
  expect(tlpdb[year]).not.toContainEqual(
    expect.objectContaining({ name: 'kpathsea.x86_64-linux' }),
  );
  expect(tlpdb[year]).not.toContainEqual(
    expect.objectContaining({ name: 'texlive.infra.x86_64-linux' }),
  );
});

it('does not list texlive metadata', () => {
  expect(tlpdb['2008']).not.toContainEqual(
    expect.objectContaining({ name: '00texlive-installation.config' }),
  );
  expect(tlpdb['2023']).not.toContainEqual(
    expect.objectContaining({ name: '00texlive.config' }),
  );
});

it('lists normal packages', () => {
  expect(tlpdb['2008']).toContainEqual(
    expect.objectContaining({
      name: 'pdftex',
      version: '1.40.9',
      revision: '12898',
    }),
  );
  expect(tlpdb['2023']).toContainEqual(
    expect.objectContaining({
      name: 'hyphen-base',
      version: undefined,
      revision: '66413',
    }),
  );
});
