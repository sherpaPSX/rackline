// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * Package boundaries (see docs/architecture.md). Each package may import only
 * the workspace packages listed here. Keep in sync with package.json deps.
 */
const allowed = {
  protocol: [],
  model: ['protocol'],
  api: [],
  server: ['api', 'model', 'protocol'],
  'ui-kit': [],
  ui: ['api', 'ui-kit'],
  desktop: ['server'],
};
const all = Object.keys(allowed);

const boundaries = Object.entries(allowed).map(([pkg, deps]) => ({
  files: [`packages/${pkg}/**/*.{ts,tsx}`],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: all.filter((p) => p !== pkg && !deps.includes(p)).map((p) => `@rackline/${p}`),
            message: `@rackline/${pkg} must not depend on this package (see docs/architecture.md).`,
          },
          {
            group: ['../../*'],
            message: 'Import other packages by name (@rackline/...), not by relative path.',
          },
        ],
      },
    ],
  },
}));

export default tseslint.config(
  { ignores: ['**/dist/**', '**/out/**', '**/node_modules/**', 'tools/**'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  ...boundaries,
);
