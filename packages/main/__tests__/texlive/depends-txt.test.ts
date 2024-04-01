import { describe, expect, it, vi } from 'vitest';

import * as core from '@actions/core';
import { dedent } from 'ts-dedent';

import { parse } from '#/texlive/depends-txt';

vi.unmock('#/texlive/depends-txt');

describe('parse', () => {
  it('parses DEPENDS.txt', async () => {
    const deps = [...parse(
      // editorconfig-checker-disable
      dedent`
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
      `,
      // editorconfig-checker-enable
    )];
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

  it('tolerates some syntax errors', async () => {
    const deps = [...parse(
      // dprint-ignore
      [
        'package',         // no argument
        'package#',        // no argument
        'hard',            // no argument
        'soft#',           // no argument, immediately followed by a comment
        'package foo bar', // multiple arguments
        'soft',            // no argument, with immediate EOF
      ]
        .join('\n'),
    )];
    expect(deps).toHaveLength(0);
    expect(core.warning).toHaveBeenCalledTimes(3);
    expect(vi.mocked(core.warning).mock.calls[0]?.[0]).toMatchInlineSnapshot(
      `"\`package\` directive must have exactly one argument, but given: """`,
    );
    expect(vi.mocked(core.warning).mock.calls[1]?.[0]).toMatchInlineSnapshot(
      `"\`package\` directive must have exactly one argument, but given: """`,
    );
    expect(vi.mocked(core.warning).mock.calls[2]?.[0]).toMatchInlineSnapshot(
      `"\`package\` directive must have exactly one argument, but given: "foo bar""`,
    );
  });
});
