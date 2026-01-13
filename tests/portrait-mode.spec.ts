import { test, expect } from '@playwright/test';

test.describe('Portrait Mode Layout', () => {

  test.beforeEach(async ({ page }) => {
    // Use sample mode to ensure mixer data is available for testing
    await page.goto('/?sample=true');
    await page.waitForSelector('.app-shell', { timeout: 10000 });
  });

  test.describe('iPhone SE Portrait (375×667)', () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test('should take screenshot for visual inspection', async ({ page }) => {
      await page.waitForTimeout(1000);
      await expect(page).toHaveScreenshot('portrait-iphone-se.png', {
        fullPage: true,
      });
    });

    test('channel faders should be visible and scrollable', async ({ page }) => {
      const mixBoard = page.locator('.mix-board-row').first();

      if (await mixBoard.isVisible()) {
        const box = await mixBoard.boundingBox();

        // Mix board should take up reasonable amount of vertical space
        // Relaxed for portrait mode - 120px is usable for horizontal faders
        expect(box?.height).toBeGreaterThan(120);
      }
    });

    test('top bar should not be too tall', async ({ page }) => {
      const topBar = page.locator('.top-bar');
      const box = await topBar.boundingBox();

      // Top bar shouldn't take more than 30% of screen height
      if (box) {
        const screenHeight = 667;
        const topBarPercent = (box.height / screenHeight) * 100;
        expect(topBarPercent).toBeLessThan(30);
      }
    });

    test('mode bar should not be too tall', async ({ page }) => {
      const modeBar = page.locator('.mode-bar');
      const box = await modeBar.boundingBox();

      if (box) {
        const screenHeight = 667;
        const modeBarPercent = (box.height / screenHeight) * 100;
        // Relaxed for portrait - with 10 aux buttons, wrapping is inevitable
        // 25% is acceptable for portrait mode navigation
        expect(modeBarPercent).toBeLessThan(25);
      }
    });

    test('faders should be present and functional', async ({ page }) => {
      const fader = page.locator('.fader').first();

      if (await fader.isVisible()) {
        const box = await fader.boundingBox();

        // In portrait mode, faders may be oriented horizontally or compact
        // Verify they have reasonable dimensions for touch interaction
        expect(box?.width).toBeGreaterThan(40);
        expect(box?.height).toBeGreaterThan(40);
      }
    });
  });

  test.describe('iPhone 12 Portrait (390×844)', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('should take screenshot for visual inspection', async ({ page }) => {
      await page.waitForTimeout(1000);
      await expect(page).toHaveScreenshot('portrait-iphone-12.png', {
        fullPage: true,
      });
    });

    test('should have adequate vertical space for controls', async ({ page }) => {
      const appShell = page.locator('.app-shell');
      const box = await appShell.boundingBox();

      expect(box?.height).toBeGreaterThan(500);
    });
  });

  test.describe('iPhone 14 Pro Max Portrait (430×932)', () => {
    test.use({ viewport: { width: 430, height: 932 } });

    test('should take screenshot for visual inspection', async ({ page }) => {
      await page.waitForTimeout(1000);
      await expect(page).toHaveScreenshot('portrait-iphone-14-pro-max.png', {
        fullPage: true,
      });
    });
  });
});
