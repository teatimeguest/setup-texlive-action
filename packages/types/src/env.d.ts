/* eslint-disable */

namespace NodeJS {
  interface ProcessEnv {
    /**
     * @see {@link https://no-color.org/}
     */
    NO_COLOR?: string;

    /**
     * @see {@link https://docs.github.com/en/actions/learn-github-actions/variables#default-environment-variables}
     */
    GITHUB_ACTIONS?: string;
    GITHUB_ACTION_PATH?: string;
    GITHUB_WORKSPACE?: string;
    RUNNER_DEBUG?: string;
    RUNNER_TEMP?: string;
  }
}
