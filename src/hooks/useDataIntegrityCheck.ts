/**
 * React hook for data integrity checking
 * Minimal performance impact - runs once after data loads
 */

import { useEffect, useState } from 'react';
import { DataIntegrityChecker } from '@/lib/dataIntegrityChecker';
import type { ValuationResult } from '@/lib/calibratedValuationService';
import type { PlayerProjection } from '@/lib/types/PlayerTypes';

interface IntegrityStatus {
  checked: boolean;
  passed: boolean;
  message: string;
  details?: {
    sourceTeams: number;
    renderedTeams: number;
    missingTeams: string[];
    performanceMs: number;
  };
}

export function useDataIntegrityCheck(
  projections: PlayerProjection[],
  valuations: ValuationResult[],
  enabled: boolean = true
): IntegrityStatus {
  const [status, setStatus] = useState<IntegrityStatus>({
    checked: false,
    passed: false,
    message: 'Checking data integrity...'
  });

  useEffect(() => {
    if (!enabled || !projections.length || !valuations.length) {
      return;
    }

    // Run check asynchronously to avoid blocking UI
    const timeoutId = setTimeout(() => {
      const result = DataIntegrityChecker.verifyDataIntegrity(
        projections,
        valuations
      );

      setStatus({
        checked: true,
        passed: result.passed,
        message: result.passed 
          ? `✓ All ${result.sourceTeams.size} NFL teams verified`
          : `⚠ Data discrepancy: ${result.discrepancies[0]}`,
        details: {
          sourceTeams: result.sourceTeams.size,
          renderedTeams: result.renderedTeams.size,
          missingTeams: result.missingTeams,
          performanceMs: result.performanceMs
        }
      });
    }, 100); // Small delay to let UI render first

    return () => clearTimeout(timeoutId);
  }, [projections, valuations, enabled]);

  return status;
}