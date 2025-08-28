import type { PlayerSeasonStats, Position } from '@/types';
import { normalizeTeamName } from './teamMappings';
import { parseCSVSafe, parseNumber, logger } from '@/lib/utils';

// Helper to parse player name and team from "Name (TEAM)" format
function parsePlayerNameAndTeam(nameWithTeam: string): { name: string; team: string | null } {
  const match = nameWithTeam.match(/^(.+?)\s+\(([A-Z]{2,3}|FA)\)$/);
  if (match) {
    const name = match[1].trim();
    const teamRaw = match[2];
    const team = teamRaw === 'FA' ? null : normalizeTeamName(teamRaw);
    return { name, team };
  }
  // Fallback if pattern doesn't match
  return { name: nameWithTeam.trim(), team: null };
}

// parseNumber is now imported from utils

// Load WR season stats
export async function loadWRStats(): Promise<PlayerSeasonStats[]> {
  try {
    const response = await fetch('/canonical_data/advanced_data/fantasy_pros_data/FantasyPros_Fantasy_Football_Statistics_WR.csv');
    const content = await response.text();
    
    const parsed = parseCSVSafe<any>(content, undefined, ['Player']);
    logger.logCSVParse('WR Stats', parsed.length);
    
    return parsed.map((record: any) => {
      const { name, team } = parsePlayerNameAndTeam(record['Player'] || record['Name'] || '');
      
      return {
        name,
        team: team || '',
        position: 'WR' as Position,
        games: parseNumber(record['G'] || record['Games']),
        fantasyPoints: parseNumber(record['FPTS'] || record['Fantasy Points']),
        fantasyPointsPerGame: parseNumber(record['FPTS/G'] || record['PPG']),
        rushingYards: parseNumber(record['RUSH YDS'] || record['Rushing Yards']),
        rushingTDs: parseNumber(record['RUSH TD'] || record['Rushing TDs']),
        rushingAttempts: parseNumber(record['RUSH ATT'] || record['Rush Attempts']),
        receptions: parseNumber(record['REC'] || record['Receptions']),
        targets: parseNumber(record['TGT'] || record['Targets']),
        receivingYards: parseNumber(record['REC YDS'] || record['Receiving Yards']),
        receivingTDs: parseNumber(record['REC TD'] || record['Receiving TDs'])
      };
    });
  } catch (error) {
    console.warn('Failed to load WR stats:', error);
    return [];
  }
}

// Load RB season stats
export async function loadRBStats(): Promise<PlayerSeasonStats[]> {
  try {
    const response = await fetch('/canonical_data/advanced_data/fantasy_pros_data/FantasyPros_Fantasy_Football_Statistics_RB.csv');
    const content = await response.text();
    
    const parsed = parseCSVSafe<any>(content, undefined, ['Player']);
    logger.logCSVParse('WR Stats', parsed.length);
    
    return parsed.map((record: any) => {
      const { name, team } = parsePlayerNameAndTeam(record['Player'] || record['Name'] || '');
      
      return {
        name,
        team: team || '',
        position: 'RB' as Position,
        games: parseNumber(record['G'] || record['Games']),
        fantasyPoints: parseNumber(record['FPTS'] || record['Fantasy Points']),
        fantasyPointsPerGame: parseNumber(record['FPTS/G'] || record['PPG']),
        rushingYards: parseNumber(record['RUSH YDS'] || record['Rushing Yards']),
        rushingTDs: parseNumber(record['RUSH TD'] || record['Rushing TDs']),
        rushingAttempts: parseNumber(record['RUSH ATT'] || record['Rush Attempts']),
        receptions: parseNumber(record['REC'] || record['Receptions']),
        targets: parseNumber(record['TGT'] || record['Targets']),
        receivingYards: parseNumber(record['REC YDS'] || record['Receiving Yards']),
        receivingTDs: parseNumber(record['REC TD'] || record['Receiving TDs'])
      };
    });
  } catch (error) {
    console.warn('Failed to load RB stats:', error);
    return [];
  }
}

