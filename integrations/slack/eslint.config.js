const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');
const jestPlugin = require('eslint-plugin-jest');
const importPlugin = require('eslint-plugin-import');
const prettierPlugin = require('eslint-plugin-prettier');
const unusedImportsPlugin = require('eslint-plugin-unused-imports');

module.exports = [
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: {
      jest: jestPlugin,
      import: importPlugin,
      prettier: prettierPlugin,
      'unused-imports': unusedImportsPlugin,
    },
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      parser: tseslint.parser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      curly: 'warn',
      'dot-location': 'warn',
      eqeqeq: 'error',
      'prettier/prettier': 'warn',
      'unused-imports/no-unused-imports': 'warn',
      'no-else-return': 'warn',
      'no-lonely-if': 'warn',
      'no-inner-declarations': 'off',
      'no-unused-vars': 'off',
      'no-useless-computed-key': 'warn',
      'no-useless-return': 'warn',
      'no-var': 'warn',
      'object-shorthand': ['warn', 'always'],
      'prefer-arrow-callback': 'warn',
      'prefer-const': 'warn',
      'prefer-destructuring': ['warn', { AssignmentExpression: { array: true } }],
      'prefer-object-spread': 'warn',
      'prefer-template': 'warn',
      'spaced-comment': ['warn', 'always', { markers: ['/'] }],
      yoda: 'warn',
      'import/order': [
        'warn',
        {
          'newlines-between': 'always',
          groups: ['type', 'builtin', 'external', 'internal', ['parent', 'sibling'], 'index'],
          pathGroupsExcludedImportTypes: ['builtin'],
          pathGroups: [],
          alphabetize: {
            order: 'asc',
            caseInsensitive: true,
          },
        },
      ],
      '@typescript-eslint/array-type': ['warn', { default: 'array-simple' }],
      '@typescript-eslint/ban-ts-comment': [
        'warn',
        {
          'ts-expect-error': 'allow-with-description',
        },
      ],
      '@typescript-eslint/consistent-indexed-object-style': ['warn', 'record'],
      '@typescript-eslint/consistent-type-definitions': ['warn', 'interface'],
      '@typescript-eslint/no-unused-vars': 'warn',
    },
  },
  {
    files: ['scripts/**/*'],
    rules: {
      '@typescript-eslint/no-var-requires': 'off',
    },
  },
];
