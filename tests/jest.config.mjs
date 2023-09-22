import { env } from 'node:process';

env['TS_JEST_DISABLE_VER_CHECKER'] = true;
const r = String.raw;

export default {
  clearMocks: true,
  collectCoverageFrom: [
    '<rootDir>/src/**/*.ts',
    '!<rootDir>/**/*.d.ts',
    '!<rootDir>/src/index.ts',
    '!<rootDir>/src/globals.ts',
    '!<rootDir>/src/shim/**',
  ],
  coverageProvider: 'v8',
  moduleFileExtensions: ['js', 'ts'],
  moduleNameMapper: {
    '^#/(.*)': '<rootDir>/src/$1',
    '^class-transformer/esm5/(.*)': 'class-transformer/cjs/$1',
  },
  resetModules: true,
  rootDir: env.npm_config_local_prefix,
  roots: ['<rootDir>/tests', '<rootDir>'],
  setupFilesAfterEnv: [
    '<rootDir>/tests/jest/setup-after-env.ts',
  ],
  snapshotResolver: '<rootDir>/tests/jest/snapshot-resolver.cjs',
  testEnvironment: '<rootDir>/tests/jest/environment.ts',
  testMatch: [
    '<rootDir>/tests/__tests__/**/*.test.ts',
  ],
  transform: {
    [r`/action/run/main\.ts$`]: '<rootDir>/tests/jest/esbuild-transformer.mjs',
    [r`.+\.ts$`]: ['ts-jest', { tsconfig: '<rootDir>/tests/tsconfig.json' }],
  },
  verbose: false,
};
