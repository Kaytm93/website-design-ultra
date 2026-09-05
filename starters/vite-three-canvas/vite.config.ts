import { defineConfig } from 'vite'

// The scene is one entry, not a framework. `base: './'` keeps the built page
// mountable from a subdirectory, which is how an embed is usually served.
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    // A budget the build itself enforces. Three is large; the point of the
    // vanilla path is that nothing else is.
    chunkSizeWarningLimit: 800,
  },
})
