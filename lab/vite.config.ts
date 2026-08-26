import { defineConfig } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const labRoot = path.dirname(fileURLToPath(import.meta.url));
const referencesRoot = path.resolve(labRoot, '../references');

/**
 * IP-08A lab harness configuration.
 *
 * The lab is a root-only project per ADR-011 and must never be moved under
 * website-design-ultra/. It imports the copyable determinism runtime from
 * ../references/determinism-runtime.ts (no copied duplicating module) and
 * serves that directory through Vite's fs.allow.
 *
 * Experiments are plain ES modules loaded by src/main.ts per route; there is
 * no application router, no layout framework, and no marketing copy.
 */
export default defineConfig({
  root: labRoot,
  base: './',
  resolve: {
    alias: {
      '@wdu-references': referencesRoot,
    },
  },
  server: {
    port: 5173,
    strictPort: false,
    fs: {
      allow: [labRoot, referencesRoot],
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    // The harness has no route-level chunking: each experiment loads on
    // demand from src/main.ts, so a single shared bundle is the smallest
    // deterministic artifact.
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});