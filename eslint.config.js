import js from '@eslint/js';
import mochaPlugin from 'eslint-plugin-mocha';

export default [
    js.configs.recommended,
    {
        ignores: ['node_modules/**', 'coverage/**', 'docs/**'],
    },
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 2017,
            sourceType: 'module',
            globals: {
                console: 'readonly',
                process: 'readonly',
                Buffer: 'readonly',
                __dirname: 'readonly',
                __filename: 'readonly',
                module: 'readonly',
                require: 'readonly',
                exports: 'writable',
                global: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly',
                setImmediate: 'readonly',
                clearImmediate: 'readonly',
            },
        },
        plugins: {
            mocha: mochaPlugin,
        },
        rules: {
            'comma-dangle': ['error', 'always-multiline'],
            indent: ['error', 4, { SwitchCase: 1 }],
            'linebreak-style': ['error', 'unix'],
            'mocha/no-exclusive-tests': 'error',
            'mocha/no-identical-title': 'error',
            'mocha/no-nested-tests': 'error',
            'mocha/no-pending-tests': 'warn',
            'mocha/no-sibling-hooks': 'error',
            'no-trailing-spaces': 'error',
            'no-unused-vars': [
                'error',
                {
                    vars: 'all',
                    args: 'all',
                    caughtErrors: 'all',
                    ignoreRestSiblings: false,
                    varsIgnorePattern: '^_',
                    argsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_',
                },
            ],
            quotes: ['error', 'single', { avoidEscape: true }],
            semi: ['error', 'always'],
        },
    },
    {
        files: ['test/**/*.js'],
        languageOptions: {
            globals: {
                expect: 'readonly',
                sinon: 'readonly',
                srcRequire: 'readonly',
                srcRewire: 'readonly',
                describe: 'readonly',
                it: 'readonly',
                before: 'readonly',
                after: 'readonly',
                beforeEach: 'readonly',
                afterEach: 'readonly',
            },
        },
    },
];
