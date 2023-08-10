import { env } from 'node:process';

env['TS_JEST_DISABLE_VER_CHECKER'] = true;

export default {
  clearMocks: true,
  moduleFileExtensions: ['js', 'ts'],
  moduleNameMapper: {
    '^#/(.*)': '<rootDir>/src/$1',
    '^class-transformer/esm5/(.*)': 'class-transformer/cjs/$1',
  },
  resetModules: true,
  rootDir: env.npm_config_local_prefix,
  roots: ['<rootDir>/tests', '<rootDir>'],
  setupFiles: [
    '<rootDir>/tests/setup.ts',
  ],
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup-after-env.ts',
  ],
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/tests/__tests__/**/*.test.ts',
  ],
  transform: {
    '/action/run/main\\.ts$': '##/tests/esbuild-transformer.mjs',
    '.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tests/tsconfig.json' }],
  },
  verbose: false,
};
