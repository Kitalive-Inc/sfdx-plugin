import { defineConfig } from 'eslint/config';
import salesforceTypescriptConfig from 'eslint-config-salesforce-typescript';
import sfPlugin from 'eslint-plugin-sf-plugin';

export default defineConfig(
  ...salesforceTypescriptConfig,
  ...sfPlugin.configs.recommended,
  {
    files: ['src/**/*.ts'],
    rules: {
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/no-base-to-string': 'off',
      '@typescript-eslint/no-unnecessary-type-assertion': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      '@typescript-eslint/prefer-promise-reject-errors': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/switch-exhaustiveness-check': 'off',
      'class-methods-use-this': 'off',
      complexity: 'warn',
      'header/header': 'off',
      'import-x/no-extraneous-dependencies': 'off',
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-param-reassign': 'off',
      'preserve-caught-error': 'off',
      'sf-plugin/only-extend-SfCommand': 'off',
    },
  }
);
