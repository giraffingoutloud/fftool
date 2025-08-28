/**
 * Clean Data Loader
 * 
 * This module loads pre-processed, validated data from the artifacts directory.
 * All data has already been cleaned by the Python ETL pipeline and is guaranteed to be:
 * - Schema compliant
 * - Duplicate-free
 * - Type-validated
 * - Referentially consistent
 */

import type { 
  Player, 
  PlayerProjection, 
  PlayerADP, 
  PlayerStats,
  ComprehensiveData
} from '@/types';
import { logger } from './utils/logger';
import Papa from 'papaparse';
import { 
  safeParseFloat, 
  safeParseInt, 
  safeParseString,
  STANDARD_PAPA_CONFIG,
  parseCSV,
  validateRow,
  getCompletenessStats
} from './utils/csvParsingUtils';
import { getSchemaForFile } from './utils/csvSchemaDefinitions';

export interface DataManifest {
  version: string;
  generated_at: string;
  pipeline_version: string;
  data_location: string;
  files: Record<string, {
    path: string;
    size_bytes: number;
    modified: string;
    format: string;
  }>;
  statistics: {
    files_processed: number;
    successful_loads: number;
    failed_loads: number;
    rows_parsed: number;
    rows_quarantined: number;
    coercions: number;
    duplicates: number;
  };
  integrity_verified: boolean;
}

export interface CleanDataLoadResult {
  success: boolean;
  data: ComprehensiveData;
  manifest: DataManifest;
  errors: string[];
  warnings: string[];
  loadTime: number;
}

/**
 * Clean Data Loader - Loads pre-processed data from the ETL pipeline
 */
export class CleanDataLoader {
  private static readonly ARTIFACTS_PATH = '/artifacts';
  private static readonly CLEAN_DATA_PATH = '/artifacts/clean_data';
  private static readonly MANIFEST_PATH = '/artifacts/data_manifest.json';
  private static readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache
  
  private static cache: Map<string, { data: any; timestamp: number }> = new Map();
  private manifest: DataManifest | null = null;

  /**
   * Load the data manifest to understand what clean data is available
   */
  private async loadManifest(): Promise<DataManifest> {
    if (this.manifest) {
      return this.manifest;
    }

    try {
      const response = await fetch(CleanDataLoader.MANIFEST_PATH);
      if (!response.ok) {
        throw new Error(`Failed to load manifest: ${response.statusText}`);
      }
      
      this.manifest = await response.json();
      
      // Validate manifest
      if (!this.manifest?.integrity_verified) {
        logger.warn('Data integrity not verified in manifest');
      }
      
      logger.info('Data manifest loaded successfully', {
        version: this.manifest.version,
        files: Object.keys(this.manifest.files).length,
        generated_at: this.manifest.generated_at
      });
      
      return this.manifest;
    } catch (error) {
      logger.error('Failed to load data manifest', { error });
      throw new Error('Data manifest not available. Please run the ETL pipeline first.');
    }
  }

  /**
   * Check if cached data is still fresh
   */
  private isCacheFresh(key: string): boolean {
    const cached = CleanDataLoader.cache.get(key);
    if (!cached) return false;
    
    const age = Date.now() - cached.timestamp;
    return age < CleanDataLoader.CACHE_TTL;
  }

