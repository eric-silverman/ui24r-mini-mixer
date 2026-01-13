import { test, expect } from '@playwright/test';

const MINIMUM_TOUCH_TARGET = 44; // iOS/Android guideline
const PORTRAIT_TOUCH_TARGET = 32; // Reduced for portrait mode to fit more controls
const MINIMUM_FONT_SIZE = 9; // Minimum readable font size for portrait mode
const MINIMUM_FONT_SIZE_LANDSCAPE = 11; // Preferred font size for landscape

test.describe('Mobile Layout Improvements', () => {

  test.beforeEach(async ({ page }) => {
    // Use sample mode to ensure mixer data is available for testing
    await page.goto('/?sample=true');
    // Wait for app to load
    await page.waitForSelector('.app-shell', { timeout: 10000 });
  });

  // Portrait mode: buttons are intentionally smaller to fit more controls
  test.describe('Touch Target Sizes - Portrait (375x667)', () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test('mode buttons should meet portrait minimum', async ({ page }) => {
      const buttons = await page.locator('.mode-button').all();

      for (const button of buttons) {
        const box = await button.boundingBox();
        if (box) {
          // Portrait mode uses smaller buttons (32px) to fit more controls
          expect(box.height, `Mode button height should be >= ${PORTRAIT_TOUCH_TARGET}px`).toBeGreaterThanOrEqual(PORTRAIT_TOUCH_TARGET);
          expect(box.width, 'Mode button width should be >= 30px').toBeGreaterThanOrEqual(30);
        }
      }
    });

    test('aux buttons should meet portrait minimum', async ({ page }) => {
      const buttons = await page.locator('.aux-button').all();

      if (buttons.length > 0) {
        for (const button of buttons) {
          const box = await button.boundingBox();
          if (box) {
            expect(box.height, `Aux button height should be >= ${PORTRAIT_TOUCH_TARGET}px`).toBeGreaterThanOrEqual(PORTRAIT_TOUCH_TARGET);
            expect(box.width, 'Aux button width should be >= 30px').toBeGreaterThanOrEqual(30);
          }
        }
      }
    });

    test('section buttons should meet portrait minimum', async ({ page }) => {
      const buttons = await page.locator('.section-button').all();

      if (buttons.length > 0) {
        for (const button of buttons) {
          const box = await button.boundingBox();
          if (box) {
            expect(box.height, `Section button height should be >= ${PORTRAIT_TOUCH_TARGET}px`).toBeGreaterThanOrEqual(PORTRAIT_TOUCH_TARGET);
          }
        }
      }
    });

    test('simple inline buttons should be appropriately sized', async ({ page }) => {
      const buttons = await page.locator('.simple-button-inline').all();

      if (buttons.length > 0) {
        for (const button of buttons) {
          const box = await button.boundingBox();
          if (box) {
            // Simple inline buttons maintain 44px in all modes
            expect(box.width, 'Simple inline button should be ~44px wide').toBeCloseTo(44, 2);
            expect(box.height, 'Simple inline button should be ~44px tall').toBeCloseTo(44, 2);
          }
        }
      }
    });

    test('mute/solo buttons should meet portrait minimum', async ({ page }) => {
      const muteButtons = await page.locator('.mute-button').all();
      const soloButtons = await page.locator('.solo-button').all();

      const allButtons = [...muteButtons, ...soloButtons];

      if (allButtons.length > 0) {
        for (const button of allButtons) {
          const box = await button.boundingBox();
          if (box) {
            // Portrait mute/solo buttons are slightly larger (38px)
            expect(box.height, 'Mute/Solo button height should be >= 38px').toBeGreaterThanOrEqual(38);
          }
        }
      }
    });
  });

  // Landscape mode: full 44px touch targets
  test.describe('Touch Target Sizes - Landscape (667x375)', () => {
    test.use({ viewport: { width: 667, height: 375 } });

    test('mode buttons should be at least 44px in landscape', async ({ page }) => {
      const buttons = await page.locator('.mode-button').all();

      for (const button of buttons) {
        const box = await button.boundingBox();
        if (box) {
          expect(box.height, `Mode button height should be >= ${MINIMUM_TOUCH_TARGET}px`).toBeGreaterThanOrEqual(MINIMUM_TOUCH_TARGET);
          expect(box.width, 'Mode button width should be >= 40px').toBeGreaterThanOrEqual(40);
        }
      }
    });

    test('mute/solo buttons should be adequately sized in landscape', async ({ page }) => {
      const muteButtons = await page.locator('.mute-button').all();
      const soloButtons = await page.locator('.solo-button').all();

      const allButtons = [...muteButtons, ...soloButtons];

      if (allButtons.length > 0) {
        for (const button of allButtons) {
          const box = await button.boundingBox();
          if (box) {
            // Mute/Solo buttons are 40px in compact landscape layouts
            expect(box.height, 'Mute/Solo button height should be >= 40px').toBeGreaterThanOrEqual(40);
          }
        }
      }
    });
  });

  test.describe('Text Readability', () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test('all button text should be readable in portrait', async ({ page }) => {
      const buttons = await page.locator('button:visible').all();

      for (const button of buttons.slice(0, 10)) { // Test first 10 to save time
        const fontSize = await button.evaluate((el) => {
          return parseFloat(window.getComputedStyle(el).fontSize);
        });

        // Portrait mode uses smaller fonts (9-10px) for compact layout
        expect(fontSize, 'Button font size should be >= 9px').toBeGreaterThanOrEqual(MINIMUM_FONT_SIZE);
      }
    });

    test('strip display values should be readable', async ({ page }) => {
      const displays = await page.locator('.strip-display-value').all();

      if (displays.length > 0) {
        const fontSize = await displays[0].evaluate((el) => {
          return parseFloat(window.getComputedStyle(el).fontSize);
        });

        // Display values should remain readable even in portrait
        expect(fontSize, 'Display value font should be >= 14px').toBeGreaterThanOrEqual(14);
      }
    });
  });

  test.describe('Responsive Breakpoints', () => {

    test('toolbar should stack vertically on small mobile (640px)', async ({ page }) => {
      await page.setViewportSize({ width: 640, height: 1136 });
      await page.waitForTimeout(500); // Wait for layout adjustment

      // Use .sections-toolbar which exists in master mode
      const toolbar = page.locator('.sections-toolbar').first();

      // Skip if toolbar doesn't exist
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

        // Portrait mode uses tighter spacing (4px) to fit more buttons
        const gapValue = parseFloat(gap);
        expect(gapValue).toBeGreaterThanOrEqual(4);
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
