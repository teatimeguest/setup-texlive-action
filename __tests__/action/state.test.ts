import * as core from '@actions/core';

import { State } from '#/action/state';

jest.unmock('#/action/state');

describe('State', () => {
  describe('constructor', () => {
    it.each([
      [false, ''],
      [true, '{}'],
      [true, '{ "key": "key" }'],
      [true, '{ "key": "key", "texdir": "texdir" }'],
    ])('sets post to %s (%p)', (value, state) => {
      jest.mocked(core.getState).mockReturnValueOnce(state);
      expect(new State()).toHaveProperty('post', value);
    });

    it('gets state', () => {
      const state = { key: '<key>', texdir: '<texdir>' };
      jest.mocked(core.getState).mockReturnValueOnce(JSON.stringify(state));
      expect(new State()).toMatchObject(state);
    });
  });

  describe('save', () => {
    it('saves state', () => {
      expect(() => {
        const state = new State();
        state.key = '<key>';
        state.texdir = '<texdir>';
        state.save();
      })
        .not
        .toThrow();
      expect(core.saveState).toHaveBeenCalled();
    });

    it('saves empty state', () => {
      expect(() => {
        new State().save();
      })
        .not
        .toThrow();
      expect(core.saveState).toHaveBeenCalled();
    });
  });
});
