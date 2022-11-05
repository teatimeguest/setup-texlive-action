import * as core from '@actions/core';

import { Outputs } from '#/action/outputs';
import { Version } from '#/texlive';

const v = (spec: unknown) => new Version(`${spec}`);

jest.unmock('#/action/outputs');

describe('Outputs#cacheHit', () => {
  it.each([true, false])('sets cache-hit to %s', (value) => {
    const outputs = new Outputs();
    outputs.cacheHit = value;
    outputs.version = v`latest`;
    outputs.emit();
    expect(core.setOutput).toHaveBeenCalledTimes(2);
    expect(core.setOutput).toHaveBeenCalledWith('cache-hit', value);
  });

  it.each([
    ['2017', v`2017`],
    [Version.LATEST, v`latest`],
  ])('sets version to %p', (value, version) => {
    const outputs = new Outputs();
    outputs.version = version;
    outputs.emit();
    expect(core.setOutput).toHaveBeenCalledTimes(2);
    expect(core.setOutput).toHaveBeenCalledWith('version', value);
  });
});
