/**
 * @deprecated - Use DataLoaderV2 instead, which has the full integrated pipeline
 * 
 * Data Loader V3 - DEPRECATED
 * 
 * This loader has been superseded by DataLoaderV2, which includes:
 * - DataIntegrationService for orchestration
 * - ProjectionAggregator for weighted averaging (FantasyPros 40%, CBS 35%, baseline 25%)
 * - PlayerResolver for name/team normalization
 * - Clean data loading from Python ETL pipeline
 * - Better error handling and fallback mechanisms
 * 
 * DO NOT USE THIS LOADER - Use DataLoaderV2 which is the superior integrated version
 */

import type { ComprehensiveData } from '@/types';
import { cleanDataLoader, type CleanDataLoadResult } from './cleanDataLoader';
import { logger } from './utils/logger';

export interface DataLoadOptions {
  forceRefresh?: boolean;
  skipIntegrityCheck?: boolean;
  fallbackToCanonical?: boolean; // Emergency fallback only
}

export interface DataLoadResult {
  success: boolean;
  data: ComprehensiveData;
  source: 'clean' | 'canonical' | 'cache';
  dataQuality: number;
  timestamp: string;
  errors: string[];
  warnings: string[];
}

/**
 * @deprecated Use DataLoaderV2 instead
 * Data Loader V3 - DEPRECATED - Use DataLoaderV2 for the integrated pipeline
 */
export class DataLoaderV3 {
  private static instance: DataLoaderV3;
  private currentData: ComprehensiveData | null = null;
  private lastLoadTime: number = 0;
  private isLoading: boolean = false;

  private constructor() {
    // Singleton pattern
  }

  public static getInstance(): DataLoaderV3 {
    if (!DataLoaderV3.instance) {
      DataLoaderV3.instance = new DataLoaderV3();
    }
    return DataLoaderV3.instance;
  }

