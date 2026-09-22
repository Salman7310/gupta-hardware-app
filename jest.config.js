module.exports = {
  preset: 'jest-expo',
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/__tests__/**'],
  coverageThreshold: {
    // The calculation core is where a bug costs the shopkeeper money.
    './src/core/': { statements: 80, branches: 70, functions: 80, lines: 80 },
  },
};
