import * as core from '@actions/core';

import * as log from '#/log';

jest.unmock('#/log');

describe('log', () => {
  it('invokes core.info by default', () => {
    log.log('');
    expect(core.info).toHaveBeenCalled();
  });

  it.each([['debug'], ['info'], ['error']] as const)(
    'emits logs with specified level',
    (level) => {
      log.log('', { level });
      expect(core[level]).toHaveBeenCalled();
    },
  );

  it('tells the cause of error if cause is set', () => {
    log.log('', { cause: 'some error' });
    expect(core.info).toHaveBeenCalledWith(
      expect.stringContaining(': Caused by some error'),
    );
  });

  it('emits stack trace if cause is an instance of Error', () => {
    const cause = new Error('');
    cause.stack = '<stack trace>';
    log.log('', { level: 'warn', cause });
    expect(core.warning).toHaveBeenCalled();
    expect(core.debug).toHaveBeenCalledWith(
      expect.stringContaining(cause.stack),
    );
  });
});

test.each([['debug'], ['info'], ['error']] as const)('%s', (level) => {
  log[level]('');
  expect(core[level]).toHaveBeenCalled();
});

test('warn', () => {
  log.warn('');
  expect(core.warning).toHaveBeenCalled();
});
