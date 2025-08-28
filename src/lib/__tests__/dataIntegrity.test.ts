/**
 * Comprehensive Data Integrity Test Suite
 * Tests all critical and important fixes
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { playerNameMatcher } from '../playerNameMatcher';
import { unifiedProjectionAggregator } from '../unifiedProjectionAggregator';
import { dataValidationLayer } from '../dataValidationLayer';
import { auditLogger } from '../auditLogger';
import type { PlayerProjection, Position } from '@/types';

describe('Player Name Matcher', () => {
  beforeEach(() => {
    // Reset singleton state if needed
  });
  
  test('should match exact names', () => {
    const result = playerNameMatcher.matchPlayer('Patrick Mahomes');
    expect(result.matched).toBe(true);
    expect(result.confidence).toBe(1.0);
    expect(result.matchType).toBe('exact');
  });
  
  test('should match known aliases', () => {
    const result = playerNameMatcher.matchPlayer('Patrick Mahomes II');
    expect(result.matched).toBe(true);
    expect(result.matchedName).toBe('patrick mahomes');
    expect(result.matchType).toBe('alias');
  });
  
  test('should handle fuzzy matching', () => {
    const result = playerNameMatcher.matchPlayer('Patrik Mahomes'); // Typo
    expect(result.matched).toBe(true);
    expect(result.confidence).toBeGreaterThan(0.85);
    expect(result.matchType).toBe('fuzzy');
  });
  
  test('should normalize names correctly', () => {
    expect(playerNameMatcher.normalize("D.J. Moore")).toBe('dj moore');
    expect(playerNameMatcher.normalize("Amon-Ra St. Brown")).toBe('amonra st brown');
    expect(playerNameMatcher.normalize("  Michael   Pittman Jr.  ")).toBe('michael pittman jr');
  });
  
  test('should handle defense names', () => {
    const result = playerNameMatcher.matchPlayer('San Francisco DST');
    expect(result.matched).toBe(true);
    expect(result.matchedName).toBe('49ers dst');
  });
  
  test('should add and retrieve aliases', () => {
    playerNameMatcher.addAlias('test player', 'test alias');
    const result = playerNameMatcher.matchPlayer('test alias');
    expect(result.matched).toBe(true);
    expect(result.matchedName).toBe('test player');
  });
});

describe('Unified Projection Aggregator', () => {
  const createMockProjection = (
    name: string, 
    points: number, 
    position: Position = 'WR'
  ): PlayerProjection => ({
    id: `${name}_${position}_KC`,
    name,
    team: 'KC',
    position,
    projectedPoints: points
  });
  
  test('should aggregate with correct weights', () => {
    const sources = [
      {
        name: 'fantasypros',
        weight: 0.4,
        projections: [createMockProjection('Test Player', 100)]
      },
      {
        name: 'cbs',
        weight: 0.35,
        projections: [createMockProjection('Test Player', 120)]
      },
      {
        name: 'base',
        weight: 0.25,
        projections: [createMockProjection('Test Player', 80)]
      }
    ];
    
    const result = unifiedProjectionAggregator.aggregateProjections(sources);
    
    expect(result).toHaveLength(1);
    const aggregated = result[0];
    
    // Expected: (100 * 0.4 + 120 * 0.35 + 80 * 0.25) / (0.4 + 0.35 + 0.25) = 102
    expect(aggregated.projectedPoints).toBeCloseTo(102, 1);
  });
  
  test('should handle missing sources gracefully', () => {
    const sources = [
      {
        name: 'fantasypros',
        weight: 0.4,
        projections: [createMockProjection('Test Player', 100)]
      },
      {
        name: 'cbs',
        weight: 0.35,
        projections: [] // Missing CBS data
      },
      {
        name: 'base',
        weight: 0.25,
        projections: [createMockProjection('Test Player', 80)]
      }
    ];
    
    const result = unifiedProjectionAggregator.aggregateProjections(sources, {
      requireMinSources: 2
    });
    
    expect(result).toHaveLength(1);
    const aggregated = result[0];
    
    // Expected: (100 * 0.4 + 80 * 0.25) / (0.4 + 0.25) ≈ 92.3
    expect(aggregated.projectedPoints).toBeCloseTo(92.3, 1);
  });
  
  test('should reject players with insufficient sources', () => {
    const sources = [
      {
        name: 'fantasypros',
        weight: 0.4,
        projections: [createMockProjection('Test Player', 100)]
      },
      {
        name: 'cbs',
        weight: 0.35,
        projections: [] // Missing
      },
      {
        name: 'base',
        weight: 0.25,
        projections: [] // Missing
      }
    ];
    
    const result = unifiedProjectionAggregator.aggregateProjections(sources, {
      requireMinSources: 2
    });
    
    expect(result).toHaveLength(0); // Rejected due to only 1 source
  });
  
  test('should track source availability', () => {
    unifiedProjectionAggregator.clearAuditLog();
    
    const sources = [
      {
        name: 'fantasypros',
        weight: 0.4,
        projections: [
          createMockProjection('Player 1', 100),
          createMockProjection('Player 2', 150)
        ]
      },
      {
        name: 'cbs',
        weight: 0.35,
        projections: [
          createMockProjection('Player 1', 110)
          // Player 2 missing
        ]
      }
    ];
    
    unifiedProjectionAggregator.aggregateProjections(sources, {
      requireMinSources: 1
    });
    
    const report = unifiedProjectionAggregator.getSourceAvailabilityReport();
    expect(report.fantasypros.playersFound).toBe(2);
    expect(report.cbs.playersFound).toBe(1);
  });
  
  test('should calculate confidence correctly', () => {
    const sources = [
      {
        name: 'fantasypros',
        weight: 0.4,
        projections: [createMockProjection('Test Player', 100)]
      },
      {
        name: 'cbs',
        weight: 0.35,
        projections: [createMockProjection('Test Player', 102)]
      },
      {
        name: 'base',
        weight: 0.25,
        projections: [createMockProjection('Test Player', 98)]
      }
    ];
    
    const result = unifiedProjectionAggregator.aggregateProjections(sources);
    const aggregated = result[0];
    
    // High confidence due to consistent values and all sources present
    expect(aggregated.confidence).toBeGreaterThan(0.8);
  });
});

describe('Data Validation Layer', () => {
  test('should validate projection ranges', () => {
    const sources = [{
      name: 'test',
      projections: [
        { id: '1', name: 'QB Test', position: 'QB' as Position, team: 'KC', projectedPoints: 500 }, // Too high
        { id: '2', name: 'RB Test', position: 'RB' as Position, team: 'KC', projectedPoints: -10 }, // Negative
        { id: '3', name: 'WR Test', position: 'WR' as Position, team: 'KC', projectedPoints: 250 } // Normal
      ]
    }];
    
    const report = dataValidationLayer.validateProjectionSources(sources);
    
    expect(report.warnings.length).toBeGreaterThan(0);
    expect(report.warnings.some(w => w.player === 'QB Test')).toBe(true);
    expect(report.warnings.some(w => w.player === 'RB Test')).toBe(true);
  });
  
  test('should validate VORP calculations', () => {
    const players = [
      {
        name: 'QB Test',
        position: 'QB' as Position,
        projectedPoints: 300,
        vorp: 80, // Should be 300 - 220 = 80
        intrinsicValue: 20,
        marketPrice: 15,
        edge: 5
      },
      {
        name: 'RB Test',
        position: 'RB' as Position,
        projectedPoints: 150,
        vorp: 100, // Wrong! Should be 150 - 100 = 50
        intrinsicValue: 25,
        marketPrice: 20,
        edge: 5
      }
    ];
    
    const report = dataValidationLayer.validateComputedValues(players);
    
    expect(report.errors.some(e => e.player === 'RB Test' && e.field === 'vorp')).toBe(true);
    expect(report.passedChecks).toBeGreaterThan(0); // QB Test should pass
  });
  
  test('should detect outliers', () => {
    const players = [
      { name: 'Normal QB 1', position: 'QB' as Position, projectedPoints: 280, vorp: 60, intrinsicValue: 15 },
      { name: 'Normal QB 2', position: 'QB' as Position, projectedPoints: 290, vorp: 70, intrinsicValue: 18 },
      { name: 'Normal QB 3', position: 'QB' as Position, projectedPoints: 275, vorp: 55, intrinsicValue: 14 },
      { name: 'Normal QB 4', position: 'QB' as Position, projectedPoints: 285, vorp: 65, intrinsicValue: 16 },
      { name: 'Normal QB 5', position: 'QB' as Position, projectedPoints: 270, vorp: 50, intrinsicValue: 13 },
      { name: 'Outlier QB', position: 'QB' as Position, projectedPoints: 450, vorp: 230, intrinsicValue: 60 }
    ];
    
    const outliers = dataValidationLayer.detectOutliers(players);
    
    expect(outliers.length).toBeGreaterThan(0);
    expect(outliers.some(o => o.player === 'Outlier QB')).toBe(true);
    expect(outliers[0].zScore).toBeGreaterThan(2); // More than 2 standard deviations
  });
  
  test('should validate position distribution', () => {
    const sources = [{
      name: 'test',
      projections: [
        // Only 2 TEs (should have at least 30)
        { id: '1', name: 'TE1', position: 'TE' as Position, team: 'KC', projectedPoints: 100 },
        { id: '2', name: 'TE2', position: 'TE' as Position, team: 'KC', projectedPoints: 90 }
      ]
    }];
    
    const report = dataValidationLayer.validateProjectionSources(sources);
    
    expect(report.warnings.some(w => w.field === 'position_count' && w.message.includes('TE'))).toBe(true);
  });
});

describe('Audit Logger', () => {
  beforeEach(() => {
    auditLogger.clear();
  });
  
  test('should log aggregation operations', () => {
    auditLogger.logAggregation(
      'Test Player',
      [
        { name: 'fantasypros', found: true, value: 100 },
        { name: 'cbs', found: false }
      ],
      {
        finalValue: 100,
        confidence: 0.7,
        sourcesUsed: ['fantasypros']
      }
    );
    
    const entries = auditLogger.query({ category: 'aggregation' });
    expect(entries).toHaveLength(1);
    expect(entries[0].playerName).toBe('Test Player');
    expect(entries[0].outputs.confidence).toBe(0.7);
  });
  
  test('should log validation operations', () => {
    auditLogger.logValidation('vorp', 'Test Player', false, {
      expected: 50,
      actual: 100,
      issues: ['VORP mismatch']
    });
    
    const entries = auditLogger.query({ category: 'validation' });
    expect(entries).toHaveLength(1);
    expect(entries[0].severity).toBe('warning');
    expect(entries[0].outputs.passed).toBe(false);
  });
  
  test('should log errors with stack traces', () => {
    const error = new Error('Test error');
    auditLogger.logError('test_operation', error, {
      player: 'Test Player',
      value: 100
    });
    
    const entries = auditLogger.query({ severity: 'error' });
    expect(entries).toHaveLength(1);
    expect(entries[0].outputs.error).toBe('Test error');
    expect(entries[0].metadata.stackTrace).toBeDefined();
  });
  
  test('should generate reports', () => {
    // Add various entries
    auditLogger.logAggregation('Player 1', [], { finalValue: 100, confidence: 0.8, sourcesUsed: [] });
    auditLogger.logAggregation('Player 2', [], { finalValue: 150, confidence: 0.9, sourcesUsed: [] });
    auditLogger.logValidation('test', 'target', true, {});
    auditLogger.logError('error_op', 'Error message', {});
    
    const report = auditLogger.generateReport();
    
    expect(report.totalEntries).toBe(4);
    expect(report.byCategory.aggregation).toBe(2);
    expect(report.byCategory.validation).toBe(1);
    expect(report.byCategory.error).toBe(1);
    expect(report.errors).toHaveLength(1);
  });
  
  test('should export to CSV', () => {
    auditLogger.logAggregation('Test Player', [], { finalValue: 100, confidence: 0.8, sourcesUsed: [] });
    
    const csv = auditLogger.exportToCSV();
    const lines = csv.split('\n');
    
    expect(lines[0]).toContain('Timestamp,Operation,Category');
    expect(lines[1]).toContain('projection_aggregation');
    expect(lines[1]).toContain('Test Player');
  });
});

describe('Integration Tests', () => {
  test('should handle full pipeline from aggregation to validation', () => {
    // Clear audit log
    auditLogger.clear();
    
    // Create sources with some missing data
    const sources = [
      {
        name: 'fantasypros',
        weight: 0.4,
        projections: [
          { id: '1', name: 'Travis Kelce', position: 'TE' as Position, team: 'KC', projectedPoints: 180 },
          { id: '2', name: 'Tyreek Hill', position: 'WR' as Position, team: 'MIA', projectedPoints: 320 }
        ]
      },
      {
        name: 'cbs',
        weight: 0.35,
        projections: [
          { id: '1', name: 'Travis Kelce', position: 'TE' as Position, team: 'KC', projectedPoints: 170 }
          // Tyreek Hill missing
        ]
      }
    ];
    
    // Validate sources
    const validationReport = dataValidationLayer.validateProjectionSources(sources);
    expect(validationReport.warnings.length).toBeGreaterThanOrEqual(0);
    
    // Aggregate projections
    const aggregated = unifiedProjectionAggregator.aggregateProjections(sources, {
      requireMinSources: 1
    });
    
    expect(aggregated.length).toBeGreaterThan(0);
    
    // Check audit log
    const auditEntries = auditLogger.query({ category: 'aggregation' });
    expect(auditEntries.length).toBeGreaterThan(0);
    
    // Validate computed values
    const computedValidation = dataValidationLayer.validateComputedValues(
      aggregated.map(p => ({
        name: p.name,
        position: p.position,
        projectedPoints: p.projectedPoints,
        vorp: (p.projectedPoints - (p.position === 'TE' ? 80 : 95)),
        intrinsicValue: 20,
        marketPrice: 15,
        edge: 5
      }))
    );
    
    expect(computedValidation.totalIssues).toBeDefined();
  });
  
  test('should handle TE data properly', () => {
    // This addresses the 90% TE error rate issue
    const teSources = [
      {
        name: 'fantasypros',
        weight: 0.4,
        projections: [
          { id: '1', name: 'Travis Kelce', position: 'TE' as Position, team: 'KC', projectedPoints: 180 },
          { id: '2', name: 'Mark Andrews', position: 'TE' as Position, team: 'BAL', projectedPoints: 160 },
          { id: '3', name: 'T.J. Hockenson', position: 'TE' as Position, team: 'MIN', projectedPoints: 145 }
        ]
      },
      {
        name: 'cbs',
        weight: 0.35,
        projections: [
          { id: '1', name: 'Travis Kelce', position: 'TE' as Position, team: 'KC', projectedPoints: 175 },
          { id: '2', name: 'Mark Andrews', position: 'TE' as Position, team: 'BAL', projectedPoints: 155 }
          // T.J. Hockenson missing - common issue
        ]
      }
    ];
    
    const aggregated = unifiedProjectionAggregator.aggregateProjections(teSources, {
      requireMinSources: 1 // Allow single source for TEs
    });
    
    expect(aggregated.length).toBe(3); // All 3 TEs should be included
    
    // Check Kelce aggregation (has both sources)
    const kelce = aggregated.find(p => p.name === 'Travis Kelce');
    expect(kelce).toBeDefined();
    expect(kelce!.confidence).toBeGreaterThan(0.7); // Higher confidence with 2 sources
    
    // Check Hockenson (only 1 source)
    const hockenson = aggregated.find(p => p.name === 'T.J. Hockenson');
    expect(hockenson).toBeDefined();
    expect(hockenson!.confidence).toBeLessThan(0.7); // Lower confidence with 1 source
  });
});