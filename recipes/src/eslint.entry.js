import { Linter } from 'eslint/universal';
import rules from 'accrete-eslint-rules';
import js from '@eslint/js';
import * as tsParser from '@typescript-eslint/parser';

const RULES = { ...js.configs.recommended.rules, 'no-undef': 'off', 'no-unused-vars': 'off' };

for (const id of Object.keys(RULES)) {
  const rule = rules.get(id);
  if (rule !== undefined) rule.meta = { ...rule.meta, schema: false };
}

const CONFIG = [{ files: ['**/*.ts', '**/*.js', '**/*.mjs'], languageOptions: { parser: tsParser, sourceType: 'module', ecmaVersion: 'latest' }, rules: RULES }];

export const run = async ({ args, files }) => {
  const linter = new Linter();
  const lines = [];
  for (const path of args.filter((arg) => !arg.startsWith('-'))) {
    for (const message of linter.verify(files[path] ?? '', CONFIG, path)) {
      lines.push(`${path}:${message.line}:${message.column} ${message.ruleId} ${message.message}`);
    }
  }
  return { stdout: lines.join('\n') + '\n', files: {} };
};
