import * as log from '#/log';
import { parse } from '#/texlive/depends-txt';

import { dedent } from 'ts-dedent';

jest.unmock('#/texlive/depends-txt');

describe('parse', () => {
  it('parses DEPENDS.txt', () => {
    const txt = dedent`
      foo bar  baz
      hard\tqux
       soft quux# this is a comment

      package corge\t# this is a comment
      #
        package  grault
      soft garply#
       waldo
      package\tcorge
        \tbaz
    `;
    const deps = [...parse(txt)];
    expect(deps).toHaveLength(8);
    expect(deps).toContainEqual({
      name: 'foo',
      type: 'hard',
      package: undefined,
    });
    expect(deps).toContainEqual({
      name: 'bar',
      type: 'hard',
      package: undefined,
    });
    expect(deps).toContainEqual({
      name: 'baz',
      type: 'hard',
      package: undefined,
    });
    expect(deps).toContainEqual({
      name: 'qux',
      type: 'hard',
      package: undefined,
    });
    expect(deps).toContainEqual({
      name: 'quux',
      type: 'soft',
      package: undefined,
    });
    expect(deps).toContainEqual({
      name: 'garply',
      type: 'soft',
      package: 'grault',
    });
    expect(deps).toContainEqual({
      name: 'waldo',
      type: 'hard',
      package: 'grault',
    });
    expect(deps).toContainEqual({
      name: 'baz',
      type: 'hard',
      package: 'corge',
    });
  });

  it('tolerates some syntax errors', () => {
    const txt = [
      'package', // no argument
      'package#', // no argument
      'hard', // no argument
      'soft#', // no argument, immediately followed by a comment
      'package foo bar', // multiple arguments
      'soft', // no argument, with immediate EOF
    ]
      .join('\n');
    const deps = [...parse(txt)];
    expect(deps).toHaveLength(0);
    expect(log.warn).toHaveBeenCalledTimes(3);
  });
});
