/**
 * Comprehensive Audit Logging System
 * Tracks all data operations, computations, and decisions
 */

import { logger } from './utils/logger';

export interface AuditEntry {
  id: string;
  timestamp: Date;
  operation: string;
  category: 'aggregation' | 'validation' | 'computation' | 'matching' | 'error';
  severity: 'debug' | 'info' | 'warning' | 'error' | 'critical';
  userId?: string;
  playerId?: string;
  playerName?: string;
  inputs: Record<string, any>;
  outputs: Record<string, any>;
  metadata: {
    source?: string;
    confidence?: number;
    duration?: number;
    stackTrace?: string;
  };
  tags: string[];
}

interface AuditReport {
  startDate: Date;
  endDate: Date;
  totalEntries: number;
  byCategory: Record<string, number>;
  bySeverity: Record<string, number>;
  topOperations: Array<{ operation: string; count: number }>;
  errors: AuditEntry[];
  warnings: AuditEntry[];
  performanceStats: {
    avgDuration: number;
    maxDuration: number;
    slowOperations: Array<{ operation: string; duration: number }>;
  };
}

export class AuditLogger {
  private static instance: AuditLogger;
  private entries: AuditEntry[] = [];
  private readonly MAX_ENTRIES = 10000;
  private readonly PERSIST_INTERVAL = 60000; // 1 minute
  private persistTimer: NodeJS.Timeout | null = null;
  
  private constructor() {
    this.startAutoPersist();
  }
  
