interface Error {
  [key: string]: unknown; // Some additional information.
}

declare namespace NodeJS {
  interface ProcessEnv {
    RUNNER_TEMP?: string;
  }
}

declare module 'class-transformer/esm5/storage' {
  export * from 'class-transformer/types/storage.js';
}