  /**
   * Load a specific cleaned CSV file
   */
  private async loadCleanCSV<T>(filename: string, parser?: (row: any, idx?: number) => T): Promise<T[]> {
    // Check cache
    if (this.isCacheFresh(filename)) {
      logger.info(`Loading ${filename} from cache`);
      return CleanDataLoader.cache.get(filename)!.data;
    }

    try {
      const path = `${CleanDataLoader.CLEAN_DATA_PATH}/${filename}`;
      const response = await fetch(path);
      
      if (!response.ok) {
        throw new Error(`Failed to load ${filename}: ${response.statusText}`);
      }
      
      const text = await response.text();
      
      // Parse CSV using standardized configuration
      const result = parseCSV(text, {
        header: true,
        dynamicTyping: false, // We handle typing ourselves
        skipEmptyLines: 'greedy'
      });
      
      if (result.errors.length > 0) {
        logger.warn(`Errors parsing ${filename}:`, result.errors);
      }
      
      let data = result.data;
      
      // Validate against schema if available
      const schema = getSchemaForFile(filename);
      if (schema) {
        let validRows = 0;
        let totalWarnings = 0;
        let totalErrors = 0;
        
        data.forEach((row, idx) => {
          const validation = validateRow(row, schema);
          if (validation.valid) {
            validRows++;
          } else {
            totalErrors += validation.errors.length;
            if (validation.errors.length > 0 && idx < 5) {
              logger.warn(`Row ${idx + 1} validation errors in ${filename}:`, validation.errors);
            }
          }
          totalWarnings += validation.warnings.length;
        });
        
        const stats = getCompletenessStats(data);
        logger.info(`Schema validation for ${filename}: ${validRows}/${data.length} valid rows, ` +
                   `${totalErrors} errors, ${totalWarnings} warnings, ` +
                   `${stats.completenessPercentage.toFixed(1)}% complete`);
      }
      
      // Apply custom parser if provided
      if (parser) {
        data = data.map((row, idx) => parser(row, idx));
      }
      
      // Cache the result
      CleanDataLoader.cache.set(filename, {
        data,
        timestamp: Date.now()
      });
      
      logger.info(`Loaded ${data.length} rows from ${filename}`);
      return data;
      
    } catch (error) {
      logger.error(`Failed to load ${filename}:`, error);
      throw error;
    }
  }

  /**
   * Load all clean data from the artifacts directory
   */
  public async loadAllCleanData(): Promise<CleanDataLoadResult> {
    const startTime = performance.now();
    const errors: string[] = [];
    const warnings: string[] = [];
    
    try {
      // Load manifest first
      const manifest = await this.loadManifest();
      
      // Check if clean data is available
      if (!manifest.files || Object.keys(manifest.files).length === 0) {
        throw new Error('No clean data files available. Please run the ETL pipeline.');
      }
      
      // Check data freshness
      const dataAge = Date.now() - new Date(manifest.generated_at).getTime();
      if (dataAge > 24 * 60 * 60 * 1000) { // Older than 24 hours
        warnings.push('Data is more than 24 hours old. Consider running the ETL pipeline.');
      }
      
      logger.info('Loading clean data from artifacts...');
      
      // Load each dataset in parallel
      const [
        projections,
        adpData,
        historicalStats,
        preseasonRankings
      ] = await Promise.all([
        this.loadProjections(),
        this.loadADPData(),
        this.loadHistoricalStats(),
        this.loadPreseasonRankings()
      ]);
      
      // Compile comprehensive data structure
      const comprehensiveData: ComprehensiveData = {
        // Core data
        adpData,
        projections,
        historicalStats,
        players: this.buildPlayersList(projections, adpData),
        
        // These would need additional loading
        teamMetrics: new Map(),
        teamComposites: new Map(),
        playerAdvanced: new Map(),
        playerStats: new Map(),
        depthCharts: {
          teams: [],
          byPlayer: new Map(),
          byTeam: new Map()
        },
        
        // Data quality report from manifest
        deduplicationReport: {
          adpConflicts: [],
          projectionConflicts: [],
          dataQualityScore: this.calculateDataQualityScore(manifest),
          flaggedForReview: []
        },
        
        positionEligibility: new Map(),
        advancedStats: [],
        teamData: [],
        scheduleData: null
      };
      
      const loadTime = performance.now() - startTime;
      
      logger.info(`Clean data loaded successfully in ${loadTime.toFixed(2)}ms`);
      
      return {
        success: true,
        data: comprehensiveData,
        manifest,
        errors,
        warnings,
        loadTime
      };
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      errors.push(errorMsg);
      logger.error('Failed to load clean data:', error);
      
      return {
        success: false,
        data: this.getEmptyData(),
        manifest: this.getEmptyManifest(),
        errors,
        warnings,
        loadTime: performance.now() - startTime
      };
    }
  }

