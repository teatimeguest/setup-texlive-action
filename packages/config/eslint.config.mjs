import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import pluginTs from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import pluginImport from 'eslint-plugin-i';
import pluginNode from 'eslint-plugin-n';
import pluginRegexp from 'eslint-plugin-regexp';
import pluginUnicorn from 'eslint-plugin-unicorn';
import pluginVitest from 'eslint-plugin-vitest';

const flat = new FlatCompat();

export const common = [
  {
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
  },
  js.configs.recommended,
  {
    rules: {
      eqeqeq: 'error',
      'no-extra-boolean-cast': 'off',
      'no-implicit-coercion': 'error',
      'no-inner-declarations': 'off',
      'no-mixed-operators': 'error',
      'no-new-object': 'error',
      'no-new-wrappers': 'error',
      'no-useless-return': 'error',
      'prefer-const': 'error',
      'prefer-exponentiation-operator': 'error',
      'prefer-numeric-literals': 'error',
      'prefer-object-spread': 'error',
      'prefer-promise-reject-errors': 'error',
      'prefer-regex-literals': 'error',
      'require-unicode-regexp': 'error',
    },
  },
  ...flat.extends(
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
  ),
  {
    plugins: {
      'typescript-eslint': pluginTs,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: true,
        ecmaVersion: 'latest',
        sourceType: 'module',
        warnOnUnsupportedTypeScriptVersion: false,
        EXPERIMENTAL_useSourceOfProjectReferenceRedirect: true,
      },
    },
    rules: {
      '@typescript-eslint/array-type': [
        'error',
        { default: 'array' },
      ],
      '@typescript-eslint/consistent-type-assertions': [
        'error',
        { assertionStyle: 'as' },
      ],
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      '@typescript-eslint/dot-notation': 'error',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-empty-interface': 'off',
      '@typescript-eslint/no-inferrable-types': 'off',
      '@typescript-eslint/no-namespace': 'off',
      '@typescript-eslint/no-unsafe-declaration-merging': 'off',
      '@typescript-eslint/prefer-namespace-keyword': 'error',
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
    },
  },
  {
    plugins: {
      import: pluginImport,
    },
    settings: {
      'import/internal-regex': '^#\\w*/',
      'import/parsers': {
        espree: ['.js', '.cjs', '.mjs'],
        '@typescript-eslint/parser': ['.ts'],
      },
    },
    rules: {
      ...pluginImport.configs.recommended.rules,
      ...pluginImport.configs.typescript.rules,
      'import/first': 'error',
      'import/newline-after-import': 'error',
      'import/no-unresolved': 'off',
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'object'],
          pathGroups: [
            {
              pattern: 'vitest',
              group: 'builtin',
              position: 'before',
            },
            {
              pattern: '@vitest/**',
              group: 'builtin',
              position: 'before',
            },
            {
              pattern: '#*/**/*.json',
              group: 'internal',
              position: 'after',
            },
          ],
          pathGroupsExcludedImportTypes: ['vitest', '@vitest/**'],
          'newlines-between': 'always',
          alphabetize: {
            order: 'asc',
          },
        },
      ],
    },
  },
  pluginNode.configs['flat/recommended-module'],
  {
    rules: {
      'n/no-missing-import': 'off',
      'n/no-path-concat': 'error',
    },
  },
  ...flat.extends('plugin:regexp/recommended'),
];

