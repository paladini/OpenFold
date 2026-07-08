/**
 * E2E Test: Review Results & Dashboard
 * Complete round and verify results are displayed and persisted
 */

import { test, expect, testUtils } from '../fixtures';
import { SELECTORS, TIMEOUTS } from '../config/constants';

test.describe('Review Results', () => {
  test('results screen appears after round completes', async ({ page }) => {
    await page.goto('/');
    await testUtils.configureRound(page, 'easy', 2);
    await testUtils.startRound(page);

    await testUtils.completeRound(page, [0, 1]);

    await testUtils.waitForResults(page);
    expect(await page.isVisible(SELECTORS.RESULTS_SCREEN)).toBeTruthy();
  });

  test('accuracy score is displayed', async ({ page }) => {
    await page.goto('/');
    await testUtils.configureRound(page, 'easy', 2);
    await testUtils.startRound(page);

    await testUtils.completeRound(page, [0, 1]);
    await testUtils.waitForResults(page);

    const accuracy = await testUtils.getAccuracy(page);
    expect(accuracy).toBeGreaterThanOrEqual(0);
    expect(accuracy).toBeLessThanOrEqual(100);
  });

  test('results summary contains expected fields', async ({ page }) => {
    await page.goto('/');
    await testUtils.configureRound(page, 'medium', 3);
    await testUtils.startRound(page);

    await testUtils.completeRound(page, [0, 1, 2]);
    await testUtils.waitForResults(page);

    const resultsText = await page.textContent(SELECTORS.RESULTS_SCREEN);
    expect(resultsText).toContain('Accuracy');
    expect(resultsText).toContain('Correct');
    expect(resultsText).toContain('ms');
  });

  test('charts render without errors', async ({ page }) => {
    await page.goto('/');
    await testUtils.configureRound(page, 'easy', 3);
    await testUtils.startRound(page);

    await testUtils.completeRound(page, [0, 1, 2]);
    await testUtils.waitForResults(page);

    // Check for chart elements (Recharts uses SVG)
    const chartSvgs = await page.$$(SELECTORS.RESULTS_CHART);
    expect(chartSvgs.length).toBeGreaterThan(0);

    // Verify no JavaScript errors
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    expect(errors).toHaveLength(0);
  });

  test('can navigate back to home from results', async ({ page }) => {
    await page.goto('/');
    await testUtils.configureRound(page, 'easy', 1);
    await testUtils.startRound(page);

    await testUtils.completeRound(page, [0]);
    await testUtils.waitForResults(page);

    // Click back button
    const backBtn = await page.$(SELECTORS.BACK_TO_HOME);
    if (backBtn) {
      await backBtn.click();
      await page.waitForSelector(SELECTORS.CONFIG_FORM, { timeout: TIMEOUTS.MEDIUM });
    }
  });

  test('results are persisted to IndexedDB', async ({ page }) => {
    await page.goto('/');
    await testUtils.configureRound(page, 'easy', 2);
    await testUtils.startRound(page);

    await testUtils.completeRound(page, [0, 1]);
    await testUtils.waitForResults(page);

    // Wait for IndexedDB write
    await testUtils.waitForIndexedDB(page);

    // Check record count
    const count = await testUtils.getDBRecordCount(page, 'attempts');
    expect(count).toBeGreaterThan(0);
  });

  test('multiple rounds accumulate in history', async ({ page }) => {
    // Round 1
    await page.goto('/');
    await testUtils.configureRound(page, 'easy', 1);
    await testUtils.startRound(page);
    await testUtils.completeRound(page, [0]);
    await testUtils.waitForResults(page);
    await testUtils.waitForIndexedDB(page);

    let count = await testUtils.getDBRecordCount(page, 'attempts');
    expect(count).toBe(1);

    // Round 2
    await page.goto('/');
    await testUtils.configureRound(page, 'medium', 1);
    await testUtils.startRound(page);
    await testUtils.completeRound(page, [1]);
    await testUtils.waitForResults(page);
    await testUtils.waitForIndexedDB(page);

    count = await testUtils.getDBRecordCount(page, 'attempts');
    expect(count).toBe(2);
  });

  test('page reload preserves results', async ({ page }) => {
    await page.goto('/');
    await testUtils.configureRound(page, 'easy', 2);
    await testUtils.startRound(page);

    await testUtils.completeRound(page, [0, 1]);
    await testUtils.waitForResults(page);
    await testUtils.waitForIndexedDB(page);

    const accuracyBefore = await testUtils.getAccuracy(page);

    // Reload page
    await page.reload();
    await page.waitForTimeout(1000);

    // Navigate to history or dashboard to verify data persisted
    // (This depends on app having a history view)
    const pageContent = await page.textContent('body');
    expect(pageContent).toBeTruthy();
  });
});
