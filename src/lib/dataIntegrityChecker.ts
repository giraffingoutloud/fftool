/**
 * Lightweight data integrity checker for CSV to UI verification
 * Runs on page load to ensure all teams are represented
 */

import { logger } from './utils/logger';
import type { ValuationResult } from './calibratedValuationService';
import type { PlayerProjection } from './types/PlayerTypes';

interface IntegrityCheckResult {
  passed: boolean;
  sourceCount: number;
  renderedCount: number;
  sourceTeams: Set<string>;
  renderedTeams: Set<string>;
  missingTeams: string[];
  discrepancies: string[];
  performanceMs: number;
}

export class DataIntegrityChecker {
  /**
   * Performs a lightweight integrity check between source data and rendered valuations
   * Time complexity: O(n) where n is number of players (~572)
   * Memory: ~10KB for Sets and arrays
   */
  static verifyDataIntegrity(
    sourceProjections: PlayerProjection[],
    renderedValuations: ValuationResult[]
  ): IntegrityCheckResult {
    const startTime = performance.now();
    
    // Extract unique teams from both datasets (O(n) operation)
    const sourceTeams = new Set(
      sourceProjections
        .map(p => p.team)
        .filter(Boolean)
    );
    
    const renderedTeams = new Set(
      renderedValuations
        .map(v => v.team)
        .filter(Boolean)
    );
    
    // Find missing teams (O(32) - constant for NFL teams)
    const missingTeams = Array.from(sourceTeams).filter(
      team => !renderedTeams.has(team)
    );
    
    // Collect discrepancies
    const discrepancies: string[] = [];
    
    if (sourceProjections.length !== renderedValuations.length) {
      discrepancies.push(
        `Player count mismatch: ${sourceProjections.length} source vs ${renderedValuations.length} rendered`
      );
    }
    
    if (missingTeams.length > 0) {
      discrepancies.push(
        `Missing teams in rendered data: ${missingTeams.join(', ')}`
      );
    }
    
    const performanceMs = performance.now() - startTime;
    
    const result: IntegrityCheckResult = {
      passed: discrepancies.length === 0,
      sourceCount: sourceProjections.length,
      renderedCount: renderedValuations.length,
      sourceTeams,
      renderedTeams,
      missingTeams,
      discrepancies,
      performanceMs
    };
    
    // Log results (non-blocking)
    this.logResults(result);
    
    return result;
  }
  
  /**
   * Log verification results for monitoring
   */
  private static logResults(result: IntegrityCheckResult): void {
    const logLevel = result.passed ? 'info' : 'warn';
    
    logger[logLevel]('Data integrity check completed', {
      passed: result.passed,
      sourceCount: result.sourceCount,
      renderedCount: result.renderedCount,
      teamCoverage: `${result.renderedTeams.size}/${result.sourceTeams.size}`,
      performanceMs: result.performanceMs.toFixed(2),
      ...(result.discrepancies.length > 0 && { discrepancies: result.discrepancies })
    });
    
    // In development, show console warning for discrepancies
    if (!result.passed && process.env.NODE_ENV === 'development') {
      console.warn('⚠️ Data Integrity Check Failed:', {
        missingTeams: result.missingTeams,
        discrepancies: result.discrepancies
      });
    }
  }
  
  /**
   * Optional: Create a visual indicator for the UI
   */
  static getIntegrityBadge(result: IntegrityCheckResult): {
    color: string;
    text: string;
    tooltip: string;
  } {
    if (result.passed) {
      return {
        color: 'green',
        text: '✓ Data Verified',
        tooltip: `All ${result.sourceTeams.size} teams present`
      };
    } else {
      return {
        color: 'yellow', 
        text: '⚠ Data Warning',
        tooltip: result.discrepancies.join('; ')
      };
    }
  }
}

// Export for use in components
export const verifyDataIntegrity = DataIntegrityChecker.verifyDataIntegrity;