export const sources = [
  {
    rules: {
      'func-style': [
        'error',
        'declaration',
        { allowArrowFunctions: true },
      ],
      'no-await-in-loop': 'error',
      'no-constructor-return': 'error',
      'no-eval': 'error',
      'no-underscore-dangle': 'error',
      'no-useless-rename': 'error',
      'one-var': ['error', 'never'],
    },
  },
  {
    rules: {
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        { allowExpressions: true },
      ],
      '@typescript-eslint/explicit-member-accessibility': [
        'error',
        { accessibility: 'no-public' },
      ],
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'default',
          format: ['camelCase', 'PascalCase'],
        },
        {
          selector: 'default',
          format: null,
          filter: '^__proto__$',
        },
        {
          selector: [
            'accessor',
            'classProperty',
            'objectLiteralProperty',
            'typeProperty',
            'parameter',
            'parameterProperty',
            'typeParameter',
          ],
          format: null,
          filter: '^(?:_$|RUNNER_TEMP$|NOPERLDOC$|TEX|TL_)',
        },
        {
          selector: 'variable',
          modifiers: ['const'],
          format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
        },
        {
          selector: 'memberLike',
          modifiers: ['readonly'],
          format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
        },
        {
          selector: 'accessor',
          format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
        },
        {
          selector: 'typeLike',
          format: ['PascalCase'],
        },
      ],
      '@typescript-eslint/no-confusing-void-expression': 'error',
      '@typescript-eslint/no-implied-eval': 'error',
      '@typescript-eslint/no-invalid-this': 'error',
      '@typescript-eslint/no-loop-func': 'error',
      '@typescript-eslint/no-non-null-asserted-nullish-coalescing': 'error',
      '@typescript-eslint/no-require-imports': 'error',
      '@typescript-eslint/no-shadow': [
        'error',
        { ignoreOnInitialization: true },
      ],
      '@typescript-eslint/no-throw-literal': 'error',
      '@typescript-eslint/no-unnecessary-boolean-literal-compare': 'error',
      // See: https://github.com/typescript-eslint/typescript-eslint/pull/6762
      '@typescript-eslint/no-unnecessary-condition': 'warn',
      '@typescript-eslint/no-unused-expressions': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { ignoreRestSiblings: true },
      ],
      '@typescript-eslint/non-nullable-type-assertion-style': 'error',
      '@typescript-eslint/prefer-readonly-parameter-types': [
        'error',
        {
          ignoreInferredTypes: true,
          treatMethodsAsReadonly: true,
        },
      ],
      '@typescript-eslint/prefer-regexp-exec': 'error',
      '@typescript-eslint/prefer-return-this-type': 'error',
      '@typescript-eslint/require-array-sort-compare': [
        'error',
        { ignoreStringArrays: true },
      ],
      '@typescript-eslint/return-await': ['error', 'always'],
      '@typescript-eslint/strict-boolean-expressions': [
        'error',
        {
          allowNullableObject: false,
          allowNumber: false,
          allowString: false,
        },
      ],
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
    },
  },
  {
    rules: {
      'import/no-commonjs': 'error',
      'import/no-duplicates': 'error',
      'import/no-import-module-exports': 'error',
      'import/no-named-default': 'error',
      'import/no-relative-packages': 'error',
    },
  },
  {
    rules: {
      'n/prefer-global/buffer': ['error', 'never'],
      'n/prefer-global/process': ['error', 'never'],
      'n/prefer-global/url': 'error',
      'n/prefer-global/url-search-params': 'error',
    },
  },
  {
    rules: {
      'regexp/no-super-linear-move': 'warn',
      'regexp/no-useless-flag': 'error',
      'regexp/prefer-escape-replacement-dollar-char': 'error',
      'regexp/require-unicode-sets-regexp': 'error',
    },
  },
  {
    plugins: {
      unicorn: pluginUnicorn,
    },
    rules: {
      ...pluginUnicorn.configs.recommended.rules,
      'unicorn/catch-error-name': 'off',
      'unicorn/consistent-function-scoping': 'off',
      'unicorn/custom-error-definition': 'off',
      'unicorn/no-array-for-each': 'off',
      'unicorn/no-array-reduce': 'off',
      'unicorn/no-negated-condition': 'off',
      'unicorn/no-static-only-class': 'off',
      'unicorn/no-unnecessary-polyfills': 'off',
      'unicorn/no-useless-undefined': 'off',
      'unicorn/prefer-export-from': 'off',
      'unicorn/prefer-number-properties': [
        'error',
        { checkInfinity: false },
      ],
      'unicorn/prefer-spread': 'off',
      'unicorn/prefer-ternary': 'off',
      'unicorn/prevent-abbreviations': 'off',
      'unicorn/switch-case-braces': 'off',
    },
  },
];

export const tests = [
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/unbound-method': 'off',
    },
  },
  {
    plugins: {
      vitest: pluginVitest,
    },
    rules: {
      ...pluginVitest.configs.recommended.rules,
      'vitest/no-test-return-statement': 'error',
      'vitest/prefer-expect-resolves': 'error',
      'vitest/require-to-throw-message': 'error',
    },
  },
];
