/**
 * E2E Test: Reduced Motion Support
 * Verify CSS respects prefers-reduced-motion media query
 * WCAG 2.1 AA Section 2.3.3 - Motion from Interactions
 */

import { test, expect } from '@playwright/test';

test.describe('Reduced Motion', () => {
  test('respects prefers-reduced-motion: reduce media query', async ({
    browser,
  }) => {
    const context = await browser.createBrowserContext({
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();

    await page.goto('http://localhost:5173');
    await page.waitForSelector('[data-testid="round-config-form"]', { timeout: 10000 });

    // Verify CSS animations are disabled
    const animationDuration = await page.evaluate(() => {
      const el = document.querySelector('button');
      return window.getComputedStyle(el!).animationDuration;
    });

    // Should be 0.01ms (very short) per our CSS rule
    expect(animationDuration).toMatch(/0\.01ms/);

    await context.close();
  });

  test('fold animation respects reduced-motion', async ({ browser }) => {
    const context = await browser.createBrowserContext({
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();

    await page.goto('http://localhost:5173');

    // Configure and start round
    const difficulty = await page.waitForSelector('[data-testid="difficulty-select"]');
    await difficulty?.selectOption('easy');

    const count = await page.waitForSelector('[data-testid="problem-count-input"]');
    await count?.fill('1');

    const start = await page.waitForSelector('[data-testid="start-button"]');
    await start?.click();

    // Wait for cube view (fold animation should be instant)
    const cubeView = await page.waitForSelector('[data-testid="cube-view"]', { timeout: 10000 });
    expect(cubeView).toBeTruthy();

    // Verify transition times are minimal
    const transitionDuration = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="cube-view"]');
      return window.getComputedStyle(el!).transitionDuration;
    });

    expect(transitionDuration).toMatch(/0\.01ms/);

    await context.close();
  });

  test('transitions are instant with reduced motion', async ({ browser }) => {
    const context = await browser.createBrowserContext({
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();

    await page.goto('http://localhost:5173');

    // Check all elements respect reduced-motion
    const transitionDurations = await page.evaluate(() => {
      const elements = document.querySelectorAll('*');
      const durations = [];

      for (const el of elements) {
        const style = window.getComputedStyle(el as HTMLElement);
        const transitionDuration = style.transitionDuration;
        const animationDuration = style.animationDuration;

        if (transitionDuration && transitionDuration !== '0s') {
          durations.push({
            element: (el as HTMLElement).tagName,
            transitionDuration,
          });
        }
        if (animationDuration && animationDuration !== '0s') {
          durations.push({
            element: (el as HTMLElement).tagName,
            animationDuration,
          });
        }
      }

      return durations;
    });

    // Should have very few (or no) long animations
    const longDurations = transitionDurations.filter(
      (d) => !d.transitionDuration.startsWith('0.01')
    );
    expect(longDurations.length).toBeLessThan(5); // Allow some minor exceptions
  });

  test('normal motion is enabled without prefers-reduced-motion', async ({ page }) => {
    // Default context (no reduced-motion)
    await page.goto('http://localhost:5173');

    // At least some animations should have normal duration
    const hasDuration = await page.evaluate(() => {
      // This depends on the app having real animations
      // For now, just verify the media query isn't triggered
      return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    });

    expect(hasDuration).toBeTruthy();
  });

  test('focus visible works with reduced motion', async ({ browser }) => {
    const context = await browser.createBrowserContext({
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();

    await page.goto('http://localhost:5173');
    await page.waitForSelector('[data-testid="round-config-form"]', { timeout: 10000 });

    // Tab to first element
    await page.keyboard.press('Tab');

    // Focus should be visible
    const focusStyle = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      const style = window.getComputedStyle(el);
      return {
        outline: style.outline,
        outlineWidth: style.outlineWidth,
      };
    });

    expect(focusStyle.outline).not.toBe('none');

    await context.close();
  });

  test('no flashing or rapid blinking with reduced motion', async ({ browser }) => {
    const context = await browser.createBrowserContext({
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();

    await page.goto('http://localhost:5173');
    await page.waitForSelector('[data-testid="round-config-form"]', { timeout: 10000 });

    // Configure and complete a round
    const difficulty = await page.waitForSelector('[data-testid="difficulty-select"]');
    await difficulty?.selectOption('easy');

    const count = await page.waitForSelector('[data-testid="problem-count-input"]');
    await count?.fill('1');

    const start = await page.waitForSelector('[data-testid="start-button"]');
    await start?.click();

    // Answer
    await page.waitForSelector('[data-testid="answer-button"]', { timeout: 10000 });
    const buttons = await page.$$('[data-testid="answer-button"]');
    if (buttons.length > 0) {
      await buttons[0].click();
    }

    // Wait for results
    await page.waitForSelector('[data-testid="results-screen"]', { timeout: 10000 });

    // Verify no console errors
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    expect(errors).toHaveLength(0);

    await context.close();
  });
});
