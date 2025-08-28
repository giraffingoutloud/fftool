import { TeamMetrics, TeamComposite } from '@/types';
import { normalizeTeamName } from './teamMappings';
import { 
  parseNumber as parseNum, 
  parseTabDelimited, 
  detectDelimiter,
  removeBOM,
  logger 
} from '@/lib/utils';

// Helper functions for parsing
function parseNumber(value: string | undefined): number | null {
  const num = parseNum(value);
  return num !== undefined ? num : null;
}

function parsePercent(value: string | undefined): number | null {
  const num = parseNum(String(value).replace('%', ''));
  if (num === undefined) return null;
  return num > 1 ? num / 100 : num; // Convert percentage to decimal
}

// Parse a team metrics file with standard format
function parseTeamMetricsFile(content: string): Map<string, any> {
  const result = new Map<string, any>();
  
  // Remove BOM and detect delimiter
  const cleanContent = removeBOM(content);
  const delimiter = detectDelimiter(cleanContent);
  
  const lines = cleanContent.trim().split('\n');
  if (lines.length < 2) {
    logger.warn('Team metrics file has insufficient data');
    return result;
  }
  
  // Parse header
  const headers = lines[0].split(delimiter).map(h => h.trim());
  
  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(delimiter).map(v => v.trim());
    if (values.length < 2) continue;
    
    const teamName = values[1]; // Team is usually second column after Rank
    const teamAbbr = normalizeTeamName(teamName);
    
    if (!teamAbbr) {
      logger.warn(`Could not map team name: ${teamName}`);
      continue;
    }
    
    const teamData: any = {};
    
    for (let j = 2; j < headers.length && j < values.length; j++) {
      const header = headers[j];
      const value = values[j];
      
      // Check if it's a percentage field
      if (value && value.includes('%')) {
        teamData[header] = parsePercent(value);
      } else {
        teamData[header] = parseNumber(value);
      }
    }
    
    result.set(teamAbbr, teamData);
  }
  
  logger.info(`Parsed ${result.size} teams from metrics file`);
  return result;
}

// Load specific team metric files
async function loadTeamPointsPerPlay(): Promise<Map<string, any>> {
  try {
    const response = await fetch('/canonical_data/team_points_per_play.txt');
    const content = await response.text();
    return parseTeamMetricsFile(content);
  } catch (error) {
    console.warn('Failed to load team_points_per_play.txt:', error);
    return new Map();
  }
}

async function loadTeamPointsPerGame(): Promise<Map<string, any>> {
  try {
    const response = await fetch('/canonical_data/team_points_per_game.txt');
    const content = await response.text();
    return parseTeamMetricsFile(content);
  } catch (error) {
    console.warn('Failed to load team_points_per_game.txt:', error);
    return new Map();
  }
}

async function loadTeamPlaysPerGame(): Promise<Map<string, any>> {
  try {
    const response = await fetch('/canonical_data/team_plays_per_game.txt');
    const content = await response.text();
    return parseTeamMetricsFile(content);
  } catch (error) {
    console.warn('Failed to load team_plays_per_game.txt:', error);
    return new Map();
  }
}

async function loadTeamOffensiveTDs(): Promise<Map<string, any>> {
  try {
    const response = await fetch('/canonical_data/team_offensive_tds_per_game.txt');
    const content = await response.text();
    return parseTeamMetricsFile(content);
  } catch (error) {
    console.warn('Failed to load team_offensive_tds_per_game.txt:', error);
    return new Map();
  }
}

async function loadTeamYardsPerPlay(): Promise<Map<string, any>> {
  try {
    const response = await fetch('/canonical_data/team_yards_per_play.txt');
    const content = await response.text();
    return parseTeamMetricsFile(content);
  } catch (error) {
    console.warn('Failed to load team_yards_per_play.txt:', error);
    return new Map();
  }
}

async function loadTeamSecondsPerPlay(): Promise<Map<string, any>> {
  try {
    const response = await fetch('/canonical_data/team_seconds_per_play.txt');
    const content = await response.text();
    return parseTeamMetricsFile(content);
  } catch (error) {
    console.warn('Failed to load team_seconds_per_play.txt:', error);
    return new Map();
  }
}

