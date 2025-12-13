import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
  root: '.',
  base: './',
  publicDir: 'public',
  server: {
    open: 'index.html'
  },
  plugins: [],
  worker: {
    format: 'es'
  }
})