  /**
   * Build SOS map from CSV data for quick lookup
   */
  private async buildSOSMap(): Promise<Map<string, number>> {
    const sosMap = new Map<string, number>();
    
    try {
      const sosData = await this.loadCleanCSV<any>('sos_2025.csv');
      sosData.forEach(row => {
        // New format: Team, SOS_Rank, SOS_Percentage, SOS_Normalized
        if (row.Team) {
          const teamCode = row.Team;
          const seasonSOS = safeParseFloat(row.SOS_Normalized, null, 0);
          
          // Set SOS for team
          sosMap.set(teamCode, seasonSOS);
          
          // Debug specific teams
          if (teamCode === 'DET' || teamCode === 'GB' || teamCode === 'SF' || teamCode === 'NYG') {
            logger.info(`SOS Debug: ${teamCode}, SOS = ${seasonSOS}`);
          }
        }
      });
      logger.info(`Built SOS map for ${sosMap.size} teams`);
      
      // Debug: Show what's in the map for key teams
      const debugTeams = ['DET', 'GB', 'SF', 'JAX', 'NYG'];
      debugTeams.forEach(team => {
        if (sosMap.has(team)) {
          logger.info(`SOS Map contains ${team}: ${sosMap.get(team)}`);
        }
      });
    } catch (error) {
      logger.warn('Could not load SOS data:', error);
    }
    
    return sosMap;
  }

  /**
   * Load projections data
   */
  private async loadProjections(): Promise<PlayerProjection[]> {
    // Build SOS lookup map
    const sosMap = await this.buildSOSMap();
    
    // Use projections_2025_with_adp.csv which has correct market values in column 65
    return this.loadCleanCSV<PlayerProjection>('projections_2025_with_adp.csv', (row) => ({
      id: `${row.playerName}_${row.position}_${row.teamName}`.toLowerCase(),
      name: safeParseString(row.playerName) || '',
      position: safeParseString(row.position) || '',
      team: safeParseString(row.teamName) || '',
      byeWeek: safeParseInt(row.byeWeek) || undefined,
      projectedPoints: safeParseFloat(row.fantasyPoints, 2, null) ?? 0,
      teamSeasonSOS: sosMap.get(row.teamName) || 0,  // Just lookup the SOS by team
      
      // Projection details
      games: safeParseFloat(row.games, 1, null) ?? 0,
      
      // Passing stats
      passingYards: safeParseFloat(row.passYds, 1, null) ?? 0,
      passingTDs: safeParseFloat(row.passTd, 1, null) ?? 0,
      passingINTs: safeParseFloat(row.passInt, 1, null) ?? 0,
      
      // Rushing stats
      rushingYards: safeParseFloat(row.rushYds, 1, null) ?? 0,
      rushingTDs: safeParseFloat(row.rushTd, 1, null) ?? 0,
      
      // Receiving stats
      receptions: safeParseFloat(row.recvReceptions, 1, null) ?? 0,
      receivingYards: safeParseFloat(row.recvYds, 1, null) ?? 0,
      receivingTDs: safeParseFloat(row.recvTd, 1, null) ?? 0,
      
      // Confidence and value
      confidence: 0.85, // Default confidence since cleaned data
      marketValue: (() => {
        const value = safeParseInt(row.marketValue) ?? 1;
        // Debug log for Breece Hall
        if (row.playerName === 'Breece Hall') {
          console.log('[DEBUG] Breece Hall marketValue:', {
            raw: row.marketValue,
            parsed: value,
            auctionValue: row.auctionValue
          });
        }
        return value;
      })()
    }));
  }

