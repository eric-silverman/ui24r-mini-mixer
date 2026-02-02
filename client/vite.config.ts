import { execSync } from 'node:child_process';
import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import legacy from '@vitejs/plugin-legacy';

// Custom plugin to fix Safari 12-13 compatibility
// Safari 12-13 support ES modules but not nullish coalescing (??) or optional chaining (?.)
// This plugin removes the modern bundle script tag entirely for maximum compatibility.
// All browsers will load the legacy bundle instead.
function forceAllLegacy(): Plugin {
  return {
    name: 'force-all-legacy',
    enforce: 'post',
    transformIndexHtml(html) {
      // Remove the modern bundle script tag entirely
      // This forces ALL browsers to use the legacy bundle via the nomodule fallback
      html = html.replace(/<script type="module" crossorigin src="[^"]+"><\/script>\n?/g, '');

      // Remove the modern detection scripts
      html = html.replace(/<script type="module">import\.meta\.url.*?<\/script>\n?/g, '');
      html = html.replace(/<script type="module">!function\(\)\{if\(window\.__vite_is_modern_browser\).*?<\/script>\n?/g, '');

      // Remove nomodule attributes so the legacy scripts run for ALL browsers
      html = html.replace(/ nomodule/g, '');

      return html;
    },
  };
}

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
      // Legacy bundle targets - browsers that need full transpilation
      targets: ['iOS >= 12', 'safari >= 12', 'chrome >= 64', 'firefox >= 60'],
      // Polyfills for modern features used in the app
      additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
    }),
    // Force all browsers to use legacy bundle for Safari 12-13 compatibility
    forceAllLegacy(),
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
