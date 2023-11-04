interface Error {
  [key: string]: unknown; // Some additional information.
}

declare namespace NodeJS {
  /**
   * @see {@link https://docs.github.com/en/actions/learn-github-actions/variables#default-environment-variables}
   */
  interface ProcessEnv {
    GITHUB_ACTIONS?: string;
    GITHUB_ACTION_PATH?: string;
    GITHUB_WORKSPACE?: string;
    RUNNER_DEBUG?: string;
    RUNNER_TEMP?: string;
  }
}

declare module 'class-transformer/esm5/storage' {
  export * from 'class-transformer/types/storage.js';
}
