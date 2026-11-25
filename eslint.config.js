import globals from 'globals';

export default [
  {
    files: ['src/**/*.js', 'tests/**/*.js'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: { ...globals.browser, ...globals.worker } },
    rules: { 'no-undef': 'error', 'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }] },
  },
];
