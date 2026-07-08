/**
 * Performance Profiler Utilities
 * Shared helpers for latency and memory profiling
 */

/**
 * Measure operation duration and record result.
 */
export async function measureOperation<T>(
  name: string,
  fn: () => Promise<T>
): Promise<{ result: T; duration: number }> {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;

  console.log(`[PERF] ${name}: ${duration.toFixed(2)}ms`);

  return { result, duration };
}

/**
 * Calculate percentile from sorted array.
 */
export function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * Record baseline metric to file (Node.js only).
 */
export function recordBaseline(metric: string, value: number): void {
  // Implemented in test context (Node.js/Vitest)
  console.log(`[BASELINE] ${metric}: ${value}`);
}

/**
 * Performance metrics structure.
 */
export interface PerformanceMetrics {
  name: string;
  value: number;
  unit: string;
  budget?: number;
  pass: boolean;
}

/**
 * Validate metric against budget.
 */
export function validateMetric(
  name: string,
  value: number,
  budget: number,
  unit: string = 'ms'
): PerformanceMetrics {
  return {
    name,
    value,
    unit,
    budget,
    pass: value <= budget,
  };
}

/**
 * Generate performance report.
 */
export function generateReport(
  metrics: PerformanceMetrics[]
): {
  passed: number;
  failed: number;
  summary: string;
} {
  const passed = metrics.filter((m) => m.pass).length;
  const failed = metrics.filter((m) => !m.pass).length;

  const summary = metrics
    .map((m) => `${m.name}: ${m.value.toFixed(2)}${m.unit} (budget: ${m.budget}${m.unit})`)
    .join('\n');

  return { passed, failed, summary };
}
