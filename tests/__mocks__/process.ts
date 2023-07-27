beforeEach(() => {
  process.env = {
    RUNNER_TEMP: '<RUNNER_TEMP>',
  };
});

module.exports = {
  env: process.env,
};
