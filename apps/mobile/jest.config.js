module.exports = {
  preset: 'jest-expo',
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  collectCoverageFrom: ['src/domain/**/*.ts', '!**/*.test.ts'],
  coverageThreshold: { 'src/domain/': { statements: 90, branches: 90, functions: 90, lines: 90 } },
};
