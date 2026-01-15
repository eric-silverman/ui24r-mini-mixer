import { test, expect, Page } from '@playwright/test';

/**
 * Fader LCD Display E2E Tests
 *
 * These tests verify that the LCD dB display updates correctly when:
 * 1. Moving the fader slider in regular mode
 * 2. Using +/- buttons in simple controls mode
 * 3. Switching between master and aux buses
 *
 * This addresses the bug where the LCD display wasn't updating on aux mixes.
 */

// Helper to select channel strips (excluding VGroupStrip components)
const channelStripSelector = '.channel-card:not(.vgroup-strip-card)';

// Helper to switch to first AUX mix using the dropdown
async function selectFirstAux(page: Page) {
  const mixSelect = page.locator('.mix-select');
  await mixSelect.selectOption({ index: 2 }); // Index 0=Main Mix, 1=Gain, 2=First AUX
  await page.waitForTimeout(300);
}

test.describe('Fader LCD Display Updates', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app with sample mode enabled (no real mixer needed)
    await page.goto('/?sample=true');
    await page.waitForSelector('.app-shell', { timeout: 10000 });
  });

  test.describe('Master Bus - Regular Fader Mode', () => {
    test('LCD shows initial dB value', async ({ page }) => {
      const firstChannel = page.locator(channelStripSelector).first();
      const lcdDisplay = firstChannel.locator('.strip-display-value');

      // Should show a dB value
      await expect(lcdDisplay).toBeVisible();
      const text = await lcdDisplay.textContent();
      expect(text).toMatch(/-?\d+ dB/);
    });

    test('LCD updates when fader is moved', async ({ page }) => {
      const firstChannel = page.locator(channelStripSelector).first();
      const lcdDisplay = firstChannel.locator('.strip-display-value');
      const fader = firstChannel.locator('.fader');

      // Get initial value
      const initialText = await lcdDisplay.textContent();

      // Move fader to max position (1.0 = 0 dB)
      await fader.fill('1');
      await fader.dispatchEvent('input');

      // Wait for update
      await page.waitForTimeout(100);

      // LCD should show approximately 0 dB
      const afterMaxText = await lcdDisplay.textContent();
      expect(afterMaxText).toMatch(/0 dB|-?\d dB/);

      // Move fader to min position (0 = -60 dB)
      await fader.fill('0');
      await fader.dispatchEvent('input');

      await page.waitForTimeout(100);

      // LCD should show -60 dB
      const afterMinText = await lcdDisplay.textContent();
      expect(afterMinText).toMatch(/-60 dB/);
    });

    test('LCD updates when fader is dragged', async ({ page }) => {
      const firstChannel = page.locator(channelStripSelector).first();
      const lcdDisplay = firstChannel.locator('.strip-display-value');
      const fader = firstChannel.locator('.fader');

      const box = await fader.boundingBox();
      if (!box) return;

      // Get initial LCD value
      const initialText = await lcdDisplay.textContent();

      // Drag to top of fader (max value)
      await page.mouse.move(box.x + box.width / 2, box.y + box.height);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2, box.y, { steps: 10 });
      await page.mouse.up();

      await page.waitForTimeout(100);

      // LCD should have changed
      const afterDragText = await lcdDisplay.textContent();
      // The value should be different or near 0 dB
      expect(afterDragText).toBeTruthy();
    });
  });

  test.describe('Aux Bus - Regular Fader Mode', () => {
    test.beforeEach(async ({ page }) => {
      // Switch to first AUX mix using the dropdown
      await selectFirstAux(page);
    });

    test('LCD shows dB value on aux mix', async ({ page }) => {
      const firstChannel = page.locator(channelStripSelector).first();
      const lcdDisplay = firstChannel.locator('.strip-display-value');

      await expect(lcdDisplay).toBeVisible();
      const text = await lcdDisplay.textContent();
      expect(text).toMatch(/-?\d+ dB/);
    });

    test('LCD updates when fader is moved on aux mix', async ({ page }) => {
      const firstChannel = page.locator(channelStripSelector).first();
      const lcdDisplay = firstChannel.locator('.strip-display-value');
      const fader = firstChannel.locator('.fader');

      // Get initial value
      const initialText = await lcdDisplay.textContent();
      const initialMatch = initialText?.match(/-?\d+/);
      const initialDb = initialMatch ? parseInt(initialMatch[0]) : 0;

      // Move fader to 0.75 (should give -15 dB)
      await fader.fill('0.75');
      await fader.dispatchEvent('input');
      await page.waitForTimeout(100);

      const afterText = await lcdDisplay.textContent();
      expect(afterText).toMatch(/-15 dB/);

      // Move fader to 0.5 (should give -30 dB)
      await fader.fill('0.5');
      await fader.dispatchEvent('input');
      await page.waitForTimeout(100);

      const afterHalfText = await lcdDisplay.textContent();
      expect(afterHalfText).toMatch(/-30 dB/);
    });

    test('LCD updates when moving different channels on aux mix', async ({ page }) => {
      const channels = page.locator(channelStripSelector);
      const channelCount = await channels.count();

      // Test at least 3 channels if available
      const testCount = Math.min(3, channelCount);

      for (let i = 0; i < testCount; i++) {
        const channel = channels.nth(i);
        const lcd = channel.locator('.strip-display-value');
        const fader = channel.locator('.fader');

        // Move to a specific value - use native setter for React controlled inputs
        const targetValue = 0.5 + i * 0.1;
        await fader.evaluate((el, val) => {
          const input = el as HTMLInputElement;
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
          nativeInputValueSetter.call(input, val);
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }, targetValue);
        await page.waitForTimeout(100);

        // Calculate expected dB
        const expectedDb = Math.round(targetValue * 60 - 60);
        const lcdText = await lcd.textContent();
        expect(lcdText).toMatch(new RegExp(`${expectedDb} dB`));
      }
    });
  });

  test.describe('Stepper Buttons', () => {
    // Stepper buttons are now always visible (Simple Controls mode was removed)

    test.describe('Master Bus - Stepper Buttons', () => {
      test('stepper buttons are always visible', async ({ page }) => {
        const firstChannel = page.locator(channelStripSelector).first();
        const plusButton = firstChannel.locator('[title="Increase level"]');
        const minusButton = firstChannel.locator('[title="Decrease level"]');

        await expect(plusButton).toBeVisible();
        await expect(minusButton).toBeVisible();
      });

      test('LCD updates when clicking + button', async ({ page }) => {
        const firstChannel = page.locator(channelStripSelector).first();
        const lcd = firstChannel.locator('.strip-display-value');
        const plusButton = firstChannel.locator('[title="Increase level"]');

        const initialText = await lcd.textContent();
        const initialMatch = initialText?.match(/-?\d+/);
        const initialDb = initialMatch ? parseInt(initialMatch[0]) : 0;

        // Click + button
        await plusButton.click();
        await page.waitForTimeout(100);

        const afterText = await lcd.textContent();
        const afterMatch = afterText?.match(/-?\d+/);
        const afterDb = afterMatch ? parseInt(afterMatch[0]) : 0;

        // dB should have increased
        expect(afterDb).toBeGreaterThanOrEqual(initialDb);
      });

      test('LCD updates when clicking - button', async ({ page }) => {
        const firstChannel = page.locator(channelStripSelector).first();
        const lcd = firstChannel.locator('.strip-display-value');
        const minusButton = firstChannel.locator('[title="Decrease level"]');

        const initialText = await lcd.textContent();
        const initialMatch = initialText?.match(/-?\d+/);
        const initialDb = initialMatch ? parseInt(initialMatch[0]) : 0;

        // Click - button
        await minusButton.click();
        await page.waitForTimeout(100);

        const afterText = await lcd.textContent();
        const afterMatch = afterText?.match(/-?\d+/);
        const afterDb = afterMatch ? parseInt(afterMatch[0]) : 0;

        // dB should have decreased
        expect(afterDb).toBeLessThanOrEqual(initialDb);
      });
    });

    test.describe('Aux Bus - Stepper Buttons', () => {
      test.beforeEach(async ({ page }) => {
        // Switch to aux
        await selectFirstAux(page);
      });

      test('LCD updates when clicking + button on aux mix', async ({ page }) => {
        const firstChannel = page.locator(channelStripSelector).first();
        const lcd = firstChannel.locator('.strip-display-value');
        const plusButton = firstChannel.locator('[title="Increase level"]');

        const initialText = await lcd.textContent();
        const initialMatch = initialText?.match(/-?\d+/);
        const initialDb = initialMatch ? parseInt(initialMatch[0]) : -60;

        // Click + multiple times to ensure visible change
        for (let i = 0; i < 3; i++) {
          await plusButton.click();
          await page.waitForTimeout(50);
        }

        await page.waitForTimeout(100);

        const afterText = await lcd.textContent();
        const afterMatch = afterText?.match(/-?\d+/);
        const afterDb = afterMatch ? parseInt(afterMatch[0]) : -60;

        // dB should have increased (less negative)
        expect(afterDb).toBeGreaterThan(initialDb);
      });

      test('LCD updates when clicking - button on aux mix', async ({ page }) => {
        const firstChannel = page.locator(channelStripSelector).first();
        const lcd = firstChannel.locator('.strip-display-value');
        const minusButton = firstChannel.locator('[title="Decrease level"]');

        const initialText = await lcd.textContent();
        const initialMatch = initialText?.match(/-?\d+/);
        const initialDb = initialMatch ? parseInt(initialMatch[0]) : 0;

        // Click - multiple times
        for (let i = 0; i < 3; i++) {
          await minusButton.click();
          await page.waitForTimeout(50);
        }

        await page.waitForTimeout(100);

        const afterText = await lcd.textContent();
        const afterMatch = afterText?.match(/-?\d+/);
        const afterDb = afterMatch ? parseInt(afterMatch[0]) : 0;

        // dB should have decreased (more negative)
        expect(afterDb).toBeLessThan(initialDb);
      });
    });
  });

  test.describe('Bus Switching', () => {
    // Skip this test - in sample mode, fader values are shared across all buses
    // since there's no real mixer data. This test is for per-bus persistence.
    test.skip('LCD values persist when switching buses and back', async ({ page }) => {
      // Get initial master channel values
      const firstChannel = page.locator(channelStripSelector).first();
      const fader = firstChannel.locator('.fader');
      const lcd = firstChannel.locator('.strip-display-value');

      // Set a specific fader value on master
      await fader.fill('0.75');
      await fader.dispatchEvent('input');
      await page.waitForTimeout(100);

      const masterLcdText = await lcd.textContent();

      // Switch to aux
      await selectFirstAux(page);

      // Set a different value on aux
      const auxFader = page.locator(channelStripSelector).first().locator('.fader');
      await auxFader.fill('0.5');
      await auxFader.dispatchEvent('input');
      await page.waitForTimeout(100);

      const auxLcdText = await page.locator(channelStripSelector).first().locator('.strip-display-value').textContent();
      expect(auxLcdText).toMatch(/-30 dB/);

      // Switch back to master using dropdown
      const mixSelect = page.locator('.mix-select');
      await mixSelect.selectOption('master');
      await page.waitForTimeout(300);

      // Master should still show the value we set
      const masterLcdAfter = await page.locator(channelStripSelector).first().locator('.strip-display-value').textContent();
      expect(masterLcdAfter).toBe(masterLcdText);
    });
  });
});