  /**
   * Load ADP data from all sources and calculate aggregate
   */
  private async loadADPData(): Promise<PlayerADP[]> {
    // Build SOS lookup map
    const sosMap = await this.buildSOSMap();
    
    // Map to store all ADP values for each player
    const playerADPMap = new Map<string, {
      player: PlayerADP,
      adpValues: { source: string, value: number }[]
    }>();

    // Helper to create player key
    const makeKey = (name: string, team: string, pos: string) => 
      `${name}_${team}_${pos}`.toLowerCase().replace(/[^a-z0-9_]/g, '');

    // Load primary ADP data (adp0)
    const primaryADP = await this.loadCleanCSV<PlayerADP>('adp0_2025.csv', (row) => ({
      id: `${row['Full Name']}_${row.Position}_${row['Team Abbreviation']}`.toLowerCase(),
      name: safeParseString(row['Full Name']) || '',
      position: safeParseString(row.Position) || '',
      team: safeParseString(row['Team Abbreviation']) || '',
      adp: safeParseFloat(row.ADP, 2) ?? 999,
      adpRank: safeParseInt(row['Overall Rank']) ?? 999,
      auctionValue: safeParseInt(row['Auction Value']) ?? 1,
      isRookie: row['Is Rookie'] === 'Yes',
      byeWeek: safeParseInt(row['Bye Week']) || undefined,
      positionRank: safeParseInt(row['Position Rank']) ?? 999,
      overallRank: safeParseInt(row['Overall Rank']) ?? 999,
      teamSeasonSOS: sosMap.get(row['Team Abbreviation']) || 0, // Add SOS
      age: undefined, // adp0 doesn't have age
      adpSources: [] // Track individual sources
    }));

    // Add primary ADP to map
    primaryADP.forEach(player => {
      const key = makeKey(player.name, player.team, player.position);
      playerADPMap.set(key, {
        player,
        adpValues: [{ source: 'adp0', value: player.adp }]
      });
    });
    
    // Load adp2_2025.csv for age and injury status data
    try {
      const supplementalData = await this.loadCleanCSV<any>('adp2_2025.csv', (row) => ({
        name: safeParseString(row.Name),
        age: safeParseInt(row.Age) || undefined,
        status: safeParseString(row.Status) || 'Healthy',
        fantasyScore: safeParseFloat(row['Fantasy Score'], 2) || undefined
      }));
      
      // Create lookup maps
      const supplementalMap = new Map<string, any>();
      supplementalData.forEach(player => {
        if (player.name) {
          // Normalize name for matching
          const normalizedName = player.name.toLowerCase().replace(/[^a-z]/g, '');
          supplementalMap.set(normalizedName, player);
        }
      });
      
      // Merge supplemental data into primary ADP
      primaryADP.forEach(player => {
        const normalizedName = player.name.toLowerCase().replace(/[^a-z]/g, '');
        const supplemental = supplementalMap.get(normalizedName);
        if (supplemental) {
          player.age = supplemental.age;
          // Map injury status to standard codes
          const statusMap: Record<string, string> = {
            'Healthy': null,
            'Questionable': 'Q',
            'Doubtful': 'D',
            'Out': 'O',
            'IR': 'IR',
            'PUP': 'PUP',
            'Suspended': 'SUS'
          };
          player.injuryStatus = statusMap[supplemental.status] || null;
          player.fantasyScore = supplemental.fantasyScore;
        }
      });
    } catch (error) {
      logger.warn('Could not load supplemental data from adp2_2025.csv:', error);
    }

    // Load adp1_2025.csv (largest source with 4000+ players)
    try {
      const adp1Data = await this.loadCleanCSV<any>('adp1_2025.csv', (row) => {
        // Helper to parse values that might be "-" or have commas
        const parseValue = (val: string) => {
          const parsed = safeParseFloat(val, 2);
          return parsed ?? 999; // Use 999 for missing ADP values
        };

        // Process player from adp1
        // The clean data has been preprocessed with proper column names
        // ESPN_AAV contains the actual auction values
        
        return {
          name: row.Name,
          team: row.Team,
          position: row.Pos,
          espn: parseValue(row.ESPN),
          sleeper: parseValue(row.Sleeper),
          fantrax: parseValue(row.Fantrax),
          mfl: parseValue(row.MFL),
          nffc: parseValue(row.NFFC),
          // ESPN_AAV contains the actual auction values
          aav: parseValue(row.ESPN_AAV || row.MFL_AAV || '1')
        };
      });

      adp1Data.forEach(player => {
        if (player.name && player.team && player.position) {
          const key = makeKey(player.name, player.team, player.position);
          const existing = playerADPMap.get(key);
          
          // Process fullbacks and special positions
          
          // Calculate mean ADP from available sources in adp1
          const adpValues = [
            player.espn, player.sleeper, player.fantrax, 
            player.mfl, player.nffc
          ].filter(v => v && v < 500);
          
          // If no valid ADP values but player exists, use a high default
          if (adpValues.length === 0 && player.name) {
            // For players with no ADP, use 300 as default
            const defaultAdp = 300;
            
            if (existing) {
              existing.adpValues.push({ source: 'adp1', value: defaultAdp });
            } else {
              // Still add the player with high ADP
              playerADPMap.set(key, {
                player: {
                  id: `${player.name}_${player.position}_${player.team}`.toLowerCase(),
                  name: player.name,
                  position: player.position,
                  team: player.team,
                  adp: defaultAdp,
                  adpRank: defaultAdp,
                  auctionValue: player.aav && player.aav < 999 ? Math.round(player.aav) : 1,
                  isRookie: false,
                  byeWeek: undefined,
                  positionRank: 999,
                  overallRank: defaultAdp,
                  age: undefined,
                  adpSources: []
                },
                adpValues: [{ source: 'adp1', value: defaultAdp }]
              });
            }
          } else if (adpValues.length > 0) {
            const meanAdp = adpValues.reduce((a, b) => a + b, 0) / adpValues.length;
            
            if (existing) {
              existing.adpValues.push({ source: 'adp1', value: meanAdp });
              // Update auction value ONLY if we don't have a good one from adp0
              // adp0 has the authoritative auction values, don't overwrite with ESPN_AAV/MFL_AAV
              if (player.aav && player.aav > 0 && player.aav < 999) {
                // Only update if current value is 1 (default) or missing
                if (!existing.player.auctionValue || existing.player.auctionValue <= 1) {
                  existing.player.auctionValue = Math.round(player.aav);
                }
                // Debug for Breece Hall
                if (player.name === 'Breece Hall') {
                  console.log('[ROOT CAUSE FIX] Breece Hall auction value:', {
                    fromAdp0: existing.player.auctionValue,
                    fromAdp1AAV: player.aav,
                    keeping: existing.player.auctionValue
                  });
                }
              }
            } else {
              // New player not in adp0
              playerADPMap.set(key, {
                player: {
                  id: `${player.name}_${player.position}_${player.team}`.toLowerCase(),
                  name: player.name,
                  position: player.position,
                  team: player.team,
                  adp: meanAdp,
                  adpRank: Math.round(meanAdp),
                  auctionValue: player.aav && player.aav < 999 ? Math.round(player.aav) : 1,
                  isRookie: false,
                  byeWeek: undefined,
                  positionRank: 999,
                  overallRank: Math.round(meanAdp),
                  age: undefined,
                  teamSeasonSOS: sosMap.get(player.team) || 0,  // Add SOS
                  adpSources: []
                },
                adpValues: [{ source: 'adp1', value: meanAdp }]
              });
            }
          }
        }
      });
      logger.info(`Loaded ${adp1Data.length} entries from adp1_2025.csv`);
    } catch (error) {
      logger.warn('Could not load adp1_2025.csv:', error);
    }

    // Load adp3_2025.csv  
    try {
      const adp3Data = await this.loadCleanCSV<any>('adp3_2025.csv', (row) => ({
        adp: safeParseFloat(row.ADP, 2) ?? 999,
        position: safeParseString(row.Position)?.split('-')[0] || '',
        name: safeParseString(row.Player),
        team: safeParseString(row.Team)
      }));

      adp3Data.forEach(player => {
        if (player.name && player.team && player.position) {
          const key = makeKey(player.name, player.team, player.position);
          const existing = playerADPMap.get(key);
          
          if (player.adp && player.adp < 500) {
            if (existing) {
              existing.adpValues.push({ source: 'adp3', value: player.adp });
            } else {
              // New player not in other sources
              playerADPMap.set(key, {
                player: {
                  id: `${player.name}_${player.position}_${player.team}`.toLowerCase(),
                  name: player.name,
                  position: player.position,
                  team: player.team,
                  adp: player.adp,
                  adpRank: Math.round(player.adp),
                  auctionValue: 1,
                  isRookie: false,
                  byeWeek: undefined,
                  positionRank: 999,
                  overallRank: Math.round(player.adp),
                  age: undefined,
                  teamSeasonSOS: sosMap.get(player.team) || 0,  // Add SOS
                  adpSources: []
                },
                adpValues: [{ source: 'adp3', value: player.adp }]
              });
            }
          }
        }
      });
      logger.info(`Loaded ${adp3Data.length} entries from adp3_2025.csv`);
    } catch (error) {
      logger.warn('Could not load adp3_2025.csv:', error);
    }

    // Load adp4_2025.txt
    try {
      const response4 = await fetch('/artifacts/clean_data/adp4_2025.txt');
      if (response4.ok) {
        const text4 = await response4.text();
        const lines4 = text4.trim().split('\n').slice(1); // Skip header
        
        lines4.forEach(line => {
          const parts = line.split(',');
          if (parts.length >= 5) {
            const name = parts[1]?.trim();
            const position = parts[2]?.trim();
            const team = parts[3]?.trim();
            const adp = safeParseFloat(parts[5], 2) ?? 999;
            
            if (name && position && team) {
              const key = makeKey(name, team, position);
              const existing = playerADPMap.get(key);
              
              if (existing) {
                existing.adpValues.push({ source: 'adp4', value: adp });
              } else {
                // Create new player entry if not in primary
                const newPlayer: PlayerADP = {
                  id: key,
                  name,
                  position: position as any,
                  team,
                  adp,
                  adpRank: safeParseInt(parts[0]) ?? 999,
                  auctionValue: 1,
                  positionRank: 999,
                  adpSources: []
                };
                playerADPMap.set(key, {
                  player: newPlayer,
                  adpValues: [{ source: 'adp4', value: adp }]
                });
              }
            }
          }
        });
        logger.info(`Loaded ${lines4.length} entries from adp4_2025.txt`);
      }
    } catch (error) {
      logger.warn('Could not load adp4_2025.txt:', error);
    }

    // Load adp5_2025.txt
    try {
      const response5 = await fetch('/artifacts/clean_data/adp5_2025.txt');
      if (response5.ok) {
        const text5 = await response5.text();
        const lines5 = text5.trim().split('\n').slice(1); // Skip header
        
        lines5.forEach(line => {
          const parts = line.split(',');
          if (parts.length >= 6) {
            const name = parts[2]?.trim();
            const position = parts[3]?.trim();
            const team = parts[4]?.trim();
            const adp = safeParseFloat(parts[1], 2) ?? 999;
            
            if (name && position && team) {
              const key = makeKey(name, team, position);
              const existing = playerADPMap.get(key);
              
              if (existing) {
                existing.adpValues.push({ source: 'adp5', value: adp });
              } else {
                // Create new player entry if not in primary
                const newPlayer: PlayerADP = {
                  id: key,
                  name,
                  position: position as any,
                  team,
                  adp,
                  adpRank: 999,
                  auctionValue: 1,
                  positionRank: 999,
                  teamSeasonSOS: sosMap.get(team) || 0,  // Add SOS
                  adpSources: []
                };
                playerADPMap.set(key, {
                  player: newPlayer,
                  adpValues: [{ source: 'adp5', value: adp }]
                });
              }
            }
          }
        });
        logger.info(`Loaded ${lines5.length} entries from adp5_2025.txt`);
      }
    } catch (error) {
      logger.warn('Could not load adp5_2025.txt:', error);
    }

    // Calculate aggregate ADP for each player
    const finalPlayers: PlayerADP[] = [];
    playerADPMap.forEach((entry, key) => {
      const { player, adpValues } = entry;
      
      // Calculate mean ADP from all sources
      const validValues = adpValues.filter(v => v.value < 500); // Filter out placeholder 999 values
      if (validValues.length > 0) {
        const sum = validValues.reduce((acc, v) => acc + v.value, 0);
        player.adp = sum / validValues.length;
        
        // Store individual source values for reference
        player.adpSources = adpValues;
      }
      
      // Keep the actual market auction value if we have it, otherwise use a default
      // Don't manufacture auction values from ADP - that creates circular logic
      if (!player.auctionValue || player.auctionValue === 1) {
        // Only set a minimal default if we don't have real market data
        player.auctionValue = 1;
      }
      
      finalPlayers.push(player);
    });

    logger.info(`Loaded ${finalPlayers.length} total players with aggregate ADP from ${playerADPMap.size} unique players`);
    
    // Final player list completed
    
    return finalPlayers;
  }

