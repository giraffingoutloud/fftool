import { 
  WRAdvancedStats, 
  RBAdvancedStats, 
  TEAdvancedStats, 
  QBAdvancedStats,
  PlayerAdvanced 
} from '@/types';
import { normalizeTeamName } from './teamMappings';
import { parseCSVSafe, parseNumber as parseNum, logger } from '@/lib/utils';

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

// Use imported parseNum function, rename to avoid conflict
const parseNumber = parseNum;

// Helper to parse percentage values
function parsePercent(value: any): number | undefined {
  const num = parseNumber(String(value).replace('%', ''));
  if (num === undefined) return undefined;
  // If it's already a decimal (0.xx), return as is
  // If it's a whole number (xx), convert to decimal
  return num > 1 ? num / 100 : num;
}

// Load WR advanced stats
export async function loadWRAdvanced(): Promise<WRAdvancedStats[]> {
  try {
    const response = await fetch('/canonical_data/advanced_data/fantasy_pros_data/FantasyPros_Fantasy_Football_Advanced_Stats_Report_WR.csv');
    const content = await response.text();
    
    const parsed = parseCSVSafe<any>(content, undefined, ['Player']);
    logger.logCSVParse('WR Advanced Stats', parsed.length);
    
    return parsed.map((record: any) => {
      const { name, team } = parsePlayerNameAndTeam(record['Player'] || record['Name'] || '');
      
      return {
        name,
        team: team || '',
        targetShare: parsePercent(record['TGT%'] || record['Target Share'] || record['TGT %']),
        catchRate: parsePercent(record['CATCH%'] || record['Catch Rate'] || record['REC%']),
        yardsAfterCatch: parseNumber(record['YAC'] || record['Yards After Catch']),
        yardsAfterCatchPerRec: parseNumber(record['YAC/R'] || record['YAC/REC']),
        separationYards: parseNumber(record['SEP'] || record['Separation']),
        drops: parseNumber(record['DROPS'] || record['Drops']),
        redZoneTargets: parseNumber(record['RZ TGT'] || record['RZ Targets']),
        airYards: parseNumber(record['AIR YDS'] || record['Air Yards']),
        yardsBeforeContact: parseNumber(record['YBC'] || record['YBC/R']),
        targets: parseNumber(record['TGT'] || record['Targets']),
        receptions: parseNumber(record['REC'] || record['Receptions'])
      };
    });
  } catch (error) {
    console.warn('Failed to load WR advanced stats:', error);
    return [];
  }
}

// Load TE advanced stats
export async function loadTEAdvanced(): Promise<TEAdvancedStats[]> {
  try {
    const response = await fetch('/canonical_data/advanced_data/fantasy_pros_data/FantasyPros_Fantasy_Football_Advanced_Stats_Report_TE.csv');
    const content = await response.text();
    
    const parsed = parseCSVSafe<any>(content, undefined, ['Player']);
    logger.logCSVParse('WR Advanced Stats', parsed.length);
    
    return parsed.map((record: any) => {
      const { name, team } = parsePlayerNameAndTeam(record['Player'] || record['Name'] || '');
      
      return {
        name,
        team: team || '',
        targetShare: parsePercent(record['TGT%'] || record['Target Share'] || record['TGT %']),
        catchRate: parsePercent(record['CATCH%'] || record['Catch Rate'] || record['REC%']),
        yardsAfterCatch: parseNumber(record['YAC'] || record['Yards After Catch']),
        yardsAfterCatchPerRec: parseNumber(record['YAC/R'] || record['YAC/REC']),
        separationYards: parseNumber(record['SEP'] || record['Separation']),
        drops: parseNumber(record['DROPS'] || record['Drops']),
        redZoneTargets: parseNumber(record['RZ TGT'] || record['RZ Targets']),
        airYards: parseNumber(record['AIR YDS'] || record['Air Yards']),
        yardsBeforeContact: parseNumber(record['YBC'] || record['YBC/R']),
        targets: parseNumber(record['TGT'] || record['Targets']),
        receptions: parseNumber(record['REC'] || record['Receptions'])
      };
    });
  } catch (error) {
    console.warn('Failed to load TE advanced stats:', error);
    return [];
  }
}

