import js from '@eslint/js';
import pluginVue from 'eslint-plugin-vue';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import vueParser from 'vue-eslint-parser';
import prettierConfig from 'eslint-config-prettier';

const tsConfig = {
  plugins: {
    '@typescript-eslint': tsPlugin,
  },
  files: ['src/**/*.{ts,vue}'],
  languageOptions: {
    parser: vueParser,
    parserOptions: {
      parser: tsParser,
    },
  },
  rules: {
    ...tsPlugin.configs['eslint-recommended'].overrides[0].rules,
  },
};

export default [
  js.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  tsConfig,
  prettierConfig,
];
