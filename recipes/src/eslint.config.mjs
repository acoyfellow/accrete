import js from '@eslint/js';
import * as tsParser from '@typescript-eslint/parser';

export default [
  {
    files: ['**/*.ts', '**/*.js', '**/*.mjs'],
    languageOptions: { parser: tsParser, sourceType: 'module', ecmaVersion: 'latest' },
    rules: { ...js.configs.recommended.rules, 'no-undef': 'off', 'no-unused-vars': 'off' },
  },
];
