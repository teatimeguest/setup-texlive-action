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
  testEnvironment: 'node',
  testMatch: ['<rootDir>/__tests__/*.test.ts'],
  testRunner: 'jest-circus/runner',
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  verbose: false,
}