  /**
   * Load historical stats
   */
  private async loadHistoricalStats(): Promise<PlayerStats[]> {
    const stats: PlayerStats[] = [];
    
    // Load 2024 stats
    const [passing2024, rushing2024] = await Promise.all([
      this.loadCleanCSV('fantasy-stats-passing_2024.csv'),
      this.loadCleanCSV('fantasy-stats-receiving_rushing_2024.csv')
    ]);
    
    // Process and combine stats
    // Implementation would parse and structure the historical data
    
    return stats;
  }

  /**
   * Load preseason rankings
   */
  private async loadPreseasonRankings(): Promise<any[]> {
    return this.loadCleanCSV('preseason_rankings_2025.csv');
  }

  /**
   * Build players list from projections and ADP data
   */
  private buildPlayersList(projections: PlayerProjection[], adpData: PlayerADP[]): Player[] {
    const playersMap = new Map<string, Player>();
    
    // Start with projections
    for (const proj of projections) {
      playersMap.set(proj.id, {
        id: proj.id,
        name: proj.name,
        position: proj.position,
        team: proj.team,
        byeWeek: proj.byeWeek,
        teamSeasonSOS: proj.teamSeasonSOS,
        points: proj.projectedPoints || 0,
        adp: 999, // Will be updated from ADP data
        auctionValue: proj.marketValue || 1
      });
    }
    
    // Merge with ADP data
    for (const adp of adpData) {
      const existing = playersMap.get(adp.id);
      if (existing) {
        existing.adp = adp.adp;
        existing.auctionValue = adp.auctionValue;
      } else {
        // Add players that are only in ADP
        playersMap.set(adp.id, {
          id: adp.id,
          name: adp.name,
          position: adp.position,
          team: adp.team,
          byeWeek: adp.byeWeek,
          teamSeasonSOS: adp.teamSeasonSOS,
          points: 0, // No projection available
          adp: adp.adp,
          auctionValue: adp.auctionValue
        });
      }
    }
    
    return Array.from(playersMap.values());
  }

