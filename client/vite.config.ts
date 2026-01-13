import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import legacy from '@vitejs/plugin-legacy';

const resolveAppVersion = () => {
  if (process.env.VITE_APP_VERSION) {
    return process.env.VITE_APP_VERSION;
  }

  try {
    return execSync('git describe --tags --exact-match', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return '';
  }
};

const resolveGitSha = () => {
  if (process.env.VITE_GIT_SHA) {
    // Truncate to 7 chars (short SHA) if full SHA is provided
    return process.env.VITE_GIT_SHA.slice(0, 7);
  }

  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return '';
  }
};

const appVersion = resolveAppVersion();
const gitSha = resolveGitSha();

export default defineConfig({
  plugins: [
    react(),
    legacy({
      targets: ['iOS >= 12', 'safari >= 12', 'chrome >= 64', 'firefox >= 60'],
      // Polyfills for modern features used in the app
      additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
    }),
  ],
  // Base path for GitHub Pages deployment (set via VITE_BASE_PATH env var)
  base: process.env.VITE_BASE_PATH || '/',
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __GIT_SHA__: JSON.stringify(gitSha),
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:3001',
        ws: true,
      },
    },
  },
});
