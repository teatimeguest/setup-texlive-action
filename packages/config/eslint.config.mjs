// @ts-check
import { createRequire } from 'node:module';

import js from '@eslint/js';
import importX from 'eslint-plugin-import-x';
import jsdoc from 'eslint-plugin-jsdoc';
import n from 'eslint-plugin-n';
import * as regexp from 'eslint-plugin-regexp';
import tsdoc from 'eslint-plugin-tsdoc';
import unicorn from 'eslint-plugin-unicorn';
import vitest from 'eslint-plugin-vitest';
import ts, { config as defineConfig } from 'typescript-eslint';

const require = createRequire(import.meta.url);
const packageJson = require('../../package.json');

export const common = defineConfig(
  {
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
  },
  {
    extends: [js.configs.recommended],
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
  {
    extends: ts.configs.recommendedTypeChecked,
    languageOptions: {
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
      '@typescript-eslint/no-empty-object-type': 'off',
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
      'import-x': importX,
    },
    settings: {
      'import-x/internal-regex': '^#\\w*/',
      'import-x/parsers': {
        espree: ['.js', '.cjs', '.mjs'],
        '@typescript-eslint/parser': ['.ts'],
      },
    },
    rules: {
      ...importX.configs.recommended.rules,
      ...importX.configs.typescript.rules,
      'import-x/first': 'error',
      'import-x/newline-after-import': 'error',
      'import-x/no-unresolved': 'off',
      'import-x/order': [
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
  {
    extends: [n.configs['flat/recommended-module']],
    settings: {
      node: {
        version: packageJson.engines.node,
      },
    },
    rules: {
      'n/no-missing-import': 'off',
      'n/no-path-concat': 'error',
      'n/no-extraneous-import': [
        'error',
        {
          allowModules: [
            '@setup-texlive-action/config',
            '@setup-texlive-action/fixtures',
            'jest-extended',
            'mock-fs',
            'semver',
            'ts-dedent',
            'ts-essentials',
            'vitest',
          ],
        },
      ],
    },
  },
  regexp.configs['flat/recommended'],
);

export const sources = defineConfig(
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
          filter: '^(?:_$|GITHUB_|RUNNER_|NOPERLDOC$|TEX|TL_)',
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
      '@typescript-eslint/no-unnecessary-boolean-literal-compare': 'error',
      '@typescript-eslint/no-unnecessary-condition': 'error',
      '@typescript-eslint/no-unused-expressions': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { ignoreRestSiblings: true },
      ],
      '@typescript-eslint/non-nullable-type-assertion-style': 'error',
      '@typescript-eslint/only-throw-error': 'error',
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
      '@typescript-eslint/switch-exhaustiveness-check': [
        'error',
        {
          considerDefaultExhaustiveForUnions: true,
        },
      ],
    },
  },
  {
    rules: {
      'import-x/no-commonjs': 'error',
      'import-x/no-duplicates': 'error',
      'import-x/no-import-module-exports': 'error',
      'import-x/no-named-default': 'error',
      'import-x/no-relative-packages': 'error',
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
    plugins: { unicorn },
    rules: {
      ...unicorn.configs.recommended.rules,
      'unicorn/catch-error-name': 'off',
      'unicorn/consistent-function-scoping': 'off',
      'unicorn/custom-error-definition': 'off',
      'unicorn/import-style': 'off',
      'unicorn/no-abusive-eslint-disable': 'off',
      'unicorn/no-array-for-each': 'off',
      'unicorn/no-array-reduce': 'off',
      'unicorn/no-negated-condition': 'off',
      'unicorn/no-nested-ternary': 'off',
      'unicorn/no-static-only-class': 'off',
      'unicorn/no-unnecessary-polyfills': 'off',
      'unicorn/no-useless-spread': 'off',
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
  {
    plugins: { tsdoc },
    rules: {
      'tsdoc/syntax': 'error',
    },
  },
);

export const tests = defineConfig(
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
    plugins: { vitest },
    rules: {
      ...vitest.configs.recommended.rules,
      'vitest/no-test-return-statement': 'error',
      'vitest/prefer-expect-resolves': 'error',
      'vitest/require-to-throw-message': 'error',
    },
  },
);

export const docs = defineConfig(
  {
    extends: [jsdoc.configs['flat/recommended-typescript']],
    settings: {
      jsdoc: {
        tagNamePreference: {
          default: 'defaultValue',
        },
      },
    },
    rules: {
      'jsdoc/check-tag-names': [
        'warn',
        {
          definedTags: [
            'privateRemarks',
            'remarks',
          ],
        },
      ],
      'jsdoc/require-jsdoc': [
        'warn',
        {
          publicOnly: true,
          require: {
            MethodDefinition: true,
          },
          contexts: [
            'TSMethodSignature',
          ],
        },
      ],
      'jsdoc/require-param': 'off',
      'jsdoc/require-returns': 'off',
      'jsdoc/tag-lines': 'off',
    },
  },
);

export default { common, sources, tests, docs };
export { defineConfig };