  public static getInstance(): AuditLogger {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger();
    }
    return AuditLogger.instance;
  }
  
  /**
   * Log an aggregation operation
   */
  public logAggregation(
    playerName: string,
    sources: Array<{ name: string; found: boolean; value?: number }>,
    result: { finalValue: number; confidence: number; sourcesUsed: string[] }
  ): void {
    this.addEntry({
      operation: 'projection_aggregation',
      category: 'aggregation',
      severity: result.confidence < 0.6 ? 'warning' : 'info',
      playerName,
      inputs: {
        sources: sources.map(s => ({
          name: s.name,
          found: s.found,
          value: s.value
        }))
      },
      outputs: {
        finalValue: result.finalValue,
        confidence: result.confidence,
        sourcesUsed: result.sourcesUsed
      },
      metadata: {
        confidence: result.confidence
      },
      tags: ['projection', 'aggregation', ...result.sourcesUsed]
    });
  }
  
  /**
   * Log a validation operation
   */
  public logValidation(
    operation: string,
    target: string,
    passed: boolean,
    details: Record<string, any>
  ): void {
    this.addEntry({
      operation: `validate_${operation}`,
      category: 'validation',
      severity: passed ? 'info' : 'warning',
      inputs: {
        target,
        ...details
      },
      outputs: {
        passed,
        issues: details.issues || []
      },
      metadata: {},
      tags: ['validation', operation]
    });
  }
  
  /**
   * Log a computation
   */
  public logComputation(
    operation: string,
    playerId: string,
    playerName: string,
    inputs: Record<string, any>,
    outputs: Record<string, any>,
    duration?: number
  ): void {
    this.addEntry({
      operation,
      category: 'computation',
      severity: 'info',
      playerId,
      playerName,
      inputs,
      outputs,
      metadata: {
        duration
      },
      tags: ['computation', operation.split('_')[0]]
    });
  }
  
  /**
   * Log a name matching operation
   */
  public logNameMatch(
    inputName: string,
    matchedName: string,
    confidence: number,
    matchType: string
  ): void {
    const severity = confidence < 0.8 ? 'warning' : 'info';
    
    this.addEntry({
      operation: 'name_matching',
      category: 'matching',
      severity,
      inputs: {
        inputName,
        matchType
      },
      outputs: {
        matchedName,
        confidence,
        matchType
      },
      metadata: {
        confidence
      },
      tags: ['matching', matchType]
    });
  }
  
  /**
   * Log an error
   */
  public logError(
    operation: string,
    error: Error | string,
    context: Record<string, any>
  ): void {
    const errorMessage = error instanceof Error ? error.message : error;
    const stackTrace = error instanceof Error ? error.stack : undefined;
    
    this.addEntry({
      operation,
      category: 'error',
      severity: 'error',
      inputs: context,
      outputs: {
        error: errorMessage
      },
      metadata: {
        stackTrace
      },
      tags: ['error', operation]
    });
    
    // Also log to console for immediate visibility
    logger.error(`Audit: ${operation} failed`, { error: errorMessage, context });
  }
  
  /**
   * Log a critical error
   */
  public logCritical(
    operation: string,
    error: Error | string,
    context: Record<string, any>
  ): void {
    const errorMessage = error instanceof Error ? error.message : error;
    const stackTrace = error instanceof Error ? error.stack : undefined;
    
    this.addEntry({
      operation,
      category: 'error',
      severity: 'critical',
      inputs: context,
      outputs: {
        error: errorMessage
      },
      metadata: {
        stackTrace
      },
      tags: ['critical', operation]
    });
    
    // Immediate alert for critical errors
    logger.error(`CRITICAL: ${operation} failed critically`, { error: errorMessage, context });
    this.persist(); // Immediately persist critical errors
  }
  
  /**
   * Add entry to audit log
   */
  private addEntry(partial: Omit<AuditEntry, 'id' | 'timestamp'>): void {
    const entry: AuditEntry = {
      id: this.generateId(),
      timestamp: new Date(),
      ...partial
    };
    
    this.entries.push(entry);
    
    // Rotate if too many entries
    if (this.entries.length > this.MAX_ENTRIES) {
      this.entries = this.entries.slice(-this.MAX_ENTRIES);
    }
  }
  
  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Start auto-persist timer
   */
  private startAutoPersist(): void {
    if (this.persistTimer) {
      clearInterval(this.persistTimer);
    }
    
    this.persistTimer = setInterval(() => {
      this.persist();
    }, this.PERSIST_INTERVAL);
  }
  
  /**
   * Persist audit log to storage
   */
  public persist(): void {
    if (this.entries.length === 0) return;
    
    try {
      // In browser environment, use localStorage
      if (typeof window !== 'undefined') {
        const existingData = localStorage.getItem('auditLog');
        const existing = existingData ? JSON.parse(existingData) : [];
        
        // Merge and limit size
        const combined = [...existing, ...this.entries].slice(-this.MAX_ENTRIES);
        localStorage.setItem('auditLog', JSON.stringify(combined));
        
        logger.info(`Persisted ${this.entries.length} audit entries`);
      } else {
        // In Node environment, could write to file
        logger.info(`Would persist ${this.entries.length} audit entries`);
      }
      
      // Clear persisted entries
      this.entries = [];
    } catch (error) {
      logger.error('Failed to persist audit log', error);
    }
  }
  
  /**
   * Load persisted audit log
   */
  public load(): void {
    try {
      if (typeof window !== 'undefined') {
        const data = localStorage.getItem('auditLog');
        if (data) {
          const loaded = JSON.parse(data);
          this.entries = loaded.map((e: any) => ({
            ...e,
            timestamp: new Date(e.timestamp)
          }));
          logger.info(`Loaded ${this.entries.length} audit entries`);
        }
      }
    } catch (error) {
      logger.error('Failed to load audit log', error);
    }
  }
  
  /**
   * Generate audit report
   */
  public generateReport(
    startDate?: Date,
    endDate?: Date
  ): AuditReport {
    const filtered = this.entries.filter(e => {
      if (startDate && e.timestamp < startDate) return false;
      if (endDate && e.timestamp > endDate) return false;
      return true;
    });
    
    // Category breakdown
    const byCategory: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    const operationCounts: Record<string, number> = {};
    const durations: number[] = [];
    const slowOps: Array<{ operation: string; duration: number }> = [];
    
    filtered.forEach(entry => {
      // Categories
      byCategory[entry.category] = (byCategory[entry.category] || 0) + 1;
      
      // Severities
      bySeverity[entry.severity] = (bySeverity[entry.severity] || 0) + 1;
      
      // Operations
      operationCounts[entry.operation] = (operationCounts[entry.operation] || 0) + 1;
      
      // Performance
      if (entry.metadata.duration) {
        durations.push(entry.metadata.duration);
        if (entry.metadata.duration > 100) { // Slow if > 100ms
          slowOps.push({
            operation: entry.operation,
            duration: entry.metadata.duration
          });
        }
      }
    });
    
    // Top operations
    const topOperations = Object.entries(operationCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([operation, count]) => ({ operation, count }));
    
    // Errors and warnings
    const errors = filtered.filter(e => e.severity === 'error' || e.severity === 'critical');
    const warnings = filtered.filter(e => e.severity === 'warning');
    
    // Performance stats
    const avgDuration = durations.length > 0 
      ? durations.reduce((a, b) => a + b, 0) / durations.length 
      : 0;
    const maxDuration = durations.length > 0 
      ? Math.max(...durations) 
      : 0;
    
    return {
      startDate: filtered[0]?.timestamp || new Date(),
      endDate: filtered[filtered.length - 1]?.timestamp || new Date(),
      totalEntries: filtered.length,
      byCategory,
      bySeverity,
      topOperations,
      errors,
      warnings,
      performanceStats: {
        avgDuration,
        maxDuration,
        slowOperations: slowOps.sort((a, b) => b.duration - a.duration).slice(0, 10)
      }
    };
  }
  
  /**
   * Query audit log
   */
  public query(filters: {
    category?: string;
    severity?: string;
    operation?: string;
    playerName?: string;
    startDate?: Date;
    endDate?: Date;
    tags?: string[];
  }): AuditEntry[] {
    return this.entries.filter(entry => {
      if (filters.category && entry.category !== filters.category) return false;
      if (filters.severity && entry.severity !== filters.severity) return false;
      if (filters.operation && !entry.operation.includes(filters.operation)) return false;
      if (filters.playerName && entry.playerName !== filters.playerName) return false;
      if (filters.startDate && entry.timestamp < filters.startDate) return false;
      if (filters.endDate && entry.timestamp > filters.endDate) return false;
      if (filters.tags && !filters.tags.every(tag => entry.tags.includes(tag))) return false;
      return true;
    });
  }
  
  /**
   * Export audit log to CSV
   */
  public exportToCSV(): string {
    const headers = [
      'Timestamp',
      'Operation',
      'Category',
      'Severity',
      'Player',
      'Confidence',
      'Duration (ms)',
      'Tags'
    ];
    
    const rows = this.entries.map(entry => [
      entry.timestamp.toISOString(),
      entry.operation,
      entry.category,
      entry.severity,
      entry.playerName || '',
      entry.metadata.confidence?.toFixed(3) || '',
      entry.metadata.duration?.toString() || '',
      entry.tags.join(';')
    ]);
    
    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }
  
  /**
   * Clear audit log
   */
  public clear(): void {
    this.entries = [];
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auditLog');
    }
    logger.info('Audit log cleared');
  }
  
  /**
   * Get current entries count
   */
  public getEntryCount(): number {
    return this.entries.length;
  }
  
  /**
   * Stop auto-persist
   */
  public stopAutoPersist(): void {
    if (this.persistTimer) {
      clearInterval(this.persistTimer);
      this.persistTimer = null;
    }
  }
}

export const auditLogger = AuditLogger.getInstance();