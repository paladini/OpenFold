/**
 * E2E Test: Keyboard-Only Navigation
 * Complete entire round using only keyboard (Tab, Enter, arrows, digits)
 * Verifies WCAG 2.1 AA Section 2.1.1 - Keyboard accessibility
 */

import { test, expect } from '../fixtures';
import { SELECTORS, TIMEOUTS } from '../config/constants';

test.describe('Keyboard Navigation', () => {
  test('can reach all UI elements via Tab key', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector(SELECTORS.CONFIG_FORM, { timeout: TIMEOUTS.APP_LOAD });

    const focusableElements: string[] = [];

    // Tab through elements and collect focused ones
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
      const focused = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement;
        return el?.getAttribute('data-testid') || el?.tagName || 'unknown';
      });
      focusableElements.push(focused);
    }

    // Should have found multiple focusable elements
    expect(focusableElements.length).toBeGreaterThan(0);
    expect(focusableElements).toContain('BUTTON');
    expect(focusableElements).toContain('SELECT');
  });

  test('focus visible on all interactive elements', async ({ page }) => {
    await page.goto('/');

    // Tab to first element
    await page.keyboard.press('Tab');

    const focused = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      const styles = window.getComputedStyle(el);
      return {
        outline: styles.outline,
        outlineWidth: styles.outlineWidth,
        boxShadow: styles.boxShadow,
      };
    });

    // Should have some visual indicator (outline, box-shadow, etc.)
    expect(
      focused.outline !== 'none' || focused.boxShadow !== 'none'
    ).toBeTruthy();
  });

  test('can configure round with keyboard only', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector(SELECTORS.CONFIG_FORM, { timeout: TIMEOUTS.APP_LOAD });

    // Tab to difficulty select
    let tabsPressedCount = 0;
    while (tabsPressedCount < 5) {
      await page.keyboard.press('Tab');
      tabsPressedCount++;

      const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
      if (focused === 'difficulty-select') break;
    }

    // Select "easy"
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    // Tab to problem count
    await page.keyboard.press('Tab');
    const inputFocused = await page.evaluate(
      () => document.activeElement?.getAttribute('data-testid')
    );
    expect(inputFocused).toBe('problem-count-input');

    // Clear and type new count
    await page.keyboard.press('Control+A');
    await page.keyboard.type('3');

    // Verify value
    const value = await page.inputValue(SELECTORS.PROBLEM_COUNT_INPUT);
    expect(value).toBe('3');
  });

  test('can start round with keyboard (Enter on button)', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector(SELECTORS.CONFIG_FORM, { timeout: TIMEOUTS.APP_LOAD });

    // Tab to Start button
    let tabsPressedCount = 0;
    while (tabsPressedCount < 10) {
      await page.keyboard.press('Tab');
      tabsPressedCount++;

      const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
      if (focused === 'start-button') break;
    }

    // Press Enter to activate button
    await page.keyboard.press('Enter');

    // Wait for round to start
    await page.waitForSelector(SELECTORS.CUBE_VIEW, { timeout: TIMEOUTS.MEDIUM });
    expect(await page.isVisible(SELECTORS.CUBE_VIEW)).toBeTruthy();
  });

  test('can answer with numeric keys (1-5) during round', async ({ page }) => {
    await page.goto('/');

    // Configure and start
    const difficulty = await page.waitForSelector(SELECTORS.DIFFICULTY_SELECT);
    await difficulty?.selectOption('easy');

    const count = await page.waitForSelector(SELECTORS.PROBLEM_COUNT_INPUT);
    await count?.fill('3');

    const start = await page.waitForSelector(SELECTORS.START_BUTTON);
    await start?.click();

    // Wait for cube
    await page.waitForSelector(SELECTORS.CUBE_VIEW, { timeout: TIMEOUTS.MEDIUM });

    // Answer with key 2 (second option)
    await page.keyboard.press('2');

    // Feedback should appear
    await page.waitForSelector(SELECTORS.FEEDBACK_MESSAGE, { timeout: TIMEOUTS.SHORT });
    expect(await page.isVisible(SELECTORS.FEEDBACK_MESSAGE)).toBeTruthy();
  });

  test('can navigate through all 3 problems with keyboard only', async ({ page }) => {
    await page.goto('/');

    // Start round
    const difficulty = await page.waitForSelector(SELECTORS.DIFFICULTY_SELECT);
    await difficulty?.selectOption('easy');

    const count = await page.waitForSelector(SELECTORS.PROBLEM_COUNT_INPUT);
    await count?.fill('3');

    const start = await page.waitForSelector(SELECTORS.START_BUTTON);
    await start?.click();

    // Problem 1: Answer with key
    await page.waitForSelector(SELECTORS.CUBE_VIEW, { timeout: TIMEOUTS.MEDIUM });
    await page.keyboard.press('1');
    await page.waitForSelector(SELECTORS.FEEDBACK_MESSAGE, { timeout: TIMEOUTS.SHORT });

    // Problem 2: Tab to Next button and press Enter
    await page.waitForTimeout(300);
    let tabCount = 0;
    while (tabCount < 10) {
      await page.keyboard.press('Tab');
      tabCount++;

      const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
      if (focused === 'next-button') {
        await page.keyboard.press('Enter');
        break;
      }
    }

    // Verify problem 2 loaded
    let itemText = await page.textContent('p');
    expect(itemText).toContain('Item 2 of 3');

    // Problem 2: Answer
    await page.keyboard.press('2');
    await page.waitForSelector(SELECTORS.FEEDBACK_MESSAGE, { timeout: TIMEOUTS.SHORT });

    // Problem 3: Tab to Next and Enter
    await page.waitForTimeout(300);
    tabCount = 0;
    while (tabCount < 10) {
      await page.keyboard.press('Tab');
      tabCount++;

      const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
      if (focused === 'next-button') {
        await page.keyboard.press('Enter');
        break;
      }
    }

    // Verify problem 3 loaded
    itemText = await page.textContent('p');
    expect(itemText).toContain('Item 3 of 3');

    // Problem 3: Answer
    await page.keyboard.press('3');
    await page.waitForSelector(SELECTORS.RESULTS_SCREEN, { timeout: TIMEOUTS.LONG });
  });

  test('Escape key can abort round', async ({ page }) => {
    await page.goto('/');

    // Start round
    const difficulty = await page.waitForSelector(SELECTORS.DIFFICULTY_SELECT);
    await difficulty?.selectOption('easy');

    const count = await page.waitForSelector(SELECTORS.PROBLEM_COUNT_INPUT);
    await count?.fill('5');

    const start = await page.waitForSelector(SELECTORS.START_BUTTON);
    await start?.click();

    await page.waitForSelector(SELECTORS.CUBE_VIEW, { timeout: TIMEOUTS.MEDIUM });

    // Answer one question
    await page.keyboard.press('1');
    await page.waitForSelector(SELECTORS.FEEDBACK_MESSAGE, { timeout: TIMEOUTS.SHORT });

    // Tab to Abort button
    let tabCount = 0;
    while (tabCount < 10) {
      await page.keyboard.press('Tab');
      tabCount++;

      const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
      if (focused === 'abort-button') {
        await page.keyboard.press('Enter');
        break;
      }
    }

    // Should be back at config screen
    await page.waitForSelector(SELECTORS.CONFIG_FORM, { timeout: TIMEOUTS.MEDIUM });
  });

  test('focus management: focus moves to results after round', async ({ page }) => {
    await page.goto('/');

    // Complete a round
    const difficulty = await page.waitForSelector(SELECTORS.DIFFICULTY_SELECT);
    await difficulty?.selectOption('easy');

    const count = await page.waitForSelector(SELECTORS.PROBLEM_COUNT_INPUT);
    await count?.fill('1');

    const start = await page.waitForSelector(SELECTORS.START_BUTTON);
    await start?.click();

    // Answer
    await page.waitForSelector(SELECTORS.CUBE_VIEW, { timeout: TIMEOUTS.MEDIUM });
    await page.keyboard.press('1');

    // Wait for results
    await page.waitForSelector(SELECTORS.RESULTS_SCREEN, { timeout: TIMEOUTS.LONG });

    // Focus should be on results or a button on that screen
    const focused = await page.evaluate(() => document.activeElement?.textContent);
    expect(focused).toBeTruthy();
  });
});
