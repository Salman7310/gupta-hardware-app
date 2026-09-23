// macOS file sync leaves copies beside the original — "product 2.ts" next to
// "product.ts". They are gitignored, but Jest would still collect them, running
// stale duplicates of real suites and counting stale source toward coverage.
// Matches a space, digits and an extension at the end of the path.
const DUPLICATE_FILE = ' \\d+\\.[jt]sx?$';

module.exports = {
  preset: 'jest-expo',
  testPathIgnorePatterns: ['/node_modules/', DUPLICATE_FILE],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/__tests__/**', `!**/* [0-9]*.{ts,tsx}`],
  coverageThreshold: {
    // The calculation core is where a bug costs the shopkeeper money.
    './src/core/': { statements: 80, branches: 70, functions: 80, lines: 80 },
  },
};
