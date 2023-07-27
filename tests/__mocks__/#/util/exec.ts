const actual = jest.requireActual('#/util/exec');

jest.spyOn(actual, 'exec').mockImplementation(async (command, args) => {
  return new actual.ExecResult({
    command,
    args,
    exitCode: 0,
    stderr: '',
    stdout: '',
  });
});

export const { ExecError, ExecResult, exec, processArgsAndOptions } = actual;
