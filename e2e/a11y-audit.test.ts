/**
 * E2E Test: Accessibility Audit (WCAG 2.1 AA)
 * axe-core scans at each phase of the app
 */

import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y } from 'axe-playwright';

test.describe('Accessibility - axe-core Audit', () => {
  test('home/config screen passes axe audit', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="round-config-form"]', { timeout: 10000 });

    await injectAxe(page);
    await checkA11y(page, null, {
      detailedReport: true,
      detailedReportOptions: {
        html: true,
      },
    });
  });

  test('during-round screen passes axe audit', async ({ page }) => {
    await page.goto('/');

    // Configure and start round
    const difficultySelect = await page.waitForSelector('[data-testid="difficulty-select"]');
    await difficultySelect?.selectOption('easy');

    const countInput = await page.waitForSelector('[data-testid="problem-count-input"]');
    await countInput?.fill('1');

    const startBtn = await page.waitForSelector('[data-testid="start-button"]');
    await startBtn?.click();

    // Wait for cube view
    await page.waitForSelector('[data-testid="cube-view"]', { timeout: 10000 });

    await injectAxe(page);
    await checkA11y(page, null, {
      detailedReport: true,
      detailedReportOptions: {
        html: true,
      },
    });
  });

  test('feedback screen passes axe audit', async ({ page }) => {
    await page.goto('/');

    // Setup and answer question
    const difficultySelect = await page.waitForSelector('[data-testid="difficulty-select"]');
    await difficultySelect?.selectOption('easy');

    const countInput = await page.waitForSelector('[data-testid="problem-count-input"]');
    await countInput?.fill('1');

    const startBtn = await page.waitForSelector('[data-testid="start-button"]');
    await startBtn?.click();

    // Wait and answer
    await page.waitForSelector('[data-testid="answer-button"]', { timeout: 10000 });
    const buttons = await page.$$('[data-testid="answer-button"]');
    if (buttons.length > 0) {
      await buttons[0].click();
    }

    // Wait for feedback
    await page.waitForSelector('[data-testid="feedback-message"]', { timeout: 5000 });

    await injectAxe(page);
    await checkA11y(page, null, {
      detailedReport: true,
      detailedReportOptions: {
        html: true,
      },
    });
  });

  test('results screen passes axe audit', async ({ page }) => {
    await page.goto('/');

    // Complete a round
    const difficultySelect = await page.waitForSelector('[data-testid="difficulty-select"]');
    await difficultySelect?.selectOption('easy');

    const countInput = await page.waitForSelector('[data-testid="problem-count-input"]');
    await countInput?.fill('1');

    const startBtn = await page.waitForSelector('[data-testid="start-button"]');
    await startBtn?.click();

    // Answer question
    await page.waitForSelector('[data-testid="answer-button"]', { timeout: 10000 });
    const buttons = await page.$$('[data-testid="answer-button"]');
    if (buttons.length > 0) {
      await buttons[0].click();
    }

    // Wait for results
    await page.waitForSelector('[data-testid="results-screen"]', { timeout: 10000 });

    await injectAxe(page);
    await checkA11y(page, null, {
      detailedReport: true,
      detailedReportOptions: {
        html: true,
      },
    });
  });

  test('no critical violations found', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="round-config-form"]', { timeout: 10000 });

    await injectAxe(page);

    // Run full accessibility check
    const results = await page.evaluate(() => {
      return new Promise((resolve) => {
        (window as any).axe.run((error: any, results: any) => {
          if (error) throw error;
          resolve(results);
        });
      });
    });

    const scanResults = results as any;
    const criticalViolations = (scanResults.violations || []).filter(
      (v: any) => v.impact === 'critical' || v.impact === 'serious'
    );

    expect(criticalViolations).toHaveLength(0);
  });
});
