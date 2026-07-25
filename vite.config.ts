import { defineConfig } from 'vite';

// GitHub Pages serves the site under /<repo>/; local dev and other hosts use /.
export default defineConfig({
  base: process.env.GITHUB_PAGES ? '/Global-fire/' : '/',
  build: { target: 'es2022' },
});
