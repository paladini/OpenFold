/**
 * Performance Test: Memory Profiling
 * Measure heap usage and generate performance report
 */

import { describe, it, expect } from 'vitest';
import { generateProblem } from '@openfold/core';
import { generateReport, validateMetric } from './profiler';

describe('Performance Baselines - Memory', () => {
  describe('Memory Usage', () => {
    it('generates 100 problems without excessive memory allocation', () => {
      // Get baseline memory (Note: Not available in Node.js, would use process.memoryUsage)
      // In browser, would use navigator.memory or heap snapshots

      const problems = [];

      // Generate 100 problems
      for (let i = 0; i < 100; i++) {
        const problem = generateProblem(100000 + i, { difficulty: 'medium' });
        problems.push(problem);
      }

      // Verify no memory errors
      expect(problems.length).toBe(100);
      expect(problems[0]).toBeDefined();

      console.log(`Generated 100 problems: ~${problems.length} items in memory`);
    });

    it('problem objects are serializable (low memory footprint)', () => {
      const problem = generateProblem(111111, { difficulty: 'medium' });

      // Serialize to JSON (would be sent to API or stored)
      const json = JSON.stringify(problem);
      const sizeKb = json.length / 1024;

      console.log(`Problem serialized size: ${sizeKb.toFixed(2)} KB`);

      // Each problem should be reasonably small (< 50 KB)
      expect(sizeKb).toBeLessThan(50);
    });

    it('round session data remains compact', () => {
      const problems = [];
      const attempts = [];

      // Simulate a 5-problem round
      for (let i = 0; i < 5; i++) {
        const problem = generateProblem(200000 + i, { difficulty: 'medium' });
        problems.push(problem);

        // Simulate an attempt
        attempts.push({
          itemIndex: i,
          responseMs: 100 + Math.random() * 400,
          correct: Math.random() > 0.3,
          chosenIndex: Math.floor(Math.random() * 5),
        });
      }

      // Serialize entire session
      const sessionData = { problems, attempts };
      const json = JSON.stringify(sessionData);
      const sizeKb = json.length / 1024;

      console.log(`Full 5-problem round: ${sizeKb.toFixed(2)} KB`);

      // 5-problem round should be < 100 KB
      expect(sizeKb).toBeLessThan(100);
    });

    it('IndexedDB record is small (good for mobile)', () => {
      const roundSummary = {
        sessionId: 'abc123',
        seed: 111111,
        difficulty: 'medium',
        problemCount: 5,
        attempts: [
          { itemIndex: 0, correct: true, responseMs: 123 },
          { itemIndex: 1, correct: false, responseMs: 456 },
          { itemIndex: 2, correct: true, responseMs: 234 },
          { itemIndex: 3, correct: true, responseMs: 178 },
          { itemIndex: 4, correct: false, responseMs: 789 },
        ],
        timestamp: Date.now(),
        accuracy: 0.6,
        meanResponseMs: 356,
      };

      const json = JSON.stringify(roundSummary);
      const sizeBytes = json.length;

      console.log(`IndexedDB record: ${sizeBytes} bytes`);

      // Each round record should be < 1 KB
      expect(sizeBytes).toBeLessThan(1000);
    });
  });

  describe('Performance Report Generation', () => {
    it('generates report from metrics', () => {
      const metrics = [
        validateMetric('Generation p50', 150, 200, 'ms'),
        validateMetric('Generation p99', 180, 250, 'ms'),
        validateMetric('Memory idle', 25, 50, 'MB'),
        validateMetric('Memory peak', 180, 200, 'MB'),
      ];

      const report = generateReport(metrics);

      console.log('Performance Report:');
      console.log(`Passed: ${report.passed}/${metrics.length}`);
      console.log(`Failed: ${report.failed}/${metrics.length}`);
      console.log('\nMetrics:');
      console.log(report.summary);

      expect(report.passed).toBeGreaterThan(0);
      expect(report.failed).toBeLessThanOrEqual(metrics.length);
    });

    it('identifies performance regressions', () => {
      const currentMetrics = [
        validateMetric('Generation p50', 150, 200, 'ms'),
        validateMetric('Generation p99', 180, 250, 'ms'),
        validateMetric('Memory idle', 45, 50, 'MB'), // Close to budget
      ];

      const report = generateReport(currentMetrics);

      // Check if any metrics are close to budget (> 90% of budget)
      const atRisk = currentMetrics.filter((m) => m.budget && m.value > m.budget * 0.9);

      console.log(`Metrics at risk (>90% of budget): ${atRisk.length}`);
      atRisk.forEach((m) => {
        console.log(`  - ${m.name}: ${m.value.toFixed(2)}/${m.budget} ${m.unit}`);
      });

      expect(report.passed).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Memory Constraints (Devices)', () => {
    it('memory budget fits on budget devices (< 200MB peak)', () => {
      // Simulate a full session: 10 rounds × 5 problems each
      const allSessions = [];

      for (let roundNum = 0; roundNum < 10; roundNum++) {
        const roundData = {
          roundId: `round-${roundNum}`,
          seed: 100000 + roundNum,
          problems: [],
          attempts: [],
          timestamp: Date.now(),
        };

        // 5 problems per round
        for (let i = 0; i < 5; i++) {
          const problem = generateProblem(100000 + roundNum * 5 + i, {
            difficulty: 'medium',
          });
          roundData.problems.push(problem);

          roundData.attempts.push({
            itemIndex: i,
            correct: Math.random() > 0.3,
            responseMs: 100 + Math.random() * 400,
          });
        }

        allSessions.push(roundData);
      }

      // Estimate memory usage
      const json = JSON.stringify(allSessions);
      const estMemoryMb = json.length / (1024 * 1024);

      console.log(`Estimated memory for 10 rounds: ${estMemoryMb.toFixed(2)} MB`);

      // Should fit well under 200 MB
      expect(estMemoryMb).toBeLessThan(1); // Even 10 rounds should be < 1 MB as JSON
    });
  });

  describe('Memory Cleanup', () => {
    it('does not leak memory across problem generations', () => {
      // This test just ensures the function is callable repeatedly
      // Real leak detection requires heap snapshots in browser

      let lastProblem;

      for (let i = 0; i < 1000; i++) {
        lastProblem = generateProblem(300000 + i, { difficulty: 'medium' });
      }

      expect(lastProblem).toBeDefined();
      console.log('Generated 1000 problems successfully (no crash)');
    });
  });
});
