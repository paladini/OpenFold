/**
 * E2E Test: Answer Round Flow
 * Complete a full round by answering all problems
 */

import { test, expect, testUtils } from '../fixtures';
import { SELECTORS, TIMEOUTS } from '../config/constants';

test.describe('Answer Round', () => {
  test('can answer a single problem', async ({ page }) => {
    await page.goto('/');
    await testUtils.configureRound(page, 'easy', 1);
    await testUtils.startRound(page);

    // Verify 5 answer buttons
    const buttons = await page.$$(SELECTORS.ANSWER_BUTTONS);
    expect(buttons.length).toBe(5);

    // Click first button (answer)
    await testUtils.answerProblem(page, 0);

    // Verify feedback appears
    expect(await page.isVisible(SELECTORS.FEEDBACK_MESSAGE)).toBeTruthy();
  });

  test('feedback shows correct/incorrect', async ({ page }) => {
    await page.goto('/');
    await testUtils.configureRound(page, 'easy', 1);
    await testUtils.startRound(page);

    await testUtils.answerProblem(page, 0);

    const feedback = await page.textContent(SELECTORS.FEEDBACK_MESSAGE);
    expect(feedback).toMatch(/Correct|Incorrect|Timed out/);
  });

  test('can complete a 3-problem round', async ({ page }) => {
    await page.goto('/');
    await testUtils.configureRound(page, 'easy', 3);
    await testUtils.startRound(page);

    // Answer problem 1
    await testUtils.answerProblem(page, 0);
    await testUtils.nextProblem(page);

    // Verify problem 2 loaded
    let itemText = await page.textContent('p');
    expect(itemText).toContain('Item 2 of 3');

    // Answer problem 2
    await testUtils.answerProblem(page, 1);
    await testUtils.nextProblem(page);

    // Verify problem 3 loaded
    itemText = await page.textContent('p');
    expect(itemText).toContain('Item 3 of 3');

    // Answer problem 3
    await testUtils.answerProblem(page, 2);
    // After last problem, should auto-transition to results
    await page.waitForSelector(SELECTORS.RESULTS_SCREEN, { timeout: TIMEOUTS.LONG });
  });

  test('timer counts down during round', async ({ page }) => {
    await page.goto('/');
    await testUtils.configureRound(page, 'easy', 5);
    await testUtils.startRound(page);

    const timerBefore = await page.textContent(SELECTORS.TIMER);

    // Wait 2 seconds
    await page.waitForTimeout(2000);

    const timerAfter = await page.textContent(SELECTORS.TIMER);

    // Timer should have changed (text content different)
    expect(timerBefore).not.toBe(timerAfter);
  });

  test('keyboard answer entry (1-5 keys)', async ({ page }) => {
    await page.goto('/');
    await testUtils.configureRound(page, 'easy', 2);
    await testUtils.startRound(page);

    // Press key 2 to select answer 2
    await page.keyboard.press('2');

    // Verify feedback appears
    expect(await page.isVisible(SELECTORS.FEEDBACK_MESSAGE)).toBeTruthy();
  });

  test('answer latency is recorded', async ({ page }) => {
    await page.goto('/');
    await testUtils.configureRound(page, 'easy', 1);
    await testUtils.startRound(page);

    const start = Date.now();
    await testUtils.answerProblem(page, 0);
    const latency = Date.now() - start;

    // Should be reasonable (under 5 seconds for this test)
    expect(latency).toBeLessThan(5000);
    expect(latency).toBeGreaterThan(100);
  });

  test('multiple rounds sequentially work correctly', async ({ page }) => {
    // Round 1
    await page.goto('/');
    await testUtils.configureRound(page, 'easy', 2);
    await testUtils.startRound(page);
    await testUtils.completeRound(page, [0, 1]);
    await page.waitForSelector(SELECTORS.RESULTS_SCREEN, { timeout: TIMEOUTS.LONG });

    // Navigate back to config and start Round 2
    await page.goto('/');
    await testUtils.configureRound(page, 'medium', 2);
    await testUtils.startRound(page);
    await testUtils.completeRound(page, [1, 2]);
    await page.waitForSelector(SELECTORS.RESULTS_SCREEN, { timeout: TIMEOUTS.LONG });
  });
});
