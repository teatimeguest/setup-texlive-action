import { stdout } from 'node:process';
import * as util from 'node:util';

import * as core from '@actions/core';

import * as log from '#/log';

const rawSerializer = await vi.importActual<import('pretty-format').Plugin>(
  '##/tests/vitest/raw-serializer',
);

vi.mock('node:util', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:util')>();
  return {
    ...original,
    formatWithOptions: vi.fn(original.formatWithOptions),
  };
});
vi.mocked(core.setFailed).mockImplementation(() => {});

const hasColors = vi.spyOn(stdout, 'hasColors');

let error: Error;

beforeAll(async () => {
  expect.addSnapshotSerializer(rawSerializer);
});

beforeAll(() => {
  const { prepareStackTrace, stackTraceLimit } = Error;
  Error.stackTraceLimit = 0;
  Error.prepareStackTrace = function(err) {
    return String(err) + '\n    at ...'.repeat(2);
  };

  const error1 = new Error('Error 1');
  error1['info1'] = 'Info 1';
  error1['info2'] = 2;
  error1[log.symbols.note] = 'Note 1';
  error1.stack;

  const error2 = new TypeError('Error 2', { cause: error1 });
  error2[log.symbols.note] = 'Note 2';
  error2.stack;

  const error3 = new Error();
  error3['info3'] = 'Info 3';
  error3.stack;

  const error4 = new Error('Error 4') as SuppressedError;
  error4.name = 'SuppressedError';
  error4.suppressed = error2;
  error4.error = error3;
  error4.stack;

  const error5 = new RangeError('Error 5', { cause: 'Error 6' });
  error5[log.symbols.note] = 'Note 1';
  error5.stack;

  error = new AggregateError([
    error4,
    error5,
    'Error 7',
    null,
    undefined,
  ], 'Error 8');
  error.stack;

  Error.stackTraceLimit = stackTraceLimit;
  Error.prepareStackTrace = prepareStackTrace;
});

beforeEach(() => {
  vi.mocked(core.isDebug).mockReturnValue(false);
  hasColors.mockReturnValue(false);
});

describe('debug', () => {
  it('logs nothing if debug logs are disabled', () => {
    log.debug('test');
    expect(core.debug).not.toHaveBeenCalled();
  });

  it('logs messages if debug logs are enabled', () => {
    vi.mocked(core.isDebug).mockReturnValue(true);
    log.debug('test');
    expect(core.debug).toHaveBeenCalledOnce();
  });

  it('does not logs stack traces by default', () => {
    const error = new Error('NG');
    log.debug({ error }, 'Failed to ...');
    expect(util.formatWithOptions).not.toHaveBeenCalledWith();
  });

  it('logs stack traces if debug logs are enabled', () => {
    vi.mocked(core.isDebug).mockReturnValue(true);
    const error = new Error('NG');
    log.debug({ error }, 'Failed to ...');
    expect(util.formatWithOptions).toHaveBeenCalledTimes(2);
    expect(core.debug).toHaveBeenCalledTimes(2);
    expect(vi.mocked(core.debug).mock.lastCall?.[0]).toMatchInlineSnapshot(
      'Failed to ...: Error: NG',
    );
  });

  it('never calls `core.notice`', () => {
    vi.mocked(core.isDebug).mockReturnValue(true);
    const error = new Error('NG');
    error['note'] = 'Note';
    log.debug({ error }, 'Failed to ...');
    expect(core.notice).not.toHaveBeenCalled();
  });
});

describe('info', () => {
  it('logs messages', () => {
    log.info('test');
    expect(core.info).toHaveBeenCalledOnce();
  });

  it('logs stack traces', () => {
    const error = new Error('NG');
    log.info({ error }, 'Failed to ...');
    expect(core.info).toHaveBeenCalledTimes(2);
    expect(vi.mocked(core.info).mock.lastCall?.[0]).toMatchInlineSnapshot(
      'Failed to ...: Error: NG',
    );
  });

  it('never calls `core.notice`', () => {
    vi.mocked(core.isDebug).mockReturnValue(true);
    const error = new Error('NG');
    error['note'] = 'Note';
    log.info({ error }, 'Failed to ...');
    expect(core.notice).not.toHaveBeenCalled();
  });

  it.each([true, false])('logs exception', (value) => {
    hasColors.mockReturnValue(value);
    log.info({ error });
    expect(core.info).toHaveBeenCalled();
    expect(vi.mocked(core.info).mock.calls[0]?.[0]).toMatchSnapshot();
  });
});

describe('warn', () => {
  it('logs messages', () => {
    log.warn('test');
    expect(core.warning).toHaveBeenCalledOnce();
  });

  it('always logs stack traces', () => {
    const error = new Error('NG');
    log.warn({ error }, 'Failed to ...');
    expect(util.formatWithOptions).toHaveBeenCalledTimes(2);
    expect(core.warning).toHaveBeenCalledOnce();
    expect(core.info).toHaveBeenCalledBefore(core.warning);
    expect(vi.mocked(core.warning).mock.lastCall?.[0]).toMatchInlineSnapshot(
      'Failed to ...: Error: NG',
    );
  });

  it('calls `core.notice`', () => {
    vi.mocked(core.isDebug).mockReturnValue(true);
    const error = new Error('NG');
    error[log.symbols.note] = 'Note';
    log.warn({ error });
    expect(core.notice).toHaveBeenCalled();
  });

  it('logs exception', () => {
    hasColors.mockReturnValue(true);
    log.warn({ error });
    expect(core.info).toHaveBeenCalledOnce();
    expect(vi.mocked(core.info).mock.lastCall?.[0]).toMatchSnapshot();
  });
});

describe('fatal', () => {
  it('logs messages', () => {
    log.fatal('test');
    expect(core.setFailed).toHaveBeenCalledOnce();
  });

  it('always logs stack traces', () => {
    const error = new Error('NG');
    log.fatal({ error }, 'Failed to ...');
    expect(util.formatWithOptions).toHaveBeenCalledTimes(2);
    expect(core.setFailed).toHaveBeenCalledOnce();
    expect(core.info).toHaveBeenCalledBefore(core.setFailed);
    expect(vi.mocked(core.setFailed).mock.lastCall?.[0])
      .toMatchInlineSnapshot(
        'Failed to ...: Error: NG',
      );
  });

  it('calls `core.notice`', () => {
    vi.mocked(core.isDebug).mockReturnValue(true);
    log.fatal({ error });
    expect(core.notice).toHaveBeenCalledTimes(2);
  });
});