async function loadTeamTimeOfPossession(): Promise<Map<string, any>> {
  try {
    const response = await fetch('/canonical_data/team_time_of_possession_percentage.txt');
    const content = await response.text();
    return parseTeamMetricsFile(content);
  } catch (error) {
    console.warn('Failed to load team_time_of_possession_percentage.txt:', error);
    return new Map();
  }
}

async function loadTeamThirdDown(): Promise<Map<string, any>> {
  try {
    const response = await fetch('/canonical_data/team_third_down_conversion_percentage.txt');
    const content = await response.text();
    return parseTeamMetricsFile(content);
  } catch (error) {
    console.warn('Failed to load team_third_down_conversion_percentage.txt:', error);
    return new Map();
  }
}

async function loadTeamFourthDown(): Promise<Map<string, any>> {
  try {
    const response = await fetch('/canonical_data/team_fourth_down_conversion_percentage.txt');
    const content = await response.text();
    return parseTeamMetricsFile(content);
  } catch (error) {
    console.warn('Failed to load team_fourth_down_conversion_percentage.txt:', error);
    return new Map();
  }
}

async function loadTeamFirstDowns(): Promise<Map<string, any>> {
  try {
    const response = await fetch('/canonical_data/team_first_downs_per_game.txt');
    const content = await response.text();
    return parseTeamMetricsFile(content);
  } catch (error) {
    console.warn('Failed to load team_first_downs_per_game.txt:', error);
    return new Map();
  }
}

async function loadTeamScoringMargin(): Promise<Map<string, any>> {
  try {
    const response = await fetch('/canonical_data/team_average_scoring_margin.txt');
    const content = await response.text();
    return parseTeamMetricsFile(content);
  } catch (error) {
    console.warn('Failed to load team_average_scoring_margin.txt:', error);
    return new Map();
  }
}

async function loadTeamRedZoneTDs(): Promise<Map<string, any>> {
  try {
    const response = await fetch('/canonical_data/team_red_zone_tds_per_game.txt');
    const content = await response.text();
    return parseTeamMetricsFile(content);
  } catch (error) {
    console.warn('Failed to load team_red_zone_tds_per_game.txt:', error);
    return new Map();
  }
}

async function loadTeamRedZoneScoringPct(): Promise<Map<string, any>> {
  try {
    const response = await fetch('/canonical_data/team_red_zone_td_scoring_percentage.txt');
    const content = await response.text();
    return parseTeamMetricsFile(content);
  } catch (error) {
    console.warn('Failed to load team_red_zone_td_scoring_percentage.txt:', error);
    return new Map();
  }
}

async function loadTeamRedZoneAttempts(): Promise<Map<string, any>> {
  try {
    const response = await fetch('/canonical_data/team_red_zone_scoring_attempts_per_game.txt');
    const content = await response.text();
    return parseTeamMetricsFile(content);
  } catch (error) {
    console.warn('Failed to load team_red_zone_scoring_attempts_per_game.txt:', error);
    return new Map();
  }
}

async function loadTeamPointsPerPlayMargin(): Promise<Map<string, any>> {
  try {
    const response = await fetch('/canonical_data/team_points_per_play_margin.txt');
    const content = await response.text();
    return parseTeamMetricsFile(content);
  } catch (error) {
    console.warn('Failed to load team_points_per_play_margin.txt:', error);
    return new Map();
  }
}

async function loadTeamTouchdowns(): Promise<Map<string, any>> {
  try {
    const response = await fetch('/canonical_data/team_touchdowns_per_game.txt');
    const content = await response.text();
    return parseTeamMetricsFile(content);
  } catch (error) {
    console.warn('Failed to load team_touchdowns_per_game.txt:', error);
    return new Map();
  }
}

