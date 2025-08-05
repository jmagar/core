import { defineConfig } from 'tsup';
import { dependencies } from './package.json';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'], // or esm if you're using that
  bundle: true,
  target: 'node16',
  outDir: 'bin',
  splitting: false,
  shims: true,
  clean: true,
  name: 'github',
  platform: 'node',
  legacyOutput: false,
  noExternal: Object.keys(dependencies || {}), // ⬅️ bundle all deps
  treeshake: {
    preset: 'recommended',
  },
});
