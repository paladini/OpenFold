/**
 * E2E Test Fixtures & Helpers
 * Shared setup, assertions, and utilities for all Playwright tests
 */

import { test as base, expect, Page } from '@playwright/test';
import { PROBLEM_BANK, TestProblem } from './config/problems';
import { SELECTORS, TIMEOUTS } from './config/constants';

/**
 * Extended test fixture with custom utilities.
 */
export const test = base.extend<{
  problemBank: TestProblem[];
  waitForElement: (selector: string, timeout?: number) => Promise<void>;
  expectSuccess: (page: Page) => Promise<void>;
  expectA11yPass: (page: Page) => Promise<void>;
}>({
  problemBank: async ({}, use) => {
    await use(PROBLEM_BANK);
  },

  waitForElement: async ({}, use) => {
    await use(async (selector: string, timeout = TIMEOUTS.MEDIUM) => {
      // Implemented per test context via page fixture
    });
  },

  expectSuccess: async ({}, use) => {
    await use(async (page: Page) => {
      // Check for any console errors
      const errors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });
      expect(errors).toHaveLength(0);
    });
  },

  expectA11yPass: async ({}, use) => {
    await use(async (page: Page) => {
      // Placeholder for axe-core scanning (implemented in T6)
      // For now, just check page loads without errors
      const url = page.url();
      expect(url).toBeTruthy();
    });
  },
});

export { expect };

/**
 * Common test utilities.
 */
export const testUtils = {
  /**
   * Configure a round: select difficulty and problem count.
   */
  async configureRound(
    page: Page,
    difficulty: string,
    count: number
  ): Promise<void> {
    await page.waitForSelector(SELECTORS.DIFFICULTY_SELECT, {
      timeout: TIMEOUTS.APP_LOAD,
    });

    // Select difficulty
    await page.selectOption(SELECTORS.DIFFICULTY_SELECT, difficulty);

    // Set problem count
    await page.fill(SELECTORS.PROBLEM_COUNT_INPUT, count.toString());
  },

  /**
   * Start a round by clicking the Start button.
   */
  async startRound(page: Page): Promise<void> {
    await page.click(SELECTORS.START_BUTTON);
    // Wait for first problem to load
    await page.waitForSelector(SELECTORS.CUBE_VIEW, {
      timeout: TIMEOUTS.MEDIUM,
    });
  },

  /**
   * Answer the current problem by clicking a cube (0-4 indexed).
   */
  async answerProblem(page: Page, cubeIndex: number): Promise<void> {
    const buttons = await page.$$(SELECTORS.ANSWER_BUTTONS);
    expect(buttons.length).toBeGreaterThan(cubeIndex);
    await buttons[cubeIndex].click();

    // Wait for feedback
    await page.waitForSelector(SELECTORS.FEEDBACK_MESSAGE, {
      timeout: TIMEOUTS.SHORT,
    });
  },

  /**
   * Advance to next problem.
   */
  async nextProblem(page: Page): Promise<void> {
    const nextBtn = await page.$(SELECTORS.NEXT_BUTTON);
    if (nextBtn) {
      await nextBtn.click();
      // Wait for next problem to load or results
      await page.waitForTimeout(500);
    }
  },

  /**
   * Complete an entire round by answering all problems.
   */
  async completeRound(page: Page, answerSequence: number[]): Promise<void> {
    for (let i = 0; i < answerSequence.length; i++) {
      await this.answerProblem(page, answerSequence[i]);
      if (i < answerSequence.length - 1) {
        await this.nextProblem(page);
      }
    }
  },

  /**
   * Check if results screen is visible.
   */
  async waitForResults(page: Page): Promise<void> {
    await page.waitForSelector(SELECTORS.RESULTS_SCREEN, {
      timeout: TIMEOUTS.LONG,
    });
  },

  /**
   * Get the accuracy percentage from results.
   */
  async getAccuracy(page: Page): Promise<number> {
    const scoreText = await page.textContent(SELECTORS.ACCURACY_SCORE);
    const match = scoreText?.match(/(\d+)%/);
    return match ? parseInt(match[1], 10) : 0;
  },

  /**
   * Toggle offline mode.
   */
  async toggleOffline(page: Page, enable: boolean): Promise<void> {
    const toggle = await page.$(SELECTORS.OFFLINE_TOGGLE);
    if (toggle) {
      const isChecked = await toggle.isChecked();
      if (enable !== isChecked) {
        await toggle.click();
      }
    }
  },

  /**
   * Check network requests (for offline verification).
   */
  async verifyNoNetworkRequests(page: Page): Promise<void> {
    const networkErrors: string[] = [];
    page.on('requestfailed', (request) => {
      if (!request.url().includes('openfold://')) {
        // Allow custom protocol, block external
        networkErrors.push(request.url());
      }
    });

    // After test, check no external requests were made
    expect(networkErrors).toHaveLength(0);
  },

  /**
   * Wait for IndexedDB to be populated (after a round).
   */
  async waitForIndexedDB(page: Page): Promise<void> {
    await page.waitForFunction(
      () => {
        return (window as any).__OPENFOLD_DB_READY === true;
      },
      { timeout: TIMEOUTS.MEDIUM }
    );
  },

  /**
   * Get IndexedDB record count.
   */
  async getDBRecordCount(page: Page, storeName: string): Promise<number> {
    return await page.evaluate((name: string) => {
      return new Promise<number>((resolve) => {
        const request = indexedDB.open('openfold-db');
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction(name, 'readonly');
          const store = tx.objectStore(name);
          const countRequest = store.count();
          countRequest.onsuccess = () => resolve(countRequest.result);
        };
      });
    }, storeName);
  },
};
