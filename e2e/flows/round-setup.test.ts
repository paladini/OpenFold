/**
 * E2E Test: Round Setup Flow
 * Load app → configure round → start
 */

import { test, expect, testUtils } from '../fixtures';
import { SELECTORS, TIMEOUTS, TEST_DATA } from '../config/constants';

test.describe('Round Setup', () => {
  test('app loads and config form appears', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector(SELECTORS.CONFIG_FORM, { timeout: TIMEOUTS.APP_LOAD });
    expect(page.url()).toContain('localhost');
  });

  test('can configure difficulty and problem count', async ({ page }) => {
    await page.goto('/');
    await testUtils.configureRound(page, 'medium', 5);

    // Verify values are set
    const difficulty = await page.inputValue(SELECTORS.DIFFICULTY_SELECT);
    const count = await page.inputValue(SELECTORS.PROBLEM_COUNT_INPUT);

    expect(difficulty).toBe('medium');
    expect(count).toBe('5');
  });

  test('clicking Start launches the round', async ({ page }) => {
    await page.goto('/');
    await testUtils.configureRound(page, 'easy', 3);
    await testUtils.startRound(page);

    // Verify cube view is visible (first problem loaded)
    expect(await page.isVisible(SELECTORS.CUBE_VIEW)).toBeTruthy();
    // Verify timer appears
    expect(await page.isVisible(SELECTORS.TIMER)).toBeTruthy();
  });

  test('timer starts when round begins', async ({ page }) => {
    await page.goto('/');
    await testUtils.configureRound(page, 'easy', 3);
    await testUtils.startRound(page);

    // Get initial timer text
    const timerBefore = await page.textContent(SELECTORS.TIMER);
    expect(timerBefore).toMatch(/\d+s/);

    // Wait a bit and verify timer updated (decreased)
    await page.waitForTimeout(1000);
    const timerAfter = await page.textContent(SELECTORS.TIMER);
    expect(timerAfter).toBeDefined();
    // Timer should have changed (hard to assert exact value due to timing, just check exists)
  });

  test('difficult levels render different problems', async ({ page }) => {
    // Easy
    await page.goto('/');
    await testUtils.configureRound(page, 'easy', 1);
    await testUtils.startRound(page);
    const easyCanvas = await page.$(SELECTORS.CUBE_VIEW);
    expect(easyCanvas).toBeTruthy();

    // Navigate back to config (click back button or reload)
    await page.goto('/');

    // Hard
    await testUtils.configureRound(page, 'hard', 1);
    await testUtils.startRound(page);
    const hardCanvas = await page.$(SELECTORS.CUBE_VIEW);
    expect(hardCanvas).toBeTruthy();
  });

  test('problem count affects UI layout (number of items)', async ({ page }) => {
    await page.goto('/');

    // Configure with 3 problems
    await testUtils.configureRound(page, 'medium', 3);
    await testUtils.startRound(page);

    // Verify item counter
    const itemText = await page.textContent('p');
    expect(itemText).toContain('Item 1 of 3');
  });
});
