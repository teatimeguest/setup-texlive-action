beforeEach(() => {
  globalThis.process.env = {
    RUNNER_TEMP: '<RUNNER_TEMP>',
  };
});

module.exports = {
  get env(): NodeJS.ProcessEnv {
    return globalThis.process.env;
  },
  set env(e: NodeJS.ProcessEnv) {
    globalThis.process.env = e;
  },
};
