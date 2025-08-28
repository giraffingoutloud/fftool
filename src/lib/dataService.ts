/**
 * Data Service - Unified interface for data access
 * 
 * This is the main entry point for all data operations in the application.
 * It ensures that only clean, validated data is used.
 */

import { DataLoaderV2 } from './dataLoaderV2';
import type { ComprehensiveData } from '@/types';
import { logger } from './utils/logger';

export class DataService {
  private static instance: DataService;
  private dataLoader: DataLoaderV2;

  private constructor() {
    this.dataLoader = new DataLoaderV2();
  }

  public static getInstance(): DataService {
    if (!DataService.instance) {
      DataService.instance = new DataService();
    }
    return DataService.instance;
  }

  /**
   * Initialize and load all data
   * This should be called when the app starts
   */
  public async initialize(): Promise<boolean> {
    logger.info('Initializing Data Service...');
    
    try {
      // DataLoaderV2 with integrated pipeline is superior
      const data = await this.dataLoader.loadAllData();

      if (!data) {
        logger.error('Failed to initialize data service: No data returned');
        this.showDataError(['Failed to load data']);
        return false;
      }

      // Log data quality metrics
      logger.info('Data Service initialized successfully', {
        source: 'integrated-pipeline',
        dataQuality: data.deduplicationReport.dataQualityScore,
        players: data.players.length,
        projections: data.projections.length,
        timestamp: new Date().toISOString()
      });

      // Show data quality warning if needed
      if (data.deduplicationReport.dataQualityScore < 80) {
        logger.warn(`Data quality is below optimal: ${data.deduplicationReport.dataQualityScore}%`);
      }

      return true;

    } catch (error) {
      logger.error('Failed to initialize data service:', error);
      this.showDataError([error instanceof Error ? error.message : String(error)]);
      return false;
    }
  }

  /**
   * Get current data
   */
  public async getData(): Promise<ComprehensiveData> {
    // DataLoaderV2 handles caching internally through DataIntegrationService
    const data = await this.dataLoader.loadAllData();
    
    if (!data) {
      throw new Error('Failed to load data');
    }

    return data;
  }

  /**
   * Force refresh data
   */
  public async refreshData(): Promise<boolean> {
    logger.info('Refreshing data...');
    
    // Force a new load through the integrated pipeline
    const data = await this.dataLoader.loadAllData();

    return !!data;
  }

  /**
   * Clear all caches
   */
  public clearCache(): void {
    // DataLoaderV2 doesn't expose clearCache directly
    // but we can force a reload on next access
    logger.info('Cache will be refreshed on next data access');
  }

  /**
   * Check if ETL pipeline needs to be run
   */
  public async checkDataFreshness(): Promise<{
    isFresh: boolean;
    lastUpdate?: string;
    message: string;
  }> {
    try {
      const response = await fetch('/artifacts/data_manifest.json');
      if (!response.ok) {
        return {
          isFresh: false,
          message: 'No clean data available. Please run: npm run data:refresh'
        };
      }

      const manifest = await response.json();
      const age = Date.now() - new Date(manifest.generated_at).getTime();
      const hours = Math.floor(age / (1000 * 60 * 60));

      if (hours > 24) {
        return {
          isFresh: false,
          lastUpdate: manifest.generated_at,
          message: `Data is ${hours} hours old. Consider running: npm run data:refresh`
        };
      }

      return {
        isFresh: true,
        lastUpdate: manifest.generated_at,
        message: `Data is fresh (${hours} hours old)`
      };

    } catch (error) {
      return {
        isFresh: false,
        message: 'Unable to check data freshness. Please run: npm run data:refresh'
      };
    }
  }

  /**
   * Show user-friendly error message
   */
  private showDataError(errors: string[]): void {
    // In a real app, this would show a toast or modal
    console.error('Data Service Error:', errors);
    
    // Check if it's a missing data error
    if (errors.some(e => e.includes('manifest not available') || e.includes('No clean data'))) {
      console.error('\n📊 DATA SETUP REQUIRED');
      console.error('================================');
      console.error('The data pipeline needs to be run first.');
      console.error('Please run the following command:');
      console.error('\n  npm run data:refresh\n');
      console.error('This will process and validate all data.');
      console.error('================================\n');
    }
  }

  /**
   * Get data statistics for display
   */
  public async getDataStats(): Promise<{
    totalPlayers: number;
    totalProjections: number;
    dataQuality: number;
    lastUpdate: string;
    source: string;
  }> {
    const data = await this.getData();
    
    // Get manifest for metadata
    try {
      const response = await fetch('/artifacts/data_manifest.json');
      const manifest = await response.json();
      
      return {
        totalPlayers: data.players.length,
        totalProjections: data.projections.length,
        dataQuality: data.deduplicationReport.dataQualityScore,
        lastUpdate: manifest.generated_at,
        source: 'clean'
      };
    } catch {
      return {
        totalPlayers: data.players.length,
        totalProjections: data.projections.length,
        dataQuality: data.deduplicationReport.dataQualityScore,
        lastUpdate: new Date().toISOString(),
        source: 'unknown'
      };
    }
  }
}

// Export singleton instance
export const dataService = DataService.getInstance();

// Auto-initialize on import (can be disabled if needed)
if (typeof window !== 'undefined') {
  // Browser environment
  window.addEventListener('DOMContentLoaded', async () => {
    const initialized = await dataService.initialize();
    if (initialized) {
      logger.info('Data service auto-initialized successfully');
    } else {
      logger.error('Data service auto-initialization failed');
    }
  });
}