import * as log from '#/log';
import { DependsTxt } from '#/texlive/depends-txt';

jest.unmock('#/texlive/depends-txt');

describe('parse', () => {
  it('parses DEPENDS.txt', () => {
    const manifest = new DependsTxt(
      [
        'foo bar  baz',
        'hard\tqux ',
        ' soft quux# this is a comment',
        '',
        'package corge\t# this is a comment',
        '#',
        '  package  grault  ',
        'soft garply#',
        ' waldo',
        'package\tcorge',
        '  \tbaz',
      ]
        .join('\n'),
    );
    expect(manifest.get('')).toHaveProperty(
      'hard',
      new Set(['foo', 'bar', 'baz', 'qux']),
    );
    expect(manifest.get('')).toHaveProperty('soft', new Set(['quux']));
    expect(manifest.get('corge')).toHaveProperty('hard', new Set(['baz']));
    expect(manifest.get('corge')).not.toHaveProperty('soft');
    expect(manifest.get('grault')).toHaveProperty('hard', new Set(['waldo']));
    expect(manifest.get('grault')).toHaveProperty('soft', new Set(['garply']));
    expect([...manifest]).toHaveLength(3);
  });

  it('tolerates some syntax errors', () => {
    const manifest = new DependsTxt(
      [
        'package', // no argument
        'package#', // no argument
        'hard', // no argument
        'soft#', // no argument, immediately followed by a comment
        'package foo bar', // multiple arguments
        'soft', // no argument, with immediate EOF
      ]
        .join('\n'),
    );
    expect(manifest.get('')).not.toHaveProperty('hard');
    expect(manifest.get('')).not.toHaveProperty('soft');
    expect([...manifest]).toHaveLength(1);
    expect(log.warn).toHaveBeenCalledTimes(3);
  });
});
