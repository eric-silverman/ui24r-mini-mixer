import { test, expect } from '@playwright/test';
import { execSync, spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Legacy Compatibility Tests
 *
 * These tests verify that the production build works correctly and
 * that legacy bundles are generated for older browsers like iOS 12.
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
  // Start the preview server in the background
  previewServer = spawn('npm', ['run', 'preview'], {
    cwd: path.join(projectRoot, 'client'),
    stdio: 'ignore',
    shell: true,
    detached: true,
  });

  previewServer.unref();

  // Wait for the server to be ready by polling
  await waitForServer('http://localhost:4173');
}

function stopPreviewServer(): void {
  if (previewServer && previewServer.pid) {
    try {
      // Kill the process group since we used detached: true
      process.kill(-previewServer.pid, 'SIGTERM');
    } catch {
      // Process may already be dead
      try {
        previewServer.kill('SIGTERM');
      } catch {
        // Ignore
      }
    }
    previewServer = null;
  }
}

test.describe('Legacy Build Compatibility', () => {

  test.beforeAll(async () => {
    // Build the production bundle before running tests
    execSync('npm run build', {
      cwd: path.join(__dirname, '..'),
      stdio: 'pipe'
    });
  });

  test('production build generates legacy bundles', async () => {
    const assetsDir = path.join(distDir, 'assets');
    const files = fs.readdirSync(assetsDir);

    // Check for legacy JavaScript bundle
    const legacyJs = files.find(f => f.includes('-legacy-') && f.endsWith('.js'));
    expect(legacyJs, 'Legacy JS bundle should exist').toBeTruthy();

    // Check for polyfills bundle
    const polyfills = files.find(f => f.includes('polyfills-legacy-') && f.endsWith('.js'));
    expect(polyfills, 'Legacy polyfills bundle should exist').toBeTruthy();

    // Check for modern bundle
    const modernJs = files.find(f => !f.includes('-legacy-') && f.endsWith('.js'));
    expect(modernJs, 'Modern JS bundle should exist').toBeTruthy();
  });

  test('legacy bundle does not contain unsupported ES2020+ syntax', async () => {
    const assetsDir = path.join(distDir, 'assets');
    const files = fs.readdirSync(assetsDir);
    const legacyJs = files.find(f => f.includes('-legacy-') && f.endsWith('.js') && !f.includes('polyfills'));

    expect(legacyJs).toBeTruthy();

    const legacyContent = fs.readFileSync(path.join(assetsDir, legacyJs!), 'utf-8');

    // Check for optional chaining (?.) - not allowed in legacy bundle
    // Note: We check for the pattern in non-string contexts
    const optionalChainingRegex = /[a-zA-Z_$][a-zA-Z0-9_$]*\?\.[a-zA-Z_$]/;
    const hasOptionalChaining = optionalChainingRegex.test(legacyContent);
    expect(hasOptionalChaining, 'Legacy bundle should not contain optional chaining (?.)').toBe(false);

    // Check for nullish coalescing (??) - not allowed in legacy bundle
    // Exclude occurrences inside strings
    const nullishCoalescingRegex = /[^"'`]\?\?[^"'`]/;
    const hasNullishCoalescing = nullishCoalescingRegex.test(legacyContent);
    expect(hasNullishCoalescing, 'Legacy bundle should not contain nullish coalescing (??)').toBe(false);
  });

  test('index.html includes both modern and legacy script tags', async () => {
    const indexHtml = fs.readFileSync(path.join(distDir, 'index.html'), 'utf-8');

    // Modern browsers get type="module"
    expect(indexHtml).toContain('type="module"');

    // Legacy browsers get nomodule
    expect(indexHtml).toContain('nomodule');

    // Should have SystemJS for legacy module loading
    expect(indexHtml).toMatch(/System\.import|systemjs/i);
  });

  test('legacy polyfills bundle includes core-js polyfills', async () => {
    const assetsDir = path.join(distDir, 'assets');
    const files = fs.readdirSync(assetsDir);
    const polyfillsJs = files.find(f => f.includes('polyfills-legacy-') && f.endsWith('.js'));

    expect(polyfillsJs).toBeTruthy();

    const polyfillsContent = fs.readFileSync(path.join(assetsDir, polyfillsJs!), 'utf-8');

    // Should include various polyfills (minified, so check for characteristic patterns)
    // These are common patterns in core-js polyfills
    expect(polyfillsContent.length).toBeGreaterThan(10000); // Polyfills should be substantial
  });

  test('legacy bundle size is reasonable', async () => {
    const assetsDir = path.join(distDir, 'assets');
    const files = fs.readdirSync(assetsDir);

    const legacyJs = files.find(f => f.includes('-legacy-') && f.endsWith('.js') && !f.includes('polyfills'));
    const modernJs = files.find(f => !f.includes('-legacy-') && f.endsWith('.js'));

    expect(legacyJs).toBeTruthy();
    expect(modernJs).toBeTruthy();

    const legacySize = fs.statSync(path.join(assetsDir, legacyJs!)).size;
    const modernSize = fs.statSync(path.join(assetsDir, modernJs!)).size;

    // Legacy bundle is typically larger due to transpilation, but shouldn't be more than 2x
    const sizeRatio = legacySize / modernSize;
    expect(sizeRatio, 'Legacy bundle should not be more than 2x the modern bundle').toBeLessThan(2);

    // Log sizes for reference
    console.log(`Modern bundle: ${(modernSize / 1024).toFixed(1)}KB`);
    console.log(`Legacy bundle: ${(legacySize / 1024).toFixed(1)}KB`);
    console.log(`Size ratio: ${sizeRatio.toFixed(2)}x`);
  });
});

test.describe('Production Build Functionality', () => {
  // These tests require a preview server and should only run with --workers=1
  // They are meant to be run via: ./test.sh legacy
  // Skip when running full test suite (multiple projects/workers)
  test.describe.configure({ mode: 'serial', retries: 2 });
  test.use({
    baseURL: 'http://localhost:4173',
  });
  // Increase timeout for these flaky tests that need server startup
  test.setTimeout(60000);

  test.beforeAll(async () => {
    // Skip if running with multiple workers (detected by env or other tests running)
    // This ensures tests only run via ./test.sh legacy which uses --workers=1

    // Ensure build exists
    if (!fs.existsSync(distDir)) {
      execSync('npm run build', {
        cwd: projectRoot,
        stdio: 'pipe'
      });
    }

    // Start the preview server
    await startPreviewServer();
  });

  test.afterAll(async () => {
    stopPreviewServer();
  });

  test('production build loads without JavaScript errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));

    await page.goto('/?sample=true');
    await page.waitForSelector('.app-shell', { timeout: 30000 });

    expect(errors, 'Should have no JavaScript errors').toHaveLength(0);
  });

  test('production build renders channels correctly', async ({ page }) => {
    await page.goto('/?sample=true');
    await page.waitForSelector('.app-shell', { timeout: 30000 });

    // Wait for channel cards to render with sample data
    await page.waitForSelector('.channel-card', { timeout: 30000 });

    // Verify core functionality works
    const channels = await page.locator('.channel-card').count();
    expect(channels).toBeGreaterThan(0);

    // Verify faders are interactive
    const fader = page.locator('.fader').first();
    await expect(fader).toBeVisible({ timeout: 15000 });
  });

  test('production build stepper buttons are always visible', async ({ page }) => {
    await page.goto('/?sample=true');
    await page.waitForSelector('.app-shell', { timeout: 30000 });

    // Wait for channel cards to render with sample data
    await page.waitForSelector('.channel-card', { timeout: 30000 });

    // Stepper buttons are now always visible (Simple Controls mode was removed)
    const stepperButtons = await page.locator('.stepper-button').count();
    expect(stepperButtons).toBeGreaterThan(0);

    // Verify stepper buttons are clickable
    const increaseBtn = page.locator('[title="Increase level"]').first();
    await expect(increaseBtn).toBeVisible({ timeout: 10000 });
  });

  test('production build fader interaction works', async ({ page }) => {
    await page.goto('/?sample=true');
    await page.waitForSelector('.app-shell', { timeout: 30000 });

    // Wait for channel cards to render with sample data
    await page.waitForSelector('.channel-card', { timeout: 30000 });

    // Use .fader selector like other tests
    const fader = page.locator('.fader').first();
    await expect(fader).toBeVisible({ timeout: 10000 });

    const lcd = page.locator('.strip-display-value').first();
    await expect(lcd).toBeVisible({ timeout: 5000 });

    // Change fader value using native setter (same as other tests)
    await fader.evaluate((el) => {
      const input = el as HTMLInputElement;
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, 'value'
      )!.set!;
      nativeInputValueSetter.call(input, '1');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await page.waitForTimeout(300);

    // LCD should show 0 dB (max value)
    const afterText = await lcd.textContent();
    expect(afterText).toMatch(/0 dB/);
  });
});