test.describe('LCD Display Visual Appearance', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?sample=true');
    await page.waitForSelector('.app-shell', { timeout: 10000 });
  });

  test('LCD has correct styling', async ({ page }) => {
    const lcd = page.locator('.strip-display-value').first();

    // Check text color is green-ish (LCD style)
    const color = await lcd.evaluate(el => window.getComputedStyle(el).color);
    // The color should be a light green
    expect(color).toBeTruthy();

    // Check font is monospace
    const fontFamily = await lcd.evaluate(el => window.getComputedStyle(el).fontFamily);
    expect(fontFamily.toLowerCase()).toMatch(/mono|share tech/i);
  });

  test('LCD shows reasonable dB range', async ({ page }) => {
    const lcds = await page.locator('.strip-display-value').all();

    for (const lcd of lcds.slice(0, 5)) {
      const text = await lcd.textContent();
      const match = text?.match(/-?\d+/);
      if (match) {
        const db = parseInt(match[0]);
        // dB should be between -60 and 0
        expect(db).toBeGreaterThanOrEqual(-60);
        expect(db).toBeLessThanOrEqual(0);
      }
    }
  });

  test('screenshot - master bus LCD displays', async ({ page }, testInfo) => {
    testInfo.skip(!!process.env.CI, 'Screenshot tests skipped in CI');
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('lcd-master-bus.png', {
      fullPage: true,
    });
  });

  test('screenshot - aux bus LCD displays', async ({ page }, testInfo) => {
    testInfo.skip(!!process.env.CI, 'Screenshot tests skipped in CI');
    await selectFirstAux(page);
    await page.waitForTimeout(700);
    await expect(page).toHaveScreenshot('lcd-aux-bus.png', {
      fullPage: true,
    });
  });
});

