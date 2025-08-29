/**
 * Strength of Schedule Data Loader
 * Loads team strength of schedule data for the season
 */

import { logger } from './utils/logger';

export interface TeamSOS {
  team: string;
  seasonGames: number;
  seasonSOS: number;
  playoffGames: number;
  playoffSOS: number;
  allGames: number;
  allSOS: number;
  weeklyOpponents: Map<number, number>; // week -> opponent difficulty
}

export class SOSLoader {
  private static instance: SOSLoader;
  private sosData = new Map<string, TeamSOS>();
  private loaded = false;
  
  private constructor() {}
  
  public static getInstance(): SOSLoader {
    if (!SOSLoader.instance) {
      SOSLoader.instance = new SOSLoader();
    }
    return SOSLoader.instance;
  }
  
  /**
   * Load SOS data from CSV
   */
  public async loadSOSData(): Promise<Map<string, TeamSOS>> {
    if (this.loaded) {
      return this.sosData;
    }
    
    try {
      const basePath = import.meta.env.BASE_URL || '/';
      const response = await fetch(`${basePath}artifacts/clean_data/sos_2025.csv`);
      if (!response.ok) {
        throw new Error(`Failed to load SOS data: ${response.statusText}`);
      }
      
      const text = await response.text();
      const rows = this.parseCSV(text);
      
      // New SOS format doesn't need team code mapping
      rows.forEach(row => {
        // New format: Team, SOS_Rank, SOS_Percentage, SOS_Normalized
        const team = row.Team;
        if (!team) return; // Skip invalid rows
        
        // Use team code directly (no mapping needed for new format)
        const standardCode = team;
        
        const weeklyOpponents = new Map<number, number>();
        // New format doesn't have weekly data, leaving empty
        
        const sosEntry: TeamSOS = {
          team: standardCode,
          seasonGames: 17, // Standard NFL season
          seasonSOS: parseFloat(row['SOS_Normalized']) || 0,
          playoffGames: 0, // Not in new format
          playoffSOS: 0, // Not in new format
          allGames: 17,
          allSOS: parseFloat(row['SOS_Normalized']) || 0,
          weeklyOpponents
        };
        
        // Set for the team code
        this.sosData.set(standardCode, sosEntry);
      });
      
      this.loaded = true;
      logger.info(`Loaded SOS data for ${this.sosData.size} teams`);
      
      return this.sosData;
    } catch (error) {
      logger.error('Failed to load SOS data:', error);
      return new Map();
    }
  }
  
  /**
   * Get SOS for a specific team
   */
  public getTeamSOS(team: string): TeamSOS | undefined {
    return this.sosData.get(team);
  }
  
  /**
   * Get SOS for specific weeks
   */
  public getWeeklySOS(team: string, weeks: number[]): number {
    const teamSOS = this.sosData.get(team);
    if (!teamSOS) return 0;
    
    let totalDifficulty = 0;
    let count = 0;
    
    weeks.forEach(week => {
      const difficulty = teamSOS.weeklyOpponents.get(week);
      if (difficulty !== undefined) {
        totalDifficulty += difficulty;
        count++;
      }
    });
    
    return count > 0 ? totalDifficulty / count : 0;
  }
  
  /**
   * Get playoff SOS (weeks 15-17)
   */
  public getPlayoffSOS(team: string): number {
    const teamSOS = this.sosData.get(team);
    return teamSOS ? teamSOS.playoffSOS : 0;
  }
  
  /**
   * Parse CSV text
   */
  private parseCSV(text: string): any[] {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const rows = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index]?.trim().replace(/"/g, '') || '';
      });
      rows.push(row);
    }
    
    return rows;
  }
  
  /**
   * Parse a single CSV line (handles quoted values)
   */
  private parseCSVLine(line: string): string[] {
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    
    values.push(current);
    return values;
  }
}

export const sosLoader = SOSLoader.getInstance();