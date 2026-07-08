/**
 * Accessibility (WCAG 2.1 AA) Constants & Configuration
 */

/**
 * axe-core rule configuration.
 * Disables known false positives and configures severity levels.
 */
export const AXE_CONFIG = {
  // Rules to skip (document reasoning in comments)
  rules: [
    // 'rule-name': { enabled: false } // Reasoning
  ],
  // Impact level: critical, serious, moderate, minor
  // Default: critical + serious only
};

/**
 * Expected selectors that must be keyboard-accessible.
 */
export const KEYBOARD_TARGETS = {
  PRIMARY: [
    '[data-testid="start-button"]',
    '[data-testid="answer-button"]',
    '[data-testid="next-button"]',
    '[data-testid="back-to-home"]',
  ],
  FORM: [
    '[data-testid="difficulty-select"]',
    '[data-testid="problem-count-input"]',
  ],
  NAV: [
    '[data-testid="home-link"]',
    '[data-testid="history-link"]',
    '[data-testid="settings-link"]',
  ],
};

/**
 * Reduced-motion media query check.
 */
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * WCAG 2.1 AA Audit Checklist
 * Manual verification items (cannot be automated)
 */
export const WCAG_CHECKLIST = {
  '1.4.3': 'Contrast (Minimum): Text has 4.5:1 contrast ratio',
  '2.1.1': 'Keyboard: All functionality available via keyboard',
  '2.4.3': 'Focus Order: Focus order is logical and meaningful',
  '2.4.7': 'Focus Visible: Keyboard focus indicator is visible',
  '3.2.2': 'On Input: No unexpected context changes on form input',
  '4.1.2': 'Name, Role, Value: UI components have accessible names/roles',
  '4.1.3': 'Status Messages: Status messages announced to screen readers',
};

/**
 * Known false positives in axe-core scans.
 * Document with reasoning so team knows they're intentional.
 */
export const KNOWN_FALSE_POSITIVES: Record<string, string> = {
  // 'rule-name': 'Reasoning for disabling'
};
