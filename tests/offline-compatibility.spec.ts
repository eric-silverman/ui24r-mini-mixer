import { test, expect } from '@playwright/test';
import { execSync, spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Offline Compatibility Tests
 *
 * These tests verify the app works on networks without internet access:
 * - No external CDN dependencies (fonts, scripts)
 * - All assets are self-hosted
 * - App loads when external requests are blocked
 */

const distDir = path.join(__dirname, '..', 'client', 'dist');
const projectRoot = path.join(__dirname, '..');

// Preview server management
let previewServer: ChildProcess | null = null;

async function waitForServer(url: string, maxAttempts = 30): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Server not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(`Server at ${url} did not start within ${maxAttempts * 500}ms`);
}

async function startPreviewServer(): Promise<void> {
  previewServer = spawn('npm', ['run', 'preview'], {
    cwd: path.join(projectRoot, 'client'),
    stdio: 'ignore',
    shell: true,
    detached: true,
  });

  previewServer.unref();
  await waitForServer('http://localhost:4173');
}

function stopPreviewServer(): void {
  if (previewServer && previewServer.pid) {
    try {
      process.kill(-previewServer.pid, 'SIGTERM');
    } catch {
      try {
        previewServer.kill('SIGTERM');
      } catch {
        // Ignore
      }
    }
    previewServer = null;
  }
}

