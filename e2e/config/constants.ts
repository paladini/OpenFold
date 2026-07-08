/**
 * E2E Test Constants
 * Shared selectors, timeouts, test data
 */

export const SELECTORS = {
  // App root
  APP: '[data-testid="app-root"]',

  // Round setup
  CONFIG_FORM: '[data-testid="round-config-form"]',
  DIFFICULTY_SELECT: '[data-testid="difficulty-select"]',
  PROBLEM_COUNT_INPUT: '[data-testid="problem-count-input"]',
  START_BUTTON: '[data-testid="start-button"]',

  // Round play
  CUBE_VIEW: '[data-testid="cube-view"]',
  ANSWER_BUTTONS: '[data-testid="answer-button"]',
  TIMER: '[data-testid="round-timer"]',
  FEEDBACK_MESSAGE: '[data-testid="feedback-message"]',
  NEXT_BUTTON: '[data-testid="next-button"]',

  // Results
  RESULTS_SCREEN: '[data-testid="results-screen"]',
  ACCURACY_SCORE: '[data-testid="accuracy-score"]',
  RESULTS_CHART: '[data-testid="results-chart"]',
  BACK_TO_HOME: '[data-testid="back-to-home"]',

  // Navigation
  HOME_LINK: '[data-testid="home-link"]',
  HISTORY_LINK: '[data-testid="history-link"]',
  SETTINGS_LINK: '[data-testid="settings-link"]',

  // Offline mode
  OFFLINE_TOGGLE: '[data-testid="offline-toggle"]',
} as const;

export const TIMEOUTS = {
  SHORT: 5_000,      // Quick UI updates
  MEDIUM: 15_000,    // Normal operations
  LONG: 30_000,      // Full round completion
  APP_LOAD: 10_000,  // Initial app load
} as const;

export const TEST_DATA = {
  SEEDS: {
    EASY: 12345,
    MEDIUM: 67890,
    HARD: 11111,
    EXPERT: 22222,
  },
  ROUND_CONFIG: {
    EASY: { difficulty: 'easy', count: 3 },
    MEDIUM: { difficulty: 'medium', count: 5 },
    HARD: { difficulty: 'hard', count: 5 },
    EXPERT: { difficulty: 'expert', count: 10 },
  },
} as const;

export const PERFORMANCE = {
  MAX_GENERATION_TIME: 200, // ms
  MAX_RENDER_FRAME: 20,     // ms (60 fps)
  MAX_ANSWER_SUBMIT: 500,   // ms
  MAX_COLD_START: 2000,     // ms
} as const;