// Merge all team metrics into unified records
function mergeTeamMetrics(
  allMetrics: Map<string, any>[]
): Map<string, TeamMetrics> {
  const result = new Map<string, TeamMetrics>();
  const teamSet = new Set<string>();
  
  // Collect all teams
  for (const metrics of allMetrics) {
    for (const team of metrics.keys()) {
      teamSet.add(team);
    }
  }
  
  // Build merged metrics for each team
  for (const team of teamSet) {
    const teamMetrics: TeamMetrics = { team };
    
    // Get each metric type
    const [
      ppp, ppg, playsPerGame, offTDs, ypp, secondsPerPlay,
      timeOfPoss, thirdDown, fourthDown, firstDowns,
      scoringMargin, rzTDs, rzScoringPct, rzAttempts,
      pppMargin, touchdowns
    ] = allMetrics;
    
    // Points per play
    const pppData = ppp.get(team);
    if (pppData) {
      teamMetrics.pointsPerPlay = pppData['2024'];
      if (pppData['Last 3']) {
        teamMetrics.last3 = teamMetrics.last3 || {};
        teamMetrics.last3.pointsPerPlay = pppData['Last 3'];
      }
      if (pppData['Last 1']) {
        teamMetrics.last1 = teamMetrics.last1 || {};
        teamMetrics.last1.pointsPerPlay = pppData['Last 1'];
      }
      if (pppData['Home']) {
        teamMetrics.home = teamMetrics.home || {};
        teamMetrics.home.pointsPerPlay = pppData['Home'];
      }
      if (pppData['Away']) {
        teamMetrics.away = teamMetrics.away || {};
        teamMetrics.away.pointsPerPlay = pppData['Away'];
      }
    }
    
    // Points per game
    const ppgData = ppg.get(team);
    if (ppgData) {
      teamMetrics.pointsPerGame = ppgData['2024'];
      if (ppgData['Last 3']) {
        teamMetrics.last3 = teamMetrics.last3 || {};
        teamMetrics.last3.pointsPerGame = ppgData['Last 3'];
      }
      if (ppgData['Last 1']) {
        teamMetrics.last1 = teamMetrics.last1 || {};
        teamMetrics.last1.pointsPerGame = ppgData['Last 1'];
      }
      if (ppgData['Home']) {
        teamMetrics.home = teamMetrics.home || {};
        teamMetrics.home.pointsPerGame = ppgData['Home'];
      }
      if (ppgData['Away']) {
        teamMetrics.away = teamMetrics.away || {};
        teamMetrics.away.pointsPerGame = ppgData['Away'];
      }
    }
    
    // Other metrics
    const playsData = playsPerGame.get(team);
    if (playsData) teamMetrics.playsPerGame = playsData['2024'];
    
    const offTDData = offTDs.get(team);
    if (offTDData) teamMetrics.offensiveTDsPerGame = offTDData['2024'];
    
    const yppData = ypp.get(team);
    if (yppData) {
      teamMetrics.yardsPerPlay = yppData['2024'];
      if (yppData['Last 3']) {
        teamMetrics.last3 = teamMetrics.last3 || {};
        teamMetrics.last3.yardsPerPlay = yppData['Last 3'];
      }
      if (yppData['Home']) {
        teamMetrics.home = teamMetrics.home || {};
        teamMetrics.home.yardsPerPlay = yppData['Home'];
      }
      if (yppData['Away']) {
        teamMetrics.away = teamMetrics.away || {};
        teamMetrics.away.yardsPerPlay = yppData['Away'];
      }
    }
    
    const secPerPlay = secondsPerPlay.get(team);
    if (secPerPlay) teamMetrics.secondsPerPlay = secPerPlay['2024'];
    
    const topData = timeOfPoss.get(team);
    if (topData) teamMetrics.timeOfPossessionPct = topData['2024'];
    
    const third = thirdDown.get(team);
    if (third) teamMetrics.thirdDownConvPct = third['2024'];
    
    const fourth = fourthDown.get(team);
    if (fourth) teamMetrics.fourthDownConvPct = fourth['2024'];
    
    const firstData = firstDowns.get(team);
    if (firstData) teamMetrics.firstDownsPerGame = firstData['2024'];
    
    const marginData = scoringMargin.get(team);
    if (marginData) teamMetrics.scoringMargin = marginData['2024'];
    
    const rzTDData = rzTDs.get(team);
    if (rzTDData) teamMetrics.redZoneTDsPerGame = rzTDData['2024'];
    
    const rzPctData = rzScoringPct.get(team);
    if (rzPctData) teamMetrics.redZoneTDScoringPct = rzPctData['2024'];
    
    const rzAttData = rzAttempts.get(team);
    if (rzAttData) teamMetrics.redZoneAttemptsPerGame = rzAttData['2024'];
    
    const pppMarginData = pppMargin.get(team);
    if (pppMarginData) teamMetrics.pointsPerPlayMargin = pppMarginData['2024'];
    
    const tdData = touchdowns.get(team);
    if (tdData) teamMetrics.touchdownsPerGame = tdData['2024'];
    
    result.set(team, teamMetrics);
  }
  
  return result;
}

