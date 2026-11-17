import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';

export default [
  {
    ignores: ['dist/**/*', 'node_modules/**/*', 'frontend/dist/**/*', 'backend/dist/**/*'],
  },
  firebaseRulesPlugin.configs['flat/recommended'],
];
