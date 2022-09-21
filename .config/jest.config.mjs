export default {
  automock: true,
  clearMocks: true,
  moduleFileExtensions: ['js', 'ts'],
  moduleNameMapper: {
    '^#/(.*)': '<rootDir>/src/$1',
  },
  resetModules: true,
  rootDir: process.cwd(),
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.ts'],
  testEnvironment: 'node',
  testMatch: ['<rootDir>/__tests__/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      compiler: 'ttypescript',
      tsconfig: '<rootDir>/tsconfig.tests.json',
    }],
  },
  unmockedModulePathPatterns: [
    '<rootDir>/node_modules/class-transformer/',
    '<rootDir>/node_modules/decorator-cache-getter/',
    '<rootDir>/node_modules/jest-extended/',
  ],
  verbose: false,
};
