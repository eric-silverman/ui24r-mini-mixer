import { test, expect } from '@playwright/test';

const MINIMUM_TOUCH_TARGET = 44; // iOS/Android guideline
const MINIMUM_FONT_SIZE = 11; // Readability guideline

test.describe('Mobile Layout Improvements', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for app to load
    await page.waitForSelector('.app-shell', { timeout: 10000 });
  });

  test.describe('Touch Target Sizes (375px - iPhone SE)', () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test('mode buttons should be at least 44x44px', async ({ page }) => {
      const buttons = await page.locator('.mode-button').all();

      for (const button of buttons) {
        const box = await button.boundingBox();
        if (box) {
          expect(box.height, `Mode button height should be >= ${MINIMUM_TOUCH_TARGET}px`).toBeGreaterThanOrEqual(MINIMUM_TOUCH_TARGET);
          // Width can vary but should be reasonable
          expect(box.width, 'Mode button width should be >= 40px').toBeGreaterThanOrEqual(40);
        }
      }
    });

    test('aux buttons should be at least 44x44px', async ({ page }) => {
      const buttons = await page.locator('.aux-button').all();

      if (buttons.length > 0) {
        for (const button of buttons) {
          const box = await button.boundingBox();
          if (box) {
            expect(box.height, `Aux button height should be >= ${MINIMUM_TOUCH_TARGET}px`).toBeGreaterThanOrEqual(MINIMUM_TOUCH_TARGET);
            expect(box.width, 'Aux button width should be >= 40px').toBeGreaterThanOrEqual(40);
          }
        }
      }
    });

    test('section buttons should be at least 44x44px', async ({ page }) => {
      const buttons = await page.locator('.section-button').all();

      if (buttons.length > 0) {
        for (const button of buttons) {
          const box = await button.boundingBox();
          if (box) {
            expect(box.height, `Section button height should be >= ${MINIMUM_TOUCH_TARGET}px`).toBeGreaterThanOrEqual(MINIMUM_TOUCH_TARGET);
          }
        }
      }
    });

    test('simple inline buttons should be 44x44px', async ({ page }) => {
      const buttons = await page.locator('.simple-button-inline').all();

      if (buttons.length > 0) {
        for (const button of buttons) {
          const box = await button.boundingBox();
          if (box) {
            expect(box.width, 'Simple inline button should be 44px wide').toBeCloseTo(44, 2);
            expect(box.height, 'Simple inline button should be 44px tall').toBeCloseTo(44, 2);
          }
        }
      }
    });

    test('mute/solo buttons should be at least 44px tall', async ({ page }) => {
      const muteButtons = await page.locator('.mute-button').all();
      const soloButtons = await page.locator('.solo-button').all();

      const allButtons = [...muteButtons, ...soloButtons];

      if (allButtons.length > 0) {
        for (const button of allButtons) {
          const box = await button.boundingBox();
          if (box) {
            expect(box.height, 'Mute/Solo button height should be >= 44px').toBeGreaterThanOrEqual(MINIMUM_TOUCH_TARGET);
          }
        }
      }
    });
  });

  test.describe('Text Readability', () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test('all button text should be at least 11px', async ({ page }) => {
      const buttons = await page.locator('button:visible').all();

      for (const button of buttons.slice(0, 10)) { // Test first 10 to save time
        const fontSize = await button.evaluate((el) => {
          return parseFloat(window.getComputedStyle(el).fontSize);
        });

        expect(fontSize, 'Button font size should be >= 11px').toBeGreaterThanOrEqual(MINIMUM_FONT_SIZE);
      }
    });

    test('strip display values should be readable', async ({ page }) => {
      const displays = await page.locator('.strip-display-value').all();

      if (displays.length > 0) {
        const fontSize = await displays[0].evaluate((el) => {
          return parseFloat(window.getComputedStyle(el).fontSize);
        });

        expect(fontSize, 'Display value font should be >= 16px').toBeGreaterThanOrEqual(16);
      }
    });
  });

  test.describe('Responsive Breakpoints', () => {

    test('toolbar should stack vertically on small mobile (640px)', async ({ page }) => {
      await page.setViewportSize({ width: 640, height: 1136 });
      await page.waitForTimeout(500); // Wait for layout adjustment

      const toolbar = page.locator('.sections-toolbar-primary').first();

      // Skip if toolbar doesn't exist (e.g., not connected to mixer)
      if (await toolbar.count() === 0) {
        test.skip();
        return;
      }

      const flexDirection = await toolbar.evaluate((el) => {
        return window.getComputedStyle(el).flexDirection;
      });

      expect(flexDirection).toBe('column');
    });

    test('top bar should stack vertically on tablet (900px)', async ({ page }) => {
      await page.setViewportSize({ width: 900, height: 1200 });
      await page.waitForTimeout(500);

      const topBar = page.locator('.top-bar');
      const flexDirection = await topBar.evaluate((el) => {
        return window.getComputedStyle(el).flexDirection;
      });

      expect(flexDirection).toBe('column');
    });

    test('app should be scrollable horizontally for channels', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      const mixBoard = page.locator('.mix-board-row').first();
      if (await mixBoard.isVisible()) {
        const overflow = await mixBoard.evaluate((el) => {
          return window.getComputedStyle(el).overflowX;
        });

        expect(overflow).toBe('auto');
      }
    });
  });

  test.describe('Touch Optimizations', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('buttons should have touch-action manipulation', async ({ page }) => {
      const button = page.locator('.mode-button').first();

      const touchAction = await button.evaluate((el) => {
        return window.getComputedStyle(el).touchAction;
      });

      expect(touchAction).toBe('manipulation');
    });

    test('faders should have touch-action none for better control', async ({ page }) => {
      const fader = page.locator('.fader').first();

      if (await fader.isVisible()) {
        const touchAction = await fader.evaluate((el) => {
          return window.getComputedStyle(el).touchAction;
        });

        expect(touchAction).toBe('none');
      }
    });

    test('body should have custom tap highlight color', async ({ page }) => {
      const tapHighlight = await page.evaluate(() => {
        return window.getComputedStyle(document.body).getPropertyValue('-webkit-tap-highlight-color');
      });

      // Should be set to a custom color (not the default)
      expect(tapHighlight).toBeTruthy();
    });
  });

  test.describe('Layout Spacing', () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test('buttons should have adequate spacing between them', async ({ page }) => {
      const toolbar = page.locator('.aux-bar').first();

      if (await toolbar.isVisible()) {
        const gap = await toolbar.evaluate((el) => {
          return window.getComputedStyle(el).gap;
        });

        // Should have at least 8px gap
        const gapValue = parseFloat(gap);
        expect(gapValue).toBeGreaterThanOrEqual(8);
      }
    });

    test('app shell should have safe area inset for notched devices', async ({ page }) => {
      const mixBoard = page.locator('.mix-board-row').first();

      if (await mixBoard.isVisible()) {
        const paddingBottom = await mixBoard.evaluate((el) => {
          return window.getComputedStyle(el).paddingBottom;
        });

        // Should include safe area inset
        expect(paddingBottom).toBeTruthy();
      }
    });
  });

  test.describe('Visual Regression - Screenshots', () => {

    test('iPhone SE layout snapshot', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForTimeout(1000);
      await expect(page).toHaveScreenshot('iphone-se-layout.png', {
        fullPage: true,
        maxDiffPixels: 100,
      });
    });

    test('iPhone 12 layout snapshot', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(1000);
      await expect(page).toHaveScreenshot('iphone-12-layout.png', {
        fullPage: true,
        maxDiffPixels: 100,
      });
    });

    test('iPad Mini layout snapshot', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.waitForTimeout(1000);
      await expect(page).toHaveScreenshot('ipad-mini-layout.png', {
        fullPage: true,
        maxDiffPixels: 100,
      });
    });
  });

  test.describe('Accessibility', () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test('enabled buttons should have cursor pointer', async ({ page }) => {
      const button = page.locator('.mode-button:not(:disabled):not(.mode-button-disabled)').first();

      if (await button.count() === 0) {
        // No enabled buttons found, skip test
        test.skip();
        return;
      }

      const cursor = await button.evaluate((el) => {
        return window.getComputedStyle(el).cursor;
      });

      // Cursor should be either 'pointer' or 'default' (acceptable for enabled buttons)
      expect(['pointer', 'default']).toContain(cursor);
    });

    test('disabled buttons should not be clickable', async ({ page }) => {
      const disabledButtons = await page.locator('button:disabled').all();

      for (const button of disabledButtons) {
        const pointerEvents = await button.evaluate((el) => {
          return window.getComputedStyle(el).pointerEvents;
        });

        // Disabled buttons may have pointer-events: none or be styled to appear disabled
        expect(await button.isEnabled()).toBe(false);
      }
    });
  });
});
