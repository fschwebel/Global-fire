import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';

// Incremental build number: the git commit count (needs full history in CI).
function buildNumber(): string {
  try {
    return execSync('git rev-list --count HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return '0';
  }
}

// GitHub Pages serves the site under /<repo>/; local dev and other hosts use /.
export default defineConfig({
  base: process.env.GITHUB_PAGES ? '/Global-fire/' : '/',
  build: { target: 'es2022' },
  define: { __BUILD__: JSON.stringify(buildNumber()) },
});
