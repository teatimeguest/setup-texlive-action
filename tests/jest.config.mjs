import { env } from 'node:process';

import packageJson from '##/package.json' assert { type: 'json' };

env['TS_JEST_DISABLE_VER_CHECKER'] = true;

export default {
  automock: true,
  clearMocks: true,
  moduleFileExtensions: ['js', 'ts'],
  moduleNameMapper: {
    '^#/(.*)': '<rootDir>/src/$1',
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
    '^.+\\.ts$': [
      'ts-jest',
      { tsconfig: '<rootDir>/tests/tsconfig.json' },
    ],
  },
  unmockedModulePathPatterns: [
    '/node_modules/@abraham/reflection/',
    '/node_modules/class-transformer/',
    '/node_modules/semver/',
    '/node_modules/temporal-polyfill/',
    ...Object
      .keys(packageJson.devDependencies)
      .map((module) => `/node_modules/${module}/`),
  ],
  verbose: false,
};