  /**
   * Main entry point - Load all data
   */
  public async loadAllData(options: DataLoadOptions = {}): Promise<DataLoadResult> {
    const startTime = performance.now();
    
    // Prevent concurrent loads
    if (this.isLoading) {
      logger.warn('Data load already in progress, waiting...');
      while (this.isLoading) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      if (this.currentData && !options.forceRefresh) {
        return this.createSuccessResult(this.currentData, 'cache', performance.now() - startTime);
      }
    }

    this.isLoading = true;

    try {
      // Check if ETL pipeline needs to be run
      const needsUpdate = await cleanDataLoader.needsETLUpdate();
      if (needsUpdate) {
        logger.warn('Clean data is stale or missing. ETL pipeline needs to be run.');
        
        // Attempt to trigger ETL pipeline
        const pipelineResult = await this.triggerETLPipeline();
        if (!pipelineResult.success) {
          logger.error('Failed to run ETL pipeline:', pipelineResult.error);
          
          if (!options.fallbackToCanonical) {
            throw new Error('Clean data not available and ETL pipeline failed. Please run: npm run pipeline');
          }
          
          // Emergency fallback - this should rarely happen
          logger.warn('FALLING BACK TO CANONICAL DATA - This is not recommended!');
          return this.loadCanonicalDataFallback();
        }
      }

      // Clear cache if force refresh requested
      if (options.forceRefresh) {
        cleanDataLoader.clearCache();
        this.currentData = null;
      }

      // Load clean data
      logger.info('Loading clean, validated data from artifacts...');
      const loadResult = await cleanDataLoader.loadAllCleanData();

      if (!loadResult.success) {
        throw new Error(`Failed to load clean data: ${loadResult.errors.join(', ')}`);
      }

      // Verify data integrity
      if (!options.skipIntegrityCheck) {
        const integrityValid = await this.verifyDataIntegrity(loadResult);
        if (!integrityValid) {
          logger.error('Data integrity check failed');
          loadResult.warnings.push('Data integrity check failed');
        }
      }

      // Cache the data
      this.currentData = loadResult.data;
      this.lastLoadTime = Date.now();

      // Log summary
      logger.info('Data loaded successfully', {
        source: 'clean',
        players: loadResult.data.players.length,
        projections: loadResult.data.projections.length,
        adpData: loadResult.data.adpData.length,
        dataQuality: loadResult.manifest.statistics
      });

      return {
        success: true,
        data: loadResult.data,
        source: 'clean',
        dataQuality: loadResult.data.deduplicationReport.dataQualityScore,
        timestamp: new Date().toISOString(),
        errors: loadResult.errors,
        warnings: loadResult.warnings
      };

    } catch (error) {
      logger.error('Failed to load data:', error);
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Try to return cached data if available
      if (this.currentData) {
        logger.warn('Returning cached data due to load error');
        return {
          success: true,
          data: this.currentData,
          source: 'cache',
          dataQuality: 75, // Assume cached data has decent quality
          timestamp: new Date(this.lastLoadTime).toISOString(),
          errors: [errorMessage],
          warnings: ['Using cached data due to load error']
        };
      }

      // No cached data available
      return {
        success: false,
        data: this.getEmptyData(),
        source: 'clean',
        dataQuality: 0,
        timestamp: new Date().toISOString(),
        errors: [errorMessage],
        warnings: []
      };

    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Trigger the ETL pipeline to process fresh data
   */
  private async triggerETLPipeline(): Promise<{ success: boolean; error?: string }> {
    logger.info('Triggering ETL pipeline...');
    
    try {
      // In a production environment, this would trigger the Python pipeline
      // For now, we'll make an API call or use a webhook
      
      // Option 1: If running in Node environment with child_process
      if (typeof window === 'undefined') {
        const { exec } = await import('child_process');
        return new Promise((resolve) => {
          exec('python3 etl/pipeline.py', (error, stdout, stderr) => {
            if (error) {
              logger.error('Pipeline execution failed:', stderr);
              resolve({ success: false, error: stderr || error.message });
            } else {
              logger.info('Pipeline executed successfully');
              resolve({ success: true });
            }
          });
        });
      }
      
      // Option 2: API endpoint to trigger pipeline
      const response = await fetch('/api/trigger-pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'data-loader' })
      });
      
      if (!response.ok) {
        throw new Error(`Pipeline trigger failed: ${response.statusText}`);
      }
      
      const result = await response.json();
      return { success: result.success, error: result.error };
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('Failed to trigger pipeline:', errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Verify integrity of loaded data
   */
  private async verifyDataIntegrity(loadResult: CleanDataLoadResult): Promise<boolean> {
    try {
      // Check manifest integrity flag
      if (!loadResult.manifest.integrity_verified) {
        logger.warn('Manifest indicates integrity not verified');
        return false;
      }

      // Verify data consistency
      const checks = [
        // Check that we have data
        loadResult.data.players.length > 0,
        loadResult.data.projections.length > 0,
        loadResult.data.adpData.length > 0,
        
        // Check data quality score
        loadResult.data.deduplicationReport.dataQualityScore >= 70,
        
        // Check for reasonable data ranges
        loadResult.data.players.every(p => p.points >= 0),
        loadResult.data.players.every(p => p.adp > 0 && p.adp <= 1000),
        loadResult.data.players.every(p => p.auctionValue >= 0 && p.auctionValue <= 200)
      ];

      const allChecksPass = checks.every(check => check);
      
      if (!allChecksPass) {
        logger.error('Data integrity checks failed', {
          checks: checks.map((c, i) => ({ index: i, passed: c }))
        });
      }

      return allChecksPass;

    } catch (error) {
      logger.error('Error during integrity verification:', error);
      return false;
    }
  }

  /**
   * Emergency fallback to load canonical data directly (not recommended)
   */
  private async loadCanonicalDataFallback(): Promise<DataLoadResult> {
    logger.warn('⚠️ EMERGENCY FALLBACK - Loading canonical data directly');
    logger.warn('This bypasses all data validation and cleaning!');
    
    // This would use the old loader as a fallback
    // Implementation would go here, but we want to discourage this path
    
    return {
      success: false,
      data: this.getEmptyData(),
      source: 'canonical',
      dataQuality: 0,
      timestamp: new Date().toISOString(),
      errors: ['Canonical data fallback not implemented - please run ETL pipeline'],
      warnings: ['Clean data not available']
    };
  }

  /**
   * Create a success result
   */
  private createSuccessResult(
    data: ComprehensiveData, 
    source: 'clean' | 'cache',
    loadTime: number
  ): DataLoadResult {
    return {
      success: true,
      data,
      source,
      dataQuality: data.deduplicationReport.dataQualityScore,
      timestamp: new Date().toISOString(),
      errors: [],
      warnings: source === 'cache' ? ['Using cached data'] : []
    };
  }

  /**
   * Get empty data structure
   */
  private getEmptyData(): ComprehensiveData {
    return {
      adpData: [],
      projections: [],
      historicalStats: [],
      players: [],
      teamMetrics: new Map(),
      teamComposites: new Map(),
      playerAdvanced: new Map(),
      playerStats: new Map(),
      depthCharts: {
        teams: [],
        byPlayer: new Map(),
        byTeam: new Map()
      },
      deduplicationReport: {
        adpConflicts: [],
        projectionConflicts: [],
        dataQualityScore: 0,
        flaggedForReview: []
      },
      positionEligibility: new Map(),
      advancedStats: [],
      teamData: [],
      scheduleData: null
    };
  }

  /**
   * Get current cached data if available
   */
  public getCachedData(): ComprehensiveData | null {
    return this.currentData;
  }

  /**
   * Check if data needs refresh
   */
  public needsRefresh(): boolean {
    if (!this.currentData || !this.lastLoadTime) {
      return true;
    }

    // Refresh if data is older than 1 hour
    const age = Date.now() - this.lastLoadTime;
    return age > 60 * 60 * 1000;
  }

  /**
   * Clear all cached data
   */
  public clearCache(): void {
    this.currentData = null;
    this.lastLoadTime = 0;
    cleanDataLoader.clearCache();
    logger.info('All data caches cleared');
  }
}

// Export singleton instance
export const dataLoader = DataLoaderV3.getInstance();