// Load RB advanced stats
export async function loadRBAdvanced(): Promise<RBAdvancedStats[]> {
  try {
    const response = await fetch('/canonical_data/advanced_data/fantasy_pros_data/FantasyPros_Fantasy_Football_Advanced_Stats_Report_RB.csv');
    const content = await response.text();
    
    const parsed = parseCSVSafe<any>(content, undefined, ['Player']);
    logger.logCSVParse('WR Advanced Stats', parsed.length);
    
    return parsed.map((record: any) => {
      const { name, team } = parsePlayerNameAndTeam(record['Player'] || record['Name'] || '');
      
      // Calculate touches per game if we have attempts and games
      const attempts = parseNumber(record['ATT'] || record['Attempts']);
      const receptions = parseNumber(record['REC'] || record['Receptions']);
      const games = parseNumber(record['G'] || record['Games']);
      let touchesPerGame: number | undefined;
      
      if (attempts !== undefined && receptions !== undefined && games && games > 0) {
        touchesPerGame = (attempts + receptions) / games;
      }
      
      return {
        name,
        team: team || '',
        yardsPerCarry: parseNumber(record['YPC'] || record['Y/A'] || record['YDS/ATT']),
        yardsBeforeContact: parseNumber(record['YBC/ATT'] || record['YBC/A'] || record['YBC']),
        yardsAfterContact: parseNumber(record['YAC/ATT'] || record['YAC/A'] || record['YAC']),
        brokenTackles: parseNumber(record['BTK'] || record['Broken Tackles']),
        touchesPerGame,
        targetShare: parsePercent(record['TGT%'] || record['Target Share']),
        rushingAttempts: attempts,
        targets: parseNumber(record['TGT'] || record['Targets']),
        receptions,
        redZoneCarries: parseNumber(record['RZ ATT'] || record['RZ Carries'])
      };
    });
  } catch (error) {
    console.warn('Failed to load RB advanced stats:', error);
    return [];
  }
}

// Load QB advanced stats
export async function loadQBAdvanced(): Promise<QBAdvancedStats[]> {
  try {
    const response = await fetch('/canonical_data/advanced_data/fantasy_pros_data/FantasyPros_Fantasy_Football_Advanced_Stats_Report_QB.csv');
    const content = await response.text();
    
    const parsed = parseCSVSafe<any>(content, undefined, ['Player']);
    logger.logCSVParse('WR Advanced Stats', parsed.length);
    
    return parsed.map((record: any) => {
      const { name, team } = parsePlayerNameAndTeam(record['Player'] || record['Name'] || '');
      
      // Calculate TD rate if we have TDs and attempts
      const tds = parseNumber(record['TD'] || record['TDs']);
      const attempts = parseNumber(record['ATT'] || record['Attempts']);
      let tdRate: number | undefined;
      
      if (tds !== undefined && attempts && attempts > 0) {
        tdRate = tds / attempts;
      } else {
        tdRate = parsePercent(record['TD%'] || record['TD Rate']);
      }
      
      return {
        name,
        team: team || '',
        tdRate,
        yardsPerAttempt: parseNumber(record['Y/A'] || record['YDS/ATT']),
        airYardsPerAttempt: parseNumber(record['AIR/A'] || record['AY/A']),
        completionPct: parsePercent(record['COMP%'] || record['Completion %']),
        pressureRate: parsePercent(record['PRES%'] || record['Pressure Rate']),
        knockdownRate: parsePercent(record['KD%'] || record['Knockdown Rate']),
        hurryRate: parsePercent(record['HURRY%'] || record['Hurry Rate']),
        pocketTime: parseNumber(record['PKT TIME'] || record['Pocket Time']),
        blitzesVs: parseNumber(record['BLTZ'] || record['Blitzes'])
      };
    });
  } catch (error) {
    console.warn('Failed to load QB advanced stats:', error);
    return [];
  }
}

// Load all advanced stats
export async function loadAllPlayerAdvanced(): Promise<Map<string, PlayerAdvanced>> {
  const [wrStats, teStats, rbStats, qbStats] = await Promise.all([
    loadWRAdvanced(),
    loadTEAdvanced(),
    loadRBAdvanced(),
    loadQBAdvanced()
  ]);
  
  const result = new Map<string, PlayerAdvanced>();
  
  // Normalize player names and create map
  const normalizeKey = (name: string, position: string): string => {
    return `${name.toLowerCase().trim()}_${position}`;
  };
  
  for (const stat of wrStats) {
    result.set(normalizeKey(stat.name, 'WR'), stat);
  }
  
  for (const stat of teStats) {
    result.set(normalizeKey(stat.name, 'TE'), stat);
  }
  
  for (const stat of rbStats) {
    result.set(normalizeKey(stat.name, 'RB'), stat);
  }
  
  for (const stat of qbStats) {
    result.set(normalizeKey(stat.name, 'QB'), stat);
  }
  
  return result;
}