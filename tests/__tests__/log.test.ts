import util from 'node:util';

import * as core from '@actions/core';

import * as log from '#/log';

jest.spyOn(util, 'formatWithOptions');
jest.mocked(core.setFailed).mockImplementation();

beforeEach(() => {
  jest.mocked(core.isDebug).mockReturnValue(false);
});

describe('debug', () => {
  it('logs nothing if debug logs are disabled', () => {
    log.debug('test');
    expect(core.debug).not.toHaveBeenCalled();
  });

  it('logs messages if debug logs are enabled', () => {
    jest.mocked(core.isDebug).mockReturnValue(true);
    log.debug('test');
    expect(core.debug).toHaveBeenCalledOnce();
  });

  it('does not logs stack traces by default', () => {
    const error = new Error('NG');
    log.debug({ error }, 'Failed to ...');
    expect(util.formatWithOptions).not.toHaveBeenCalledWith();
  });

  it('logs stack traces if debug logs are enabled', () => {
    jest.mocked(core.isDebug).mockReturnValue(true);
    const error = new Error('NG');
    log.debug({ error }, 'Failed to ...');
    expect(util.formatWithOptions).toHaveBeenCalledTimes(2);
    expect(core.debug).toHaveBeenCalledTimes(2);
    expect(jest.mocked(core.debug).mock.lastCall?.[0]).toMatchInlineSnapshot(
      `"Failed to ...: Error: NG"`,
    );
  });

  it('never calls `core.notice`', () => {
    jest.mocked(core.isDebug).mockReturnValue(true);
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

  it('does not logs stack traces by default', () => {
    const error = new Error('NG');
    log.info({ error }, 'Failed to ...');
    expect(util.formatWithOptions).not.toHaveBeenCalledWith();
  });

  it('logs stack traces if debug logs are enabled', () => {
    jest.mocked(core.isDebug).mockReturnValue(true);
    const error = new Error('NG');
    log.info({ error }, 'Failed to ...');
    expect(util.formatWithOptions).toHaveBeenCalledTimes(2);
    expect(core.debug).toHaveBeenCalledOnce();
    expect(core.debug).toHaveBeenCalledBefore(jest.mocked(core.info));
    expect(jest.mocked(core.info).mock.lastCall?.[0]).toMatchInlineSnapshot(
      `"Failed to ...: Error: NG"`,
    );
  });

  it('never calls `core.notice`', () => {
    jest.mocked(core.isDebug).mockReturnValue(true);
    const error = new Error('NG');
    error['note'] = 'Note';
    log.info({ error }, 'Failed to ...');
    expect(core.notice).not.toHaveBeenCalled();
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
    expect(core.info).toHaveBeenCalledBefore(jest.mocked(core.warning));
    expect(jest.mocked(core.warning).mock.lastCall?.[0]).toMatchInlineSnapshot(
      `"Failed to ...: Error: NG"`,
    );
  });

  it('calls `core.notice`', () => {
    jest.mocked(core.isDebug).mockReturnValue(true);
    const error = new Error('NG');
    error['note'] = 'Note';
    log.warn({ error }, 'Failed to ...');
    expect(core.notice).toHaveBeenCalled();
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
    expect(core.info).toHaveBeenCalledBefore(jest.mocked(core.setFailed));
    expect(jest.mocked(core.setFailed).mock.lastCall?.[0])
      .toMatchInlineSnapshot(
        `"Failed to ...: Error: NG"`,
      );
  });

  it('calls `core.notice`', () => {
    jest.mocked(core.isDebug).mockReturnValue(true);
    const errors = [
      new Error('Error 1'),
      'Error 2',
      new TypeError(undefined, {
        cause: new Error('Error 4', {
          cause: 'Error 5',
        }),
      }),
    ] as const;
    errors[0]['note'] = 'Note 1';
    (errors[2].cause as Error)['note'] = 'Note 2';
    log.fatal({
      error: new AggregateError(errors, 'Several errors occured'),
    }, 'Failed to ...');
    expect(core.notice).toHaveBeenCalledTimes(2);
  });
});
