import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/api/**', 'src/mocks/**'],
    rules: {
      'no-restricted-globals': [
        'error',
        {
          name: 'fetch',
          message:
            "Use generated API hooks from src/api/ instead of raw fetch. Run 'pnpm codegen' to regenerate.",
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'axios',
              message: 'Use generated API hooks from src/api/. No direct HTTP clients.',
            },
            {
              name: 'ky',
              message: 'Use generated API hooks from src/api/. No direct HTTP clients.',
            },
          ],
          patterns: [
            {
              group: ['**/api/model/*', '**/api/endpoints/*'],
              message:
                "Import from '@/api/model' or '@/api/endpoints' barrel exports, not deep paths.",
            },
          ],
        },
      ],
    },
  },
])