// Compute z-scores for normalization
function computeZScore(value: number | null | undefined, values: number[]): number {
  if (value === null || value === undefined) return 0;
  
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const stdDev = Math.sqrt(
    values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
  );
  
  if (stdDev === 0) return 0;
  return (value - mean) / stdDev;
}

// Compute composite indices
export function computeTeamComposite(metrics: Map<string, TeamMetrics>): Map<string, TeamComposite> {
  const result = new Map<string, TeamComposite>();
  
  // Collect all values for z-score calculation
  const ppgValues: number[] = [];
  const yppValues: number[] = [];
  const pppValues: number[] = [];
  const tdValues: number[] = [];
  const thirdValues: number[] = [];
  const rzPctValues: number[] = [];
  const secPerPlayValues: number[] = [];
  const playsValues: number[] = [];
  const rzAttValues: number[] = [];
  const firstDownValues: number[] = [];
  const marginValues: number[] = [];
  const pppMarginValues: number[] = [];
  
  for (const tm of metrics.values()) {
    if (tm.pointsPerGame !== null && tm.pointsPerGame !== undefined) ppgValues.push(tm.pointsPerGame);
    if (tm.yardsPerPlay !== null && tm.yardsPerPlay !== undefined) yppValues.push(tm.yardsPerPlay);
    if (tm.pointsPerPlay !== null && tm.pointsPerPlay !== undefined) pppValues.push(tm.pointsPerPlay);
    if (tm.touchdownsPerGame !== null && tm.touchdownsPerGame !== undefined) tdValues.push(tm.touchdownsPerGame);
    if (tm.thirdDownConvPct !== null && tm.thirdDownConvPct !== undefined) thirdValues.push(tm.thirdDownConvPct);
    if (tm.redZoneTDScoringPct !== null && tm.redZoneTDScoringPct !== undefined) rzPctValues.push(tm.redZoneTDScoringPct);
    if (tm.secondsPerPlay !== null && tm.secondsPerPlay !== undefined) secPerPlayValues.push(tm.secondsPerPlay);
    if (tm.playsPerGame !== null && tm.playsPerGame !== undefined) playsValues.push(tm.playsPerGame);
    if (tm.redZoneAttemptsPerGame !== null && tm.redZoneAttemptsPerGame !== undefined) rzAttValues.push(tm.redZoneAttemptsPerGame);
    if (tm.firstDownsPerGame !== null && tm.firstDownsPerGame !== undefined) firstDownValues.push(tm.firstDownsPerGame);
    if (tm.scoringMargin !== null && tm.scoringMargin !== undefined) marginValues.push(tm.scoringMargin);
    if (tm.pointsPerPlayMargin !== null && tm.pointsPerPlayMargin !== undefined) pppMarginValues.push(tm.pointsPerPlayMargin);
  }
  
  // Compute composites for each team
  for (const [team, tm] of metrics.entries()) {
    // Offense Quality Index: blend of ppg, ypp, ppp, td, third down, rz efficiency
    const ppgZ = computeZScore(tm.pointsPerGame, ppgValues);
    const yppZ = computeZScore(tm.yardsPerPlay, yppValues);
    const pppZ = computeZScore(tm.pointsPerPlay, pppValues);
    const tdZ = computeZScore(tm.touchdownsPerGame, tdValues);
    const thirdZ = computeZScore(tm.thirdDownConvPct, thirdValues);
    const rzPctZ = computeZScore(tm.redZoneTDScoringPct, rzPctValues);
    
    const offenseQualityIndex = (ppgZ + yppZ + pppZ + tdZ + thirdZ + rzPctZ) / 6;
    
    // Pace Index: inverse seconds per play + plays per game
    const secZ = tm.secondsPerPlay ? -computeZScore(tm.secondsPerPlay, secPerPlayValues) : 0; // Negative because lower is faster
    const playsZ = computeZScore(tm.playsPerGame, playsValues);
    const paceIndex = (secZ + playsZ) / 2;
    
    // Red Zone Index: attempts and efficiency
    const rzAttZ = computeZScore(tm.redZoneAttemptsPerGame, rzAttValues);
    const redZoneIndex = (rzAttZ + rzPctZ) / 2;
    
    // Sustain Index: first downs and third down conversion
    const firstZ = computeZScore(tm.firstDownsPerGame, firstDownValues);
    const sustainIndex = (firstZ + thirdZ) / 2;
    
    // Environment Index: scoring margin and points per play margin
    const marginZ = computeZScore(tm.scoringMargin, marginValues);
    const pppMarginZ = computeZScore(tm.pointsPerPlayMargin, pppMarginValues);
    const environmentIndex = (marginZ + pppMarginZ) / 2;
    
    // Trend Index: weighted average of recent vs season
    let trendIndex = 0;
    if (tm.last3 && tm.pointsPerGame) {
      const last3Avg = (
        (tm.last3.pointsPerGame || tm.pointsPerGame) +
        (tm.last3.yardsPerPlay || tm.yardsPerPlay || 0) * 7 +
        (tm.last3.pointsPerPlay || tm.pointsPerPlay || 0) * 70
      ) / 3;
      const seasonAvg = (
        tm.pointsPerGame +
        (tm.yardsPerPlay || 0) * 7 +
        (tm.pointsPerPlay || 0) * 70
      ) / 3;
      trendIndex = last3Avg > seasonAvg ? 0.1 : (last3Avg < seasonAvg ? -0.1 : 0);
    }
    
    result.set(team, {
      team,
      offenseQualityIndex,
      paceIndex,
      redZoneIndex,
      sustainIndex,
      environmentIndex,
      trendIndex
    });
  }
  
  return result;
}