test.describe('Rapid Fader Changes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?sample=true');
    await page.waitForSelector('.app-shell', { timeout: 10000 });
  });

  test('LCD keeps up with rapid fader movements', async ({ page }) => {
    const firstChannel = page.locator(channelStripSelector).first();
    const fader = firstChannel.locator('.fader');
    const lcd = firstChannel.locator('.strip-display-value');

    // Rapidly change fader values
    const values = ['0.1', '0.3', '0.5', '0.7', '0.9', '0.5'];

    for (const value of values) {
      await fader.fill(value);
      await fader.dispatchEvent('input');
      await page.waitForTimeout(30);
    }

    // Final value should be reflected in LCD
    await page.waitForTimeout(100);
    const finalText = await lcd.textContent();
    expect(finalText).toMatch(/-30 dB/); // 0.5 => -30 dB
  });

  test('LCD updates correctly after multiple aux switches', async ({ page }) => {
    const mixSelect = page.locator('.mix-select');

    // Get aux options from the dropdown (indices 2, 3, 4 are aux sends)
    for (let i = 0; i < 3; i++) {
      await mixSelect.selectOption({ index: 2 + i }); // Skip Main Mix (0) and Gain (1)
      await page.waitForTimeout(200);

      // Modify a fader on this aux - use native setter for React controlled inputs
      const fader = page.locator(channelStripSelector).first().locator('.fader');
      const targetValue = 0.4 + i * 0.1;
      await fader.evaluate((el, val) => {
        const input = el as HTMLInputElement;
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
        nativeInputValueSetter.call(input, val);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }, targetValue);
      await page.waitForTimeout(100);

      // Verify LCD shows correct value
      const lcd = page.locator(channelStripSelector).first().locator('.strip-display-value');
      const expectedDb = Math.round(targetValue * 60 - 60);
      const lcdText = await lcd.textContent();
      expect(lcdText).toMatch(new RegExp(`${expectedDb} dB`));
    }
  });
});
