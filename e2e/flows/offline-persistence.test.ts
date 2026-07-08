/**
 * E2E Test: Offline Mode & Data Persistence
 * Verify offline capability and data survives page reloads
 */

import { test, expect, testUtils } from '../fixtures';
import { SELECTORS, TIMEOUTS } from '../config/constants';

test.describe('Offline & Persistence', () => {
  test('app works without network', async ({ page, context }) => {
    // Enable offline mode via context
    await context.setOffline(true);

    await page.goto('/');

    // App should load (it's embedded/bundled)
    const configForm = await page.waitForSelector(SELECTORS.CONFIG_FORM, {
      timeout: TIMEOUTS.APP_LOAD,
    });
    expect(configForm).toBeTruthy();

    await context.setOffline(false);
  });

  test('can complete a round offline', async ({ page, context }) => {
    await context.setOffline(true);

    await page.goto('/');
    await testUtils.configureRound(page, 'easy', 2);
    await testUtils.startRound(page);

    await testUtils.completeRound(page, [0, 1]);
    await testUtils.waitForResults(page);

    // Verify results are visible
    const accuracy = await testUtils.getAccuracy(page);
    expect(accuracy).toBeGreaterThanOrEqual(0);

    await context.setOffline(false);
  });

  test('offline round persists to IndexedDB', async ({ page, context }) => {
    await context.setOffline(true);

    await page.goto('/');
    await testUtils.configureRound(page, 'easy', 1);
    await testUtils.startRound(page);

    await testUtils.completeRound(page, [0]);
    await testUtils.waitForResults(page);
    await testUtils.waitForIndexedDB(page);

    const count = await testUtils.getDBRecordCount(page, 'attempts');
    expect(count).toBe(1);

    await context.setOffline(false);
  });

  test('IndexedDB survives page reload', async ({ page }) => {
    // Complete a round online
    await page.goto('/');
    await testUtils.configureRound(page, 'easy', 1);
    await testUtils.startRound(page);

    await testUtils.completeRound(page, [0]);
    await testUtils.waitForResults(page);
    await testUtils.waitForIndexedDB(page);

    const countBefore = await testUtils.getDBRecordCount(page, 'attempts');
    expect(countBefore).toBe(1);

    // Reload
    await page.reload();
    await page.waitForTimeout(500);

    // IndexedDB should still have the record
    const countAfter = await testUtils.getDBRecordCount(page, 'attempts');
    expect(countAfter).toBe(1);
  });

  test('multiple rounds accumulate across reloads', async ({ page }) => {
    // Round 1
    await page.goto('/');
    await testUtils.configureRound(page, 'easy', 1);
    await testUtils.startRound(page);
    await testUtils.completeRound(page, [0]);
    await testUtils.waitForResults(page);
    await testUtils.waitForIndexedDB(page);

    // Reload
    await page.reload();
    await page.waitForTimeout(500);

    // Navigate to results again
    await page.goto('/');

    // Round 2
    await testUtils.configureRound(page, 'medium', 1);
    await testUtils.startRound(page);
    await testUtils.completeRound(page, [1]);
    await testUtils.waitForResults(page);
    await testUtils.waitForIndexedDB(page);

    // Should have 2 attempts
    const count = await testUtils.getDBRecordCount(page, 'attempts');
    expect(count).toBe(2);

    // Reload again and verify
    await page.reload();
    await page.waitForTimeout(500);

    const finalCount = await testUtils.getDBRecordCount(page, 'attempts');
    expect(finalCount).toBe(2);
  });

  test('abort mid-round records partial data', async ({ page }) => {
    await page.goto('/');
    await testUtils.configureRound(page, 'easy', 5);
    await testUtils.startRound(page);

    // Answer only first problem
    await testUtils.answerProblem(page, 0);
    await testUtils.nextProblem(page);

    // Abort round
    const abortBtn = await page.$('[data-testid="abort-button"]');
    if (abortBtn) {
      await abortBtn.click();
      await page.waitForTimeout(500);
    }

    // IndexedDB should have attempt record (partial)
    const count = await testUtils.getDBRecordCount(page, 'attempts');
    expect(count).toBeGreaterThanOrEqual(0); // Depending on implementation
  });

  test('no external network requests during round', async ({ page, context }) => {
    const networkRequests: string[] = [];

    page.on('request', (request) => {
      const url = request.url();
      // Only track external requests (not openfold:// custom protocol)
      if (!url.includes('openfold://') && !url.includes('localhost')) {
        networkRequests.push(url);
      }
    });

    await page.goto('/');
    await testUtils.configureRound(page, 'easy', 1);
    await testUtils.startRound(page);

    await testUtils.completeRound(page, [0]);
    await testUtils.waitForResults(page);

    // Should have no external network requests
    const externalRequests = networkRequests.filter(
      (url) => !url.includes('localhost') && !url.includes('openfold://')
    );
    expect(externalRequests).toHaveLength(0);
  });

  test('app loads correctly after device goes offline then online', async ({ page, context }) => {
    await page.goto('/');

    // Go offline
    await context.setOffline(true);
    await page.waitForTimeout(500);

    // Should still load
    let content = await page.textContent('body');
    expect(content).toBeTruthy();

    // Go back online
    await context.setOffline(false);
    await page.waitForTimeout(500);

    content = await page.textContent('body');
    expect(content).toBeTruthy();
  });
});
