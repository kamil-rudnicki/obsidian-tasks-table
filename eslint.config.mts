import obsidianmd from 'eslint-plugin-obsidianmd';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import { globalIgnores, defineConfig } from 'eslint/config';

// shadcn and ReUI generate these files; their CLIs replace them, so they keep
// the registry code instead of being rewritten for these rules.
const generatedUi = ['src/ui/components/ui/**', 'src/ui/components/reui/**'];

export default defineConfig(
	globalIgnores([
		'node_modules',
		'dist',
		'esbuild.config.mjs',
		'version-bump.mjs',
		'versions.json',
		'main.js',
		'styles.css',
		'package.json',
		'package-lock.json',
		'tsconfig.json',
	]),
	{
		languageOptions: {
			globals: {
				...globals.browser,
			},
			parserOptions: {
				projectService: {
					allowDefaultProject: ['eslint.config.mts', 'manifest.json'],
				},
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: ['.json'],
			},
		},
	},
	...obsidianmd.configs.recommended,
	{
		files: ['src/**/*.{ts,tsx}'],
		extends: [reactHooks.configs.flat['recommended-latest']],
		rules: {
			// TypeScript already reports undefined names, including React's global types.
			'no-undef': 'off',
		},
	},
	{
		files: generatedUi,
		linterOptions: {
			reportUnusedDisableDirectives: 'off',
		},
		rules: {
			'@typescript-eslint/no-base-to-string': 'off',
			'@typescript-eslint/no-deprecated': 'off',
			'@typescript-eslint/no-unnecessary-type-assertion': 'off',
			'@typescript-eslint/no-unsafe-assignment': 'off',
			'@typescript-eslint/no-unsafe-call': 'off',
			'@typescript-eslint/no-unsafe-member-access': 'off',
			'@typescript-eslint/no-unsafe-return': 'off',
			'eslint-comments/no-restricted-disable': 'off',
			'eslint-comments/require-description': 'off',
			// The grid sets the cursor on the body while a column resizes, and reads
			// refs during render on purpose.
			'obsidianmd/no-global-this': 'off',
			'obsidianmd/no-static-styles-assignment': 'off',
			'obsidianmd/prefer-instanceof': 'off',
			'obsidianmd/prefer-window-timers': 'off',
			'react-hooks/exhaustive-deps': 'off',
			'react-hooks/incompatible-library': 'off',
			'react-hooks/refs': 'off',
			'react-hooks/set-state-in-effect': 'off',
		},
	},
	{
		// Build, test and E2E tooling runs in Node, not in Obsidian.
		files: ['scripts/**/*.mjs', 'e2e/**/*.mjs', 'testing/**/*.ts', 'vitest.config.ts', 'src/**/*.test.ts'],
		languageOptions: {
			globals: {
				...globals.node,
			},
		},
		rules: {
			'import/no-nodejs-modules': 'off',
			'no-unsanitized/method': 'off',
			// The fixture vault is created with Obsidian's default config folder.
			'obsidianmd/hardcoded-config-path': 'off',
			'obsidianmd/no-global-this': 'off',
			'obsidianmd/no-nodejs-modules': 'off',
			'obsidianmd/prefer-window-timers': 'off',
			// Command-line tools report their results on the console.
			'obsidianmd/rule-custom-message': 'off',
		},
	},
);
