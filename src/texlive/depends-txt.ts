import * as log from '#/log';

const RE = {
  comments: /#.*/gv,
  directive: /^(?<type>package|hard|soft)($|\s(?<args>.*))/v,
  whitespaces: /\s+/v,
};

export type DependencyType = 'hard' | 'soft';
export type Directive = 'package' | DependencyType;

export interface Dependency {
  readonly name: string;
  readonly type: DependencyType;
  readonly package?: string | undefined;
}

export function* parse(input: string): Generator<Dependency, void, void> {
  let pkg: Dependency['package'];
  for (const [line] of lines(input)) {
    const match = RE.directive.exec(line)?.groups
      ?? { type: 'hard', args: line };
    const type = match['type'] as Directive;
    const args = match['args']?.trim() ?? '';
    if (type === 'package') {
      if (args.length === 0 || RE.whitespaces.test(args)) {
        log.warn(
          '`%s` directive must have exactly one argument, but given: %j',
          type,
          args,
        );
        pkg = undefined;
      } else {
        pkg = args;
      }
    } else {
      for (const name of args.split(RE.whitespaces)) {
        if (name.length > 0) {
          yield { name, type, package: pkg } as Dependency;
        }
      }
    }
  }
}

/** @yields Non-empty line with its 1-based index. */
function* lines(input: string): Generator<[string, number], void, void> {
  yield* input
    .replaceAll(RE.comments, '')
    .split('\n')
    .map<[string, number]>((line, index) => [line.trim(), index + 1])
    .filter(([line]) => line.length > 0);
}
