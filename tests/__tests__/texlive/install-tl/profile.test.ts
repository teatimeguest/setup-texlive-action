import os from 'node:os';

import { Profile } from '#/texlive/install-tl/profile';
import type { Version } from '#/texlive/version';

jest.unmock('#/texlive/install-tl/profile');

const opts = { prefix: '<prefix>' };

describe('selected_scheme', () => {
  it('uses scheme-infraonly by default', () => {
    const profile = new Profile(LATEST_VERSION, opts);
    expect(profile.selectedScheme).toBe('scheme-infraonly');
  });

  it.each(['2008', '2011', '2014'] as const)(
    'uses scheme-minimal for versions prior to 2016',
    (version) => {
      const profile = new Profile(version, opts);
      expect(profile.selectedScheme).toBe('scheme-minimal');
    },
  );
});

describe('instopt_adjustrepo', () => {
  it('is set to false even for the latest version', () => {
    const profile = new Profile(LATEST_VERSION, opts);
    expect(profile.instopt.adjustrepo).toBe(false);
  });

  it.each(['2008', '2012', '2016', '2020'] as const)(
    'is set to false for an older version',
    (version) => {
      const profile = new Profile(version, opts);
      expect(profile.instopt.adjustrepo).toBe(false);
    },
  );
});

describe.each([
  ...(function*(): Generator<Version, void, void> {
    for (let year = 2008; year <= Number.parseInt(LATEST_VERSION); ++year) {
      yield `${year}` as Version;
    }
  })(),
])('%s', (version) => {
  beforeAll(() => {
    expect.addSnapshotSerializer({
      serialize: (val) => val,
      test: (val) => typeof val === 'string',
    });
  });

  describe.each(['linux', 'win32'] as const)('%s', (platform) => {
    test('texlive.profile', () => {
      const prefix = '$RUNNER_TEMP/setup-texlive-action';
      jest.mocked(os.platform).mockReturnValue(platform);
      expect(new Profile(version, { prefix }).toString()).toMatchSnapshot();
    });
  });
});