// Load TE season stats
export async function loadTEStats(): Promise<PlayerSeasonStats[]> {
  try {
    const response = await fetch('/canonical_data/advanced_data/fantasy_pros_data/FantasyPros_Fantasy_Football_Statistics_TE.csv');
    const content = await response.text();
    
    const parsed = parseCSVSafe<any>(content, undefined, ['Player']);
    logger.logCSVParse('WR Stats', parsed.length);
    
    return parsed.map((record: any) => {
      const { name, team } = parsePlayerNameAndTeam(record['Player'] || record['Name'] || '');
      
      return {
        name,
        team: team || '',
        position: 'TE' as Position,
        games: parseNumber(record['G'] || record['Games']),
        fantasyPoints: parseNumber(record['FPTS'] || record['Fantasy Points']),
        fantasyPointsPerGame: parseNumber(record['FPTS/G'] || record['PPG']),
        receptions: parseNumber(record['REC'] || record['Receptions']),
        targets: parseNumber(record['TGT'] || record['Targets']),
        receivingYards: parseNumber(record['REC YDS'] || record['Receiving Yards']),
        receivingTDs: parseNumber(record['REC TD'] || record['Receiving TDs'])
      };
    });
  } catch (error) {
    console.warn('Failed to load TE stats:', error);
    return [];
  }
}

// Load QB season stats
export async function loadQBStats(): Promise<PlayerSeasonStats[]> {
  try {
    const response = await fetch('/canonical_data/advanced_data/fantasy_pros_data/FantasyPros_Fantasy_Football_Statistics_QB.csv');
    const content = await response.text();
    
    const parsed = parseCSVSafe<any>(content, undefined, ['Player']);
    logger.logCSVParse('WR Stats', parsed.length);
    
    return parsed.map((record: any) => {
      const { name, team } = parsePlayerNameAndTeam(record['Player'] || record['Name'] || '');
      
      return {
        name,
        team: team || '',
        position: 'QB' as Position,
        games: parseNumber(record['G'] || record['Games']),
        fantasyPoints: parseNumber(record['FPTS'] || record['Fantasy Points']),
        fantasyPointsPerGame: parseNumber(record['FPTS/G'] || record['PPG']),
        passingYards: parseNumber(record['PASS YDS'] || record['Passing Yards']),
        passingTDs: parseNumber(record['PASS TD'] || record['Passing TDs']),
        interceptions: parseNumber(record['INT'] || record['Interceptions']),
        rushingYards: parseNumber(record['RUSH YDS'] || record['Rushing Yards']),
        rushingTDs: parseNumber(record['RUSH TD'] || record['Rushing TDs']),
        rushingAttempts: parseNumber(record['RUSH ATT'] || record['Rush Attempts'])
      };
    });
  } catch (error) {
    console.warn('Failed to load QB stats:', error);
    return [];
  }
}

// Compute derived fields
function computeDerivedFields(stats: PlayerSeasonStats[]): ExtendedPlayerSeasonStats[] {
  return stats.map(player => {
    const enhanced: ExtendedPlayerSeasonStats = { ...player };
    
    // Compute touches per game for RBs
    if (player.position === 'RB' && player.games && player.games > 0) {
      const totalTouches = (player.rushingAttempts || 0) + (player.receptions || 0);
      enhanced.touchesPerGame = totalTouches / player.games;
    }
    
    // Compute targets per game for WRs and TEs
    if ((player.position === 'WR' || player.position === 'TE') && player.games && player.games > 0) {
      enhanced.targetsPerGame = (player.targets || 0) / player.games;
    }
    
    // Use FPTS as baseline if no projections
    if (!enhanced.fantasyPoints && enhanced.fantasyPointsPerGame && enhanced.games) {
      enhanced.fantasyPoints = enhanced.fantasyPointsPerGame * enhanced.games;
    }
    
    return enhanced;
  });
}

// Main export to load all player stats
export async function loadAllPlayerStats(): Promise<Map<string, PlayerSeasonStats>> {
  const [wrStats, rbStats, teStats, qbStats] = await Promise.all([
    loadWRStats(),
    loadRBStats(),
    loadTEStats(),
    loadQBStats()
  ]);
  
  // Combine all stats
  const allStats = [
    ...computeDerivedFields(wrStats),
    ...computeDerivedFields(rbStats),
    ...computeDerivedFields(teStats),
    ...computeDerivedFields(qbStats)
  ];
  
  // Create map with normalized names as keys
  const result = new Map<string, PlayerSeasonStats>();
  
  for (const stat of allStats) {
    const key = `${stat.name.toLowerCase().trim()}_${stat.position}`;
    result.set(key, stat);
  }
  
  return result;
}

// Extended stats interface for additional calculations
interface ExtendedPlayerSeasonStats extends PlayerSeasonStats {
  touchesPerGame?: number;
  targetsPerGame?: number;
}