import { execSync } from 'node:child_process';
import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import legacy from '@vitejs/plugin-legacy';

// Custom plugin to fix Safari 12-13 compatibility
// Safari 12-13 support ES modules but not nullish coalescing (??) or optional chaining (?.)
// The default Vite legacy plugin detection doesn't test for these, so Safari 12-13 try to
// load the modern bundle and fail. This plugin adds the ?? test to the detection script.
function fixSafariModernDetection(): Plugin {
  return {
    name: 'fix-safari-modern-detection',
    enforce: 'post',
    transformIndexHtml(html) {
      // Add nullish coalescing test to Vite's modern browser detection
      // Original: import.meta.url;import("_").catch(()=>1);(async function*(){})().next();
      // We add: null??1; which will cause a syntax error in Safari 12-13
      return html.replace(
        /import\.meta\.url;import\("_"\)\.catch\(\(\)=>1\);\(async function\*\(\)\{\}\)\(\)\.next\(\);/g,
        'import.meta.url;import("_").catch(()=>1);(async function*(){})().next();null??1;'
      );
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
    // Add nullish coalescing test to modern browser detection for Safari 12-13
    fixSafariModernDetection(),
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