// Main export function
export async function loadAllTeamMetrics(): Promise<{
  metrics: Map<string, TeamMetrics>;
  composites: Map<string, TeamComposite>;
}> {
  // Load all metrics in parallel
  const [
    ppp, ppg, playsPerGame, offTDs, ypp, secondsPerPlay,
    timeOfPoss, thirdDown, fourthDown, firstDowns,
    scoringMargin, rzTDs, rzScoringPct, rzAttempts,
    pppMargin, touchdowns
  ] = await Promise.all([
    loadTeamPointsPerPlay(),
    loadTeamPointsPerGame(),
    loadTeamPlaysPerGame(),
    loadTeamOffensiveTDs(),
    loadTeamYardsPerPlay(),
    loadTeamSecondsPerPlay(),
    loadTeamTimeOfPossession(),
    loadTeamThirdDown(),
    loadTeamFourthDown(),
    loadTeamFirstDowns(),
    loadTeamScoringMargin(),
    loadTeamRedZoneTDs(),
    loadTeamRedZoneScoringPct(),
    loadTeamRedZoneAttempts(),
    loadTeamPointsPerPlayMargin(),
    loadTeamTouchdowns()
  ]);
  
  const metrics = mergeTeamMetrics([
    ppp, ppg, playsPerGame, offTDs, ypp, secondsPerPlay,
    timeOfPoss, thirdDown, fourthDown, firstDowns,
    scoringMargin, rzTDs, rzScoringPct, rzAttempts,
    pppMargin, touchdowns
  ]);
  
  const composites = computeTeamComposite(metrics);
  
  return { metrics, composites };
}