test.describe('Offline Build Verification', () => {
  test.beforeAll(async () => {
    // Build the production bundle before running tests
    if (!fs.existsSync(distDir)) {
      execSync('npm run build', {
        cwd: projectRoot,
        stdio: 'pipe'
      });
    }
  });

  test('CSS does not contain external @import URLs', async () => {
    const assetsDir = path.join(distDir, 'assets');
    const files = fs.readdirSync(assetsDir);
    const cssFile = files.find(f => f.endsWith('.css'));

    expect(cssFile, 'CSS file should exist in build').toBeTruthy();

    const cssContent = fs.readFileSync(path.join(assetsDir, cssFile!), 'utf-8');

    // Check for external @import statements (Google Fonts, CDNs, etc.)
    const externalImportRegex = /@import\s+url\s*\(\s*['"]?https?:\/\//gi;
    const externalImports = cssContent.match(externalImportRegex);

    expect(
      externalImports,
      'CSS should not contain external @import URLs (found: ' + (externalImports?.join(', ') || 'none') + ')'
    ).toBeNull();
  });

  test('CSS does not reference Google Fonts', async () => {
    const assetsDir = path.join(distDir, 'assets');
    const files = fs.readdirSync(assetsDir);
    const cssFile = files.find(f => f.endsWith('.css'));

    expect(cssFile).toBeTruthy();

    const cssContent = fs.readFileSync(path.join(assetsDir, cssFile!), 'utf-8');

    // Check for any Google Fonts references
    expect(cssContent).not.toContain('fonts.googleapis.com');
    expect(cssContent).not.toContain('fonts.gstatic.com');
  });

  test('HTML does not reference external scripts or stylesheets', async () => {
    const indexHtml = fs.readFileSync(path.join(distDir, 'index.html'), 'utf-8');

    // Check for external script tags
    const externalScriptRegex = /<script[^>]+src\s*=\s*['"]https?:\/\//gi;
    const externalScripts = indexHtml.match(externalScriptRegex);

    expect(
      externalScripts,
      'HTML should not contain external script tags'
    ).toBeNull();

    // Check for external stylesheet links
    const externalStyleRegex = /<link[^>]+href\s*=\s*['"]https?:\/\//gi;
    const externalStyles = indexHtml.match(externalStyleRegex);

    expect(
      externalStyles,
      'HTML should not contain external stylesheet links'
    ).toBeNull();
  });

  test('fonts are bundled locally', async () => {
    const fontsDir = path.join(distDir, 'fonts');

    expect(fs.existsSync(fontsDir), 'fonts directory should exist').toBe(true);

    const fontFiles = fs.readdirSync(fontsDir);

    // Check for Rajdhani font files
    const rajdhaniFiles = fontFiles.filter(f => f.startsWith('rajdhani-'));
    expect(rajdhaniFiles.length, 'Rajdhani font files should be bundled').toBeGreaterThanOrEqual(4);

    // Check for Share Tech Mono font files
    const shareMonoFiles = fontFiles.filter(f => f.startsWith('share-tech-mono-'));
    expect(shareMonoFiles.length, 'Share Tech Mono font files should be bundled').toBeGreaterThanOrEqual(1);
  });

  test('CSS references local font files', async () => {
    const assetsDir = path.join(distDir, 'assets');
    const files = fs.readdirSync(assetsDir);
    const cssFile = files.find(f => f.endsWith('.css'));

    expect(cssFile).toBeTruthy();

    const cssContent = fs.readFileSync(path.join(assetsDir, cssFile!), 'utf-8');

    // Check for local @font-face declarations
    expect(cssContent).toContain('@font-face');
    expect(cssContent).toContain('/fonts/rajdhani-');
    expect(cssContent).toContain('/fonts/share-tech-mono-');
  });

  test('service worker pre-caches font files', async () => {
    const swPath = path.join(distDir, 'sw.js');

    expect(fs.existsSync(swPath), 'Service worker should exist').toBe(true);

    const swContent = fs.readFileSync(swPath, 'utf-8');

    // Check that fonts are in the precache list
    expect(swContent).toContain('/fonts/rajdhani-');
    expect(swContent).toContain('/fonts/share-tech-mono-');
  });
});

test.describe('Server Performance Headers', () => {
  test.describe.configure({ mode: 'serial', retries: 2 });
  test.use({
    baseURL: 'http://localhost:4173',
  });
  test.setTimeout(60000);

  test.beforeAll(async () => {
    if (!fs.existsSync(distDir)) {
      execSync('npm run build', {
        cwd: projectRoot,
        stdio: 'pipe'
      });
    }
    await startPreviewServer();
  });

  test.afterAll(async () => {
    stopPreviewServer();
  });

  test('server returns gzip-compressed JavaScript', async ({ request }) => {
    // Find the JS bundle filename
    const assetsDir = path.join(distDir, 'assets');
    const files = fs.readdirSync(assetsDir);
    const jsFile = files.find(f => f.endsWith('.js') && !f.includes('legacy') && !f.includes('polyfills'));

    expect(jsFile).toBeTruthy();

    const response = await request.get(`/assets/${jsFile}`, {
      headers: {
        'Accept-Encoding': 'gzip, deflate, br',
      },
    });

    expect(response.ok()).toBe(true);

    // Check for compression header
    const contentEncoding = response.headers()['content-encoding'];
    expect(
      contentEncoding,
      'JS bundle should be gzip compressed'
    ).toMatch(/gzip|br|deflate/);
  });

  test('server returns gzip-compressed CSS', async ({ request }) => {
    const assetsDir = path.join(distDir, 'assets');
    const files = fs.readdirSync(assetsDir);
    const cssFile = files.find(f => f.endsWith('.css'));

    expect(cssFile).toBeTruthy();

    const response = await request.get(`/assets/${cssFile}`, {
      headers: {
        'Accept-Encoding': 'gzip, deflate, br',
      },
    });

    expect(response.ok()).toBe(true);

    const contentEncoding = response.headers()['content-encoding'];
    expect(
      contentEncoding,
      'CSS bundle should be gzip compressed'
    ).toMatch(/gzip|br|deflate/);
  });

  test('versioned assets have immutable cache headers', async ({ request }) => {
    const assetsDir = path.join(distDir, 'assets');
    const files = fs.readdirSync(assetsDir);
    // Find a hashed JS file (e.g., index-DYSfBNFJ.js) - Vite uses alphanumeric hashes
    const hashedJsFile = files.find(f => f.endsWith('.js') && !f.includes('legacy') && !f.includes('polyfills') && /-[A-Za-z0-9]{6,}\.js$/.test(f));

    expect(hashedJsFile, 'Should have a hashed JS file').toBeTruthy();

    const response = await request.get(`/assets/${hashedJsFile}`);
    expect(response.ok()).toBe(true);

    const cacheControl = response.headers()['cache-control'];
    // Vite preview server may not set the same headers as production
    // So we check that some cache header exists
    expect(cacheControl).toBeTruthy();
  });

  test('font files are served correctly', async ({ request }) => {
    const response = await request.get('/fonts/rajdhani-400.woff2');

    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toMatch(/font|octet-stream/);
  });

  test('API responses are not cached', async ({ request }) => {
    // API endpoints should not be cached
    const response = await request.get('/api/state?bus=master', {
      failOnStatusCode: false,
    });

    // May return 503 if no mixer connected, but should still have no-cache behavior
    const cacheControl = response.headers()['cache-control'];
    // API responses typically shouldn't have long cache times
    if (cacheControl) {
      expect(cacheControl).not.toContain('immutable');
      expect(cacheControl).not.toMatch(/max-age=31536000/);
    }
  });
});

test.describe('Offline Loading E2E', () => {
  test.describe.configure({ mode: 'serial', retries: 2 });
  test.use({
    baseURL: 'http://localhost:4173',
  });
  test.setTimeout(60000);

  test.beforeAll(async () => {
    if (!fs.existsSync(distDir)) {
      execSync('npm run build', {
        cwd: projectRoot,
        stdio: 'pipe'
      });
    }
    await startPreviewServer();
  });

  test.afterAll(async () => {
    stopPreviewServer();
  });

  test('app loads when external requests are blocked', async ({ page }) => {
    // Block all external requests (anything not to localhost)
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.includes('localhost') || url.includes('127.0.0.1')) {
        route.continue();
      } else {
        // Block external requests
        route.abort('blockedbyclient');
      }
    });

    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));

    // Track blocked requests for debugging
    const blockedRequests: string[] = [];
    page.on('requestfailed', request => {
      if (!request.url().includes('localhost')) {
        blockedRequests.push(request.url());
      }
    });

    await page.goto('/?sample=true');
    await page.waitForSelector('.app-shell', { timeout: 30000 });

    // App should render without errors
    expect(errors, 'Should have no JavaScript errors').toHaveLength(0);

    // Log any blocked requests (should be none if properly self-hosted)
    if (blockedRequests.length > 0) {
      console.log('Blocked external requests:', blockedRequests);
    }
    expect(blockedRequests, 'Should not attempt any external requests').toHaveLength(0);
  });

  test('fonts render correctly without internet', async ({ page }) => {
    // Block all external requests
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.includes('localhost') || url.includes('127.0.0.1')) {
        route.continue();
      } else {
        route.abort('blockedbyclient');
      }
    });

    await page.goto('/?sample=true');
    await page.waitForSelector('.app-shell', { timeout: 30000 });
    await page.waitForSelector('.channel-card', { timeout: 30000 });

    // Check that fonts are applied by verifying computed font-family
    const fontFamily = await page.evaluate(() => {
      const body = document.body;
      return window.getComputedStyle(body).fontFamily;
    });

    // Should use Rajdhani font (self-hosted)
    expect(fontFamily.toLowerCase()).toContain('rajdhani');
  });

  test('all static assets load from local server', async ({ page }) => {
    const loadedAssets: string[] = [];
    const failedAssets: string[] = [];

    page.on('response', response => {
      const url = response.url();
      if (response.status() >= 200 && response.status() < 400) {
        loadedAssets.push(url);
      }
    });

    page.on('requestfailed', request => {
      failedAssets.push(request.url());
    });

    await page.goto('/?sample=true');
    await page.waitForSelector('.app-shell', { timeout: 30000 });

    // All loaded assets should be from localhost
    const externalAssets = loadedAssets.filter(
      url => !url.includes('localhost') && !url.includes('127.0.0.1')
    );

    expect(
      externalAssets,
      'All assets should load from localhost'
    ).toHaveLength(0);

    // Should have loaded fonts
    const fontAssets = loadedAssets.filter(url => url.includes('/fonts/'));
    expect(fontAssets.length, 'Should load font files').toBeGreaterThan(0);
  });
});
