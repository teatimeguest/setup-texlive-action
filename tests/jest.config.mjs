import path from 'node:path';
import { env } from 'node:process';

import packageJson from '##/package.json' assert { type: 'json' };

env['TS_JEST_DISABLE_VER_CHECKER'] = true;
const tests = '<rootDir>/tests';

export default {
  automock: true,
  clearMocks: true,
  moduleFileExtensions: ['js', 'ts'],
  moduleNameMapper: {
    '^#/(.*)': '<rootDir>/src/$1',
  },
  resetModules: true,
  rootDir: env.npm_config_local_prefix,
  roots: [tests, '<rootDir>'],
  setupFilesAfterEnv: [
    path.join(tests, 'setup.ts'),
  ],
  testEnvironment: 'node',
  testMatch: [
    path.join(tests, '__tests__/**/*.test.ts'),
  ],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      { tsconfig: path.join(tests, 'tsconfig.json') },
    ],
  },
  unmockedModulePathPatterns: [
    '/node_modules/@abraham/reflection/',
    '/node_modules/class-transformer/',
    '/node_modules/decorator-cache-getter/',
    ...Object
      .keys(packageJson.devDependencies)
      .map((module) => `/node_modules/${module}/`),
  ],
  verbose: false,
};
