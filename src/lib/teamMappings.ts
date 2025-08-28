export const TEAM_NAME_TO_ABBR: Record<string, string> = {
  'Arizona': 'ARI',
  'Atlanta': 'ATL',
  'Baltimore': 'BAL',
  'Buffalo': 'BUF',
  'Carolina': 'CAR',
  'Chicago': 'CHI',
  'Cincinnati': 'CIN',
  'Cleveland': 'CLE',
  'Dallas': 'DAL',
  'Denver': 'DEN',
  'Detroit': 'DET',
  'Green Bay': 'GB',
  'Houston': 'HOU',
  'Indianapolis': 'IND',
  'Jacksonville': 'JAC',
  'Kansas City': 'KC',
  'LA Chargers': 'LAC',
  'Los Angeles Chargers': 'LAC',
  'LA Rams': 'LAR',
  'Los Angeles Rams': 'LAR',
  'Las Vegas': 'LV',
  'Miami': 'MIA',
  'Minnesota': 'MIN',
  'New England': 'NE',
  'New Orleans': 'NO',
  'NY Giants': 'NYG',
  'New York Giants': 'NYG',
  'NY Jets': 'NYJ',
  'New York Jets': 'NYJ',
  'Philadelphia': 'PHI',
  'Pittsburgh': 'PIT',
  'San Francisco': 'SF',
  'Seattle': 'SEA',
  'Tampa Bay': 'TB',
  'Tennessee': 'TEN',
  'Washington': 'WAS'
};

export function normalizeTeamName(teamName: string): string | null {
  if (!teamName) return null;
  
  const trimmed = teamName.trim();
  
  // Direct match
  if (TEAM_NAME_TO_ABBR[trimmed]) {
    return TEAM_NAME_TO_ABBR[trimmed];
  }
  
  // Try case-insensitive match
  const lowerTeam = trimmed.toLowerCase();
  for (const [key, value] of Object.entries(TEAM_NAME_TO_ABBR)) {
    if (key.toLowerCase() === lowerTeam) {
      return value;
    }
  }
  
  // Already an abbreviation?
  const upperTeam = trimmed.toUpperCase();
  const validAbbrs = new Set(Object.values(TEAM_NAME_TO_ABBR));
  if (validAbbrs.has(upperTeam)) {
    return upperTeam;
  }
  
  return null;
}