  /**
   * Calculate data quality score based on manifest statistics
   */
  private calculateDataQualityScore(manifest: DataManifest): number {
    const stats = manifest.statistics;
    if (!stats) return 0;
    
    let score = 100;
    
    // Deduct points for failures and issues
    score -= (stats.failed_loads || 0) * 10;
    score -= (stats.rows_quarantined || 0) / Math.max(stats.rows_parsed || 1, 1) * 20;
    score -= Math.min((stats.coercions || 0) / 100, 10); // Max 10 point deduction for coercions
    
    // Ensure score is between 0 and 100
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Get empty data structure for error cases
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
   * Get empty manifest for error cases
   */
  private getEmptyManifest(): DataManifest {
    return {
      version: '0.0.0',
      generated_at: new Date().toISOString(),
      pipeline_version: '0.0.0',
      data_location: '',
      files: {},
      statistics: {
        files_processed: 0,
        successful_loads: 0,
        failed_loads: 0,
        rows_parsed: 0,
        rows_quarantined: 0,
        coercions: 0,
        duplicates: 0
      },
      integrity_verified: false
    };
  }

  /**
   * Clear the data cache
   */
  public clearCache(): void {
    CleanDataLoader.cache.clear();
    this.manifest = null;
    logger.info('Data cache cleared');
  }

  /**
   * Check if ETL pipeline needs to be run
   */
  public async needsETLUpdate(): Promise<boolean> {
    try {
      const manifest = await this.loadManifest();
      
      // Check if data exists
      if (!manifest.files || Object.keys(manifest.files).length === 0) {
        return true;
      }
      
      // Check data age (older than 24 hours)
      const dataAge = Date.now() - new Date(manifest.generated_at).getTime();
      if (dataAge > 24 * 60 * 60 * 1000) {
        return true;
      }
      
      // Check integrity
      if (!manifest.integrity_verified) {
        return true;
      }
      
      return false;
    } catch {
      // If we can't load manifest, we need to run ETL
      return true;
    }
  }
}

// Export singleton instance
export const cleanDataLoader = new CleanDataLoader();