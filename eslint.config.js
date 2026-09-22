// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

/**
 * The dependency rule, enforced by tooling rather than by discipline.
 *
 * src/core, src/models and src/services are the inside of the application.
 * They must not import React, Expo, Drizzle or anything from the outer layers,
 * so the business rules stay testable without a device and the storage or UI
 * can be replaced without touching them. A violation fails CI.
 */
const INNER_LAYERS = ['src/core/**', 'src/models/**', 'src/services/**'];

const FORBIDDEN_IN_INNER_LAYERS = [
  'react',
  'react/*',
  'react-native',
  'react-native/*',
  'react-native-*',
  'expo',
  'expo-*',
  'drizzle-orm',
  'drizzle-orm/**',
  '**/data/**',
  '**/views/**',
  '**/viewmodels/**',
  '**/di/**',
  '@/data/**',
  '@/views/**',
  '@/viewmodels/**',
  '@/di/**',
];

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', '.expo/*', 'drizzle/*', 'node_modules/*'],
  },
  {
    files: INNER_LAYERS,
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: FORBIDDEN_IN_INNER_LAYERS,
              message:
                'core, models and services must stay framework-free. See "Architecture" in README.md.',
            },
          ],
        },
      ],
    },
  },
]);
