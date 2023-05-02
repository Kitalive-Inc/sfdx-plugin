module.exports = {
  extends: [
    'eslint-config-salesforce-typescript',
    'plugin:sf-plugin/recommended',
  ],
  rules: {
    '@typescript-eslint/no-unsafe-argument': 'warn',
    '@typescript-eslint/no-unsafe-assignment': 'warn',
    '@typescript-eslint/no-unsafe-member-access': 'warn',
    '@typescript-eslint/no-unsafe-call': 'warn',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/prefer-nullish-coalescing': 'off',
    '@typescript-eslint/restrict-template-expressions': 'off',
    'class-methods-use-this': 'off',
    complexity: 'warn',
  },
};
