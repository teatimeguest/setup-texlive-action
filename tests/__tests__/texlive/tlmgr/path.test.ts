import { addPath } from '@actions/core';

import * as path from '#/texlive/tlmgr/actions/path';
import { TlmgrInternals, set } from '#/texlive/tlmgr/internals';
import { uniqueChild } from '#/util/fs';

jest.unmock('#/texlive/tlmgr/actions/path');

describe('add', () => {
  beforeEach(() => {
    set(new TlmgrInternals({ TEXDIR: '<TEXDIR>', version: LATEST_VERSION }));
  });

  it('adds the bin directory to the PATH', async () => {
    jest.mocked(uniqueChild).mockResolvedValueOnce('<path>');
    await path.add();
    expect(uniqueChild).toHaveBeenCalledWith('<TEXDIR>/bin');
    expect(addPath).toHaveBeenCalledWith('<path>');
  });

  it('fails as the bin directory cannot be located', async () => {
    jest.mocked(uniqueChild).mockImplementationOnce(() => {
      throw new Error();
    });
    await expect(path.add()).rejects.toThrow(
      "Unable to locate TeX Live's binary directory",
    );
  });
});
