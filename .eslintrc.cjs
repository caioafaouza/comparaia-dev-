// Shared ESLint config for frontend (Vite/React) and backend (Express)
module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
    es2022: true,
  },
  settings: {
    react: { version: 'detect' },
  },
  plugins: ['react', 'react-hooks', '@typescript-eslint', 'import', 'jsx-a11y'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:jsx-a11y/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'prettier',
  ],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  rules: {
    'react/react-in-jsx-scope': 'off',
    'no-console': 'off',
    'import/no-unresolved': 'off', // Vite/tsconfig path aliases handled by bundler
  },
  overrides: [
    {
      files: ['server/**/*.js'],
      env: { node: true, browser: false, es2022: true },
      parserOptions: { sourceType: 'script' },
      rules: {
        'import/no-commonjs': 'off',
        'no-console': 'off',
      },
    },
    {
      files: ['*.ts', '*.tsx'],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
        project: undefined,
      },
    },
  ],
};
