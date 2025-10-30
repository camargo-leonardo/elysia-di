import { build } from 'tsup'

await build({
  entry: ['src/index.ts'],
  outDir: 'dist',
  target: 'node18',
  format: ['cjs', 'esm'],
  clean: true,
  dts: true,
  minify: false,
  shims: true,
  splitting: false,
  skipNodeModulesBundle: true,
})
