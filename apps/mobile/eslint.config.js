const expo = require('eslint-config-expo/flat');
const tseslint = require('typescript-eslint');

module.exports = [
  ...expo,
  { ignores: ['dist/*', '.expo/*', 'node_modules/*', 'coverage/*'] },
  { files: ['*.config.js'], languageOptions: { globals: { __dirname: 'readonly', require: 'readonly', module: 'readonly' } } },
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: { '@typescript-eslint/no-explicit-any': 'error' },
  },
];
