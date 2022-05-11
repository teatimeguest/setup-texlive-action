module.exports = {
  automock: true,
  clearMocks: true,
  globals: {
    'ts-jest': {
      compiler: 'ttypescript'
    }
  },
  moduleFileExtensions: ['js', 'ts'],
  moduleNameMapper: {
    "^#/(.*)": "<rootDir>/src/$1",
  },
  setupFilesAfterEnv: ['jest-extended/all'],
  testEnvironment: 'node',
  testMatch: ['<rootDir>/__tests__/*.test.ts'],
  testRunner: 'jest-circus/runner',
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  unmockedModulePathPatterns: [
    '<rootDir>/node_modules/jest-extended/',
  ],
  verbose: false,
}
