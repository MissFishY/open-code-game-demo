import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

/**
 * Two build modes:
 *
 *   npm run build          -> dist/          (normal static site)
 *   npm run build:single   -> dist-single/   (one self-contained .html file)
 */
export default defineConfig(({ mode }) => {
  const single = mode === 'single';

  return {
    base: './',
    plugins: single ? [viteSingleFile()] : [],
    server: {
      port: 5173,
      host: true,
    },
    preview: {
      port: 4173,
      host: true,
    },
    build: {
      target: 'es2022',
      outDir: single ? 'dist-single' : 'dist',
      // Inline everything so the single build is truly one file.
      assetsInlineLimit: single ? 100_000_000 : 4096,
      cssCodeSplit: !single,
      sourcemap: !single,
      chunkSizeWarningLimit: 1200,
      // A classic script (not a module) so the single file can be opened
      // straight from disk with a double click — file:// blocks module
      // scripts in some browsers.
      rollupOptions: single
        ? { output: { format: 'iife', inlineDynamicImports: true } }
        : {},
    },
  };
});
