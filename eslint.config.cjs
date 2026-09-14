const js = require('@eslint/js');

module.exports = [
  {
    ignores: [
      'node_modules',
      'dist',
      'server/uploads',
      '**/*.log',
      '**/*.sqlite3',
      '**/*.db',
    ],
  },
  {
    ...js.configs.recommended,
    files: [
      'server/**/*.js',
      'server/index.js',
      'server/knexfile.js',
      'server/migrations/**/*.js',
      'server/config/**/*.js',
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        module: 'readonly',
        require: 'readonly',
        __dirname: 'readonly',
        process: 'readonly',
        console: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
    },
  },
];
