import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import vue from 'eslint-plugin-vue';
import globals from 'globals';
import ts from 'typescript-eslint';

export default ts.config(
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'dev-dist/**',
      'coverage/**',
      '.agents/**',
      '.serena/**',
      '.omx/**',
      '.playwright-cli/**',
      '.idea/**',
      '.qa-song/**',
      'output/**',
      'design/qa/**',
      '.husky/_/**',
    ],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  ...vue.configs['flat/recommended'],
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx,vue}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: { parser: ts.parser },
    },
  },
  {
    files: ['**/*.test.ts'],
    rules: { 'vue/one-component-per-file': 'off' },
  },
  {
    // This registration component renders its slots through AppPageFrame.
    files: ['src/components/PageHeader.vue'],
    rules: {
      'vue/one-component-per-file': 'off',
      'vue/valid-template-root': 'off',
    },
  },
  eslintConfigPrettier,
);
