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
    const basePath = import.meta.env?.BASE_URL || '/fftool/';
    const url = `${basePath}artifacts/clean_data/FantasyPros_Fantasy_Football_Advanced_Stats_Report_WR.csv`;
    console.log('[loadWRAdvanced] Fetching from:', url);
    const response = await fetch(url);
    
    if (!response.ok) {
      console.warn('Failed to fetch WR advanced stats:', response.status);
      return [];
    }
    
    const content = await response.text();
    
    const parsed = parseCSVSafe<any>(content, undefined, ['Player']);
    logger.logCSVParse('WR Advanced Stats', parsed.length);
    
    return parsed.map((record: any) => {
      const { name, team } = parsePlayerNameAndTeam(record['Player'] || record['Name'] || '');
      
      // Calculate catch rate from REC / CATCHABLE
      const receptions = parseNumber(record['REC']);
      const catchable = parseNumber(record['CATCHABLE']);
      const catchRate = (receptions && catchable && catchable > 0) ? 
        receptions / catchable : undefined;
      
      // Calculate YPRR if we have yards and routes info
      const yards = parseNumber(record['YDS']);
      const yardsPerRec = parseNumber(record['Y/R']);
      
      return {
        name,
        team: team || '',
        targetShare: parsePercent(record['% TM'] || record['TGT%']),
        catchRate: catchRate,
        yardsAfterCatch: parseNumber(record['YAC']),
        yardsAfterCatchPerRec: parseNumber(record['YAC/R']),
        separationYards: parseNumber(record['SEP']),
        drops: parseNumber(record['DROP']),
        redZoneTargets: parseNumber(record['RZ TGT']),
        airYards: parseNumber(record['AIR']),
        yardsBeforeContact: parseNumber(record['YBC']),
        targets: parseNumber(record['TGT']),
        receptions: receptions,
        receivingYards: yards,
        yardsPerRouteRun: yardsPerRec // Using Y/R as proxy for now
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
    const basePath = import.meta.env?.BASE_URL || '/fftool/';
    const url = `${basePath}artifacts/clean_data/FantasyPros_Fantasy_Football_Advanced_Stats_Report_TE.csv`;
    console.log('[loadTEAdvanced] Fetching from:', url);
    const response = await fetch(url);
    
    if (!response.ok) {
      console.warn('Failed to fetch TE advanced stats:', response.status);
      return [];
    }
    
    const content = await response.text();
    
    const parsed = parseCSVSafe<any>(content, undefined, ['Player']);
    logger.logCSVParse('TE Advanced Stats', parsed.length);
    
    return parsed.map((record: any) => {
      const { name, team } = parsePlayerNameAndTeam(record['Player'] || record['Name'] || '');
      
      // Calculate catch rate from REC / CATCHABLE
      const receptions = parseNumber(record['REC']);
      const catchable = parseNumber(record['CATCHABLE']);
      const catchRate = (receptions && catchable && catchable > 0) ? 
        receptions / catchable : undefined;
      
      // Get yards data
      const yards = parseNumber(record['YDS']);
      const yardsPerRec = parseNumber(record['Y/R']);
      
      return {
        name,
        team: team || '',
        targetShare: parsePercent(record['% TM'] || record['TGT%']),
        catchRate: catchRate,
        yardsAfterCatch: parseNumber(record['YAC']),
        yardsAfterCatchPerRec: parseNumber(record['YAC/R']),
        separationYards: parseNumber(record['SEP']),
        drops: parseNumber(record['DROP']),
        redZoneTargets: parseNumber(record['RZ TGT']),
        airYards: parseNumber(record['AIR']),
        yardsBeforeContact: parseNumber(record['YBC']),
        targets: parseNumber(record['TGT']),
        receptions: receptions,
        receivingYards: yards,
        yardsPerRouteRun: yardsPerRec // Using Y/R as proxy for now
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
    const basePath = import.meta.env?.BASE_URL || '/fftool/';
    const url = `${basePath}artifacts/clean_data/FantasyPros_Fantasy_Football_Advanced_Stats_Report_RB.csv`;
    console.log('[loadRBAdvanced] Fetching from:', url);
    const response = await fetch(url);
    
    if (!response.ok) {
      console.warn('Failed to fetch RB advanced stats:', response.status);
      return [];
    }
    
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
    const basePath = import.meta.env?.BASE_URL || '/fftool/';
    const url = `${basePath}artifacts/clean_data/FantasyPros_Fantasy_Football_Advanced_Stats_Report_QB.csv`;
    console.log('[loadQBAdvanced] Fetching from:', url);
    const response = await fetch(url);
    
    if (!response.ok) {
      console.warn('Failed to fetch QB advanced stats:', response.status);
      return [];
    }
    
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
  console.log('[PlayerAdvancedLoader] Starting to load all advanced stats...');
  
  try {
    const [wrStats, teStats, rbStats, qbStats] = await Promise.all([
      loadWRAdvanced(),
      loadTEAdvanced(),
      loadRBAdvanced(),
      loadQBAdvanced()
    ]);
    
    console.log('[PlayerAdvancedLoader] Loaded stats:', {
      wrCount: wrStats.length,
      teCount: teStats.length,
      rbCount: rbStats.length,
      qbCount: qbStats.length
    });
    
    const result = new Map<string, PlayerAdvanced>();
    
    // Normalize player names and create map
    const normalizeKey = (name: string, position: string): string => {
      return `${name.toLowerCase().trim()}_${position.toLowerCase()}`;
    };
    
    console.log('[PlayerAdvancedLoader] Creating player advanced map...');
  
  for (const stat of wrStats) {
    const key = normalizeKey(stat.name, 'WR');
    result.set(key, stat);
    if (stat.name.includes('Chase') || stat.name.includes('Lamb')) {
      console.log(`[PlayerAdvancedLoader] Added WR: ${stat.name} with key: ${key}`);
    }
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
  
    console.log('[PlayerAdvancedLoader] Final map size:', result.size);
    console.log('[PlayerAdvancedLoader] Sample keys:', Array.from(result.keys()).slice(0, 10));
    
    return result;
  } catch (error) {
    console.error('[PlayerAdvancedLoader] Error loading advanced stats:', error);
    return new Map();
  }
}