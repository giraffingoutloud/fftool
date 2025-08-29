/**
 * Loads player physical attributes and college data from team roster files
 */

import { logger } from './utils/logger';

export interface PlayerProfile {
  name: string;
  team: string;
  position: string;
  height?: string;
  weight?: number;
  college?: string;
  age?: number;
  year?: number; // Draft year
  round?: number; // Draft round
  pick?: number; // Draft pick
  offGrade?: number; // PFF offensive grade
  passGrade?: number;
  runGrade?: number;
  recvGrade?: number;
}

export class RosterDataLoader {
  private static instance: RosterDataLoader;
  private playerProfiles = new Map<string, PlayerProfile>();
  private loaded = false;
  
  private constructor() {}
  
  public static getInstance(): RosterDataLoader {
    if (!RosterDataLoader.instance) {
      RosterDataLoader.instance = new RosterDataLoader();
    }
    return RosterDataLoader.instance;
  }
  
  /**
   * Load all team roster files
   */
  public async loadRosterData(): Promise<Map<string, PlayerProfile>> {
    if (this.loaded) {
      return this.playerProfiles;
    }
    
    const teams = [
      '49ers', 'bears', 'bengals', 'bills', 'broncos', 'browns', 'buccaneers',
      'cardinals', 'chargers', 'chiefs', 'colts', 'commanders', 'cowboys',
      'dolphins', 'eagles', 'falcons', 'giants', 'jaguars', 'jets', 'lions',
      'packers', 'panthers', 'patriots', 'raiders', 'rams', 'ravens', 'saints',
      'seahawks', 'steelers', 'texans', 'titans', 'vikings'
    ];
    
    const teamCodeMap: Record<string, string> = {
      '49ers': 'SF',
      'bears': 'CHI',
      'bengals': 'CIN',
      'bills': 'BUF',
      'broncos': 'DEN',
      'browns': 'CLE',
      'buccaneers': 'TB',
      'cardinals': 'ARI',
      'chargers': 'LAC',
      'chiefs': 'KC',
      'colts': 'IND',
      'commanders': 'WAS',
      'cowboys': 'DAL',
      'dolphins': 'MIA',
      'eagles': 'PHI',
      'falcons': 'ATL',
      'giants': 'NYG',
      'jaguars': 'JAC',
      'jets': 'NYJ',
      'lions': 'DET',
      'packers': 'GB',
      'panthers': 'CAR',
      'patriots': 'NE',
      'raiders': 'LV',
      'rams': 'LAR',
      'ravens': 'BAL',
      'saints': 'NO',
      'seahawks': 'SEA',
      'steelers': 'PIT',
      'texans': 'HOU',
      'titans': 'TEN',
      'vikings': 'MIN'
    };
    
    const basePath = import.meta.env.BASE_URL || '/';
    for (const teamFile of teams) {
      try {
        const response = await fetch(`${basePath}canonical_data/advanced_data/2025-2026/${teamFile}.csv`);
        if (!response.ok) continue;
        
        const text = await response.text();
        const rows = this.parseCSV(text);
        const teamCode = teamCodeMap[teamFile];
        
        rows.forEach(row => {
          if (row.NAME && row.NAME !== '-') {
            const profile: PlayerProfile = {
              name: row.NAME,
              team: teamCode,
              position: row.POS,
              height: row.HEIGHT,
              weight: this.parseWeight(row.WEIGHT),
              college: row.COLLEGE,
              age: parseFloat(row.AGE) || undefined,
              year: parseInt(row.YEAR) || undefined,
              round: this.parseRound(row['R#']),
              pick: this.parsePick(row['D#']),
              offGrade: parseFloat(row.OFF_GRADE) || undefined,
              passGrade: parseFloat(row.PASS_GRADE) || undefined,
              runGrade: parseFloat(row.RUN_GRADE) || undefined,
              recvGrade: parseFloat(row.RECV_GRADE) || undefined
            };
            
            // Create normalized key for lookup
            const key = this.normalizeKey(row.NAME);
            this.playerProfiles.set(key, profile);
          }
        });
      } catch (error) {
        logger.warn(`Failed to load roster data for ${teamFile}:`, error);
      }
    }
    
    this.loaded = true;
    logger.info(`Loaded roster data for ${this.playerProfiles.size} players`);
    return this.playerProfiles;
  }
  
  /**
   * Get player profile by name
   */
  public getPlayerProfile(name: string): PlayerProfile | undefined {
    const key = this.normalizeKey(name);
    return this.playerProfiles.get(key);
  }
  
  /**
   * Parse CSV text
   */
  private parseCSV(text: string): any[] {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(',').map(h => h.trim());
    const rows = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index]?.trim() || '';
      });
      rows.push(row);
    }
    
    return rows;
  }
  
  /**
   * Parse weight string (e.g., "218" -> 218)
   */
  private parseWeight(weight: string): number | undefined {
    const parsed = parseInt(weight);
    return isNaN(parsed) ? undefined : parsed;
  }
  
  /**
   * Parse round (e.g., "1" -> 1, "-" -> undefined)
   */
  private parseRound(round: string): number | undefined {
    if (!round || round === '-') return undefined;
    const parsed = parseInt(round);
    return isNaN(parsed) ? undefined : parsed;
  }
  
  /**
   * Parse draft pick
   */
  private parsePick(pick: string): number | undefined {
    if (!pick || pick === '-') return undefined;
    const parsed = parseInt(pick);
    return isNaN(parsed) ? undefined : parsed;
  }
  
  /**
   * Normalize player name for matching
   */
  private normalizeKey(name: string): string {
    return name.toLowerCase().replace(/[^a-z]/g, '');
  }
}

export const rosterDataLoader = RosterDataLoader.getInstance();