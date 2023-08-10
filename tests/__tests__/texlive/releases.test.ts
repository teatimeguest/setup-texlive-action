import * as ctan from '#/ctan';
import * as log from '#/log';
import { Latest, ReleaseData } from '#/texlive/releases';

jest.unmock('#/texlive/releases');

describe('LatestRelease', () => {
  describe('checkVersion', () => {
    it('checks for latest version using the CTAN API', async () => {
      await expect(new Latest().checkVersion()).resolves.toBe(
        LATEST_VERSION,
      );
      expect(ctan.api.pkg).toHaveBeenCalledWith('texlive');
    });

    it('throws no exception', async () => {
      jest.mocked(ctan.api.pkg).mockResolvedValueOnce({});
      await expect(new Latest().checkVersion()).toResolve();
      expect(log.info).toHaveBeenCalledWith(
        expect.stringContaining('Failed to check'),
        expect.anything(),
      );
    });
  });
});

describe('ReleaseData.setup', () => {
  it('does not usually check for the latest version', async () => {
    await expect(ReleaseData.setup()).toResolve();
    expect(ctan.api.pkg).not.toHaveBeenCalled();
  });

  it('checks for the latest version if needed', async () => {
    jest.spyOn(Temporal.Now, 'instant').mockReturnValueOnce(
      Temporal
        .PlainDateTime
        .from('2024-04-01')
        .toZonedDateTime('UTC')
        .toInstant(),
    );
    await expect(ReleaseData.setup()).toResolve();
    expect(ctan.api.pkg).toHaveBeenCalled();
  });
});
