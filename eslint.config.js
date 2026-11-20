// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'jest.setup.js'],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      // TypeScript (tsc) sudah memeriksa ekspor; plugin import tidak membaca `export *` dari paket Expo.
      'import/namespace': 'off',
    },
  },
]);
