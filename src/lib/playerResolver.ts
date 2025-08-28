/**
 * Player Resolver System for ESPN Fantasy Football Auction Draft
 * Handles foreign key resolution, name matching, and team standardization
 * Optimized for 2025-2026 season, full PPR, $200 budget
 */

import { logger } from './utils/logger';

// Standard ESPN team abbreviations for 2025-2026
export const TEAM_ABBREVIATION_MAP: Record<string, string> = {
  // Primary mappings
  'LA': 'LAR',   // LA Rams
  'BLT': 'BAL',  // Baltimore (typo)
  'HST': 'HOU',  // Houston (typo)
  'ARZ': 'ARI',  // Arizona
  'JAX': 'JAC',  // Jacksonville
  'JACK': 'JAC', // Jacksonville variant
  'WSH': 'WAS',  // Washington Commanders
  'WASH': 'WAS', // Washington variant
  'LVR': 'LV',   // Las Vegas Raiders
  'LV': 'LV',    // Already correct
  
  // Historical mappings (for older data)
  'STL': 'LAR',  // St. Louis Rams -> LA Rams
  'SD': 'LAC',   // San Diego Chargers -> LA Chargers
  'OAK': 'LV',   // Oakland Raiders -> Las Vegas Raiders
  
  // Keep correct ones as-is
  'ARI': 'ARI', 'ATL': 'ATL', 'BAL': 'BAL', 'BUF': 'BUF',
  'CAR': 'CAR', 'CHI': 'CHI', 'CIN': 'CIN', 'CLE': 'CLE',
  'DAL': 'DAL', 'DEN': 'DEN', 'DET': 'DET', 'GB': 'GB',
  'HOU': 'HOU', 'IND': 'IND', 'JAC': 'JAC', 'KC': 'KC',
  'LAC': 'LAC', 'LAR': 'LAR', 'MIA': 'MIA', 'MIN': 'MIN',
  'NE': 'NE', 'NO': 'NO', 'NYG': 'NYG', 'NYJ': 'NYJ',
  'PHI': 'PHI', 'PIT': 'PIT', 'SF': 'SF', 'SEA': 'SEA',
  'TB': 'TB', 'TEN': 'TEN', 'WAS': 'WAS',
  
  // Free agents
  'FA': 'FA', '': 'FA', 'N/A': 'FA', 'UFA': 'FA'
};

// Known player name aliases for 2025-2026 season
export const PLAYER_NAME_ALIASES: Record<string, string> = {
  // Common nicknames
  'Mike Thomas': 'Michael Thomas',
  'Mike Williams': 'Michael Williams',
  'Mike Evans': 'Michael Evans',
  'DJ Moore': 'D.J. Moore',
  'DJ Chark': 'D.J. Chark',
  'AJ Brown': 'A.J. Brown',
  
  // Andrew/Drew variations
  'Andrew Ogletree': 'Drew Ogletree',
  'Drew Ogletree': 'Andrew Ogletree',
  
  // Jr./Sr./III suffixes - bidirectional mappings
  'Marvin Mims Jr': 'Marvin Mims',
  'Marvin Mims Jr.': 'Marvin Mims',
  'Marvin Mims': 'Marvin Mims',
  'Luther Burden': 'Luther Burden',
  'Luther Burden III': 'Luther Burden',
  'Odell Beckham': 'Odell Beckham Jr.',
  'Odell Beckham Jr': 'Odell Beckham Jr.',
  'Michael Pittman': 'Michael Pittman Jr.',
  'Michael Pittman Jr': 'Michael Pittman Jr.',
  'Brian Robinson': 'Brian Robinson Jr.',
  'Brian Robinson Jr': 'Brian Robinson Jr.',
  
  // Hollywood Brown - map both ways to handle either form
  'Marquise Brown': 'Marquise Brown',
  'Hollywood Brown': 'Marquise Brown',
  'Marquise "Hollywood" Brown': 'Marquise Brown',
  
  // Other common variations
  'Kenneth Walker': 'Kenneth Walker III',
  'Kenneth Walker III': 'Kenneth Walker III',
  'Will Fuller': 'Will Fuller V',
  'Will Fuller V': 'Will Fuller V',
  'AJ Dillon': 'A.J. Dillon',
  'TJ Hockenson': 'T.J. Hockenson',
  'CJ Stroud': 'C.J. Stroud',
  'CJ Beathard': 'C.J. Beathard',
  
  // Suffix variations (avoid duplicates)
  'Ken Walker': 'Kenneth Walker III',
  'Marvin Harrison': 'Marvin Harrison Jr.',
  
  // Special cases
  'Gabriel Davis': 'Gabe Davis',
  'Joshua Palmer': 'Josh Palmer',
  'Joshua Downs': 'Josh Downs',
  'Christopher Olave': 'Chris Olave',
  'DeAndre Hopkins': 'Deandre Hopkins', // ESPN sometimes drops capital A
  
  // Defense/Special Teams
  'Cleveland Browns': 'Browns DST',
  'Browns Defense': 'Browns DST',
  'Cleveland Defense': 'Browns DST',
  
  // DST mappings for all teams
  'Bills DST': 'Buffalo Bills',
  'Buffalo Bills': 'Bills DST',
  'BUF': 'Bills DST',
  
  'Steelers DST': 'Pittsburgh Steelers',
  'Pittsburgh Steelers': 'Steelers DST',
  'PIT': 'Steelers DST',
  
  '49ers DST': 'San Francisco 49ers',
  'San Francisco 49ers': '49ers DST',
  'SF': '49ers DST',
  
  'Lions DST': 'Detroit Lions',
  'Detroit Lions': 'Lions DST',
  'DET': 'Lions DST',
  
  'Eagles DST': 'Philadelphia Eagles',
  'Philadelphia Eagles': 'Eagles DST',
  'PHI': 'Eagles DST',
  
  'Broncos DST': 'Denver Broncos',
  'Denver Broncos': 'Broncos DST',
  'DEN': 'Broncos DST',
  
  'Vikings DST': 'Minnesota Vikings',
  'Minnesota Vikings': 'Vikings DST',
  'MIN': 'Vikings DST',
  
  'Cowboys DST': 'Dallas Cowboys',
  'Dallas Cowboys': 'Cowboys DST',
  'DAL': 'Cowboys DST',
  
  'Ravens DST': 'Baltimore Ravens',
  'Baltimore Ravens': 'Ravens DST',
  'BAL': 'Ravens DST',
  
  'Chiefs DST': 'Kansas City Chiefs',
  'Kansas City Chiefs': 'Chiefs DST',
  'KC': 'Chiefs DST'
};

interface PlayerMatch {
  player: any;
  confidence: number;
  matchType: 'exact' | 'normalized' | 'fuzzy' | 'alias' | 'not_found';
  reason?: string;
}

export class PlayerResolver {
  private playerIndex: Map<string, any> = new Map();
  private normalizedIndex: Map<string, any> = new Map();
  private teamRosters: Map<string, Set<string>> = new Map();
  
  // Public getter for debugging
  public getPlayerIndex(): Map<string, any> {
    return this.playerIndex;
  }

  /**
   * Initialize resolver with master player data (typically from ADP)
   */
  initialize(players: any[]): void {
    this.playerIndex.clear();
    this.normalizedIndex.clear();
    this.teamRosters.clear();

    // Initialize player resolver with players

    // Debug: Check DST entries before processing
    const dstPlayers = players.filter(p => {
      const pos = (p.position || p.Position || '').toUpperCase();
      return pos === 'DST' || pos === 'DEF';
    });
    if (dstPlayers.length > 0) {
      logger.info(`Found ${dstPlayers.length} DST entries to index:`, 
        dstPlayers.slice(0, 5).map(d => ({
          name: d.name || d['Full Name'] || d.Player,
          team: d.team || d['Team Abbreviation'] || d.Team,
          position: d.position || d.Position
        }))
      );
    } else {
      logger.warn('NO DST entries found in ADP data!');
      // Check what positions we do have
      const positions = new Set(players.map(p => p.position || p.Position));
      logger.warn(`Available positions in ADP:`, Array.from(positions));
    }

    players.forEach(player => {
      // Handle both formats: original CSV fields and transformed object fields
      const name = player.name || player['Full Name'] || player.Player;
      const rawTeam = player.team || player['Team Abbreviation'] || player.Team;
      const team = this.normalizeTeam(rawTeam);
      const position = this.normalizePosition(player.position || player.Position);
      
      if (!name) {
        logger.warn('Player with no name found:', player);
        return;
      }

      // Primary index
      const key = this.generateKey(name, team, position);
      this.playerIndex.set(key, player);
      
      // Create player index key
      if (position === 'DST') {
        
        // For DSTs, create multiple alternate keys for better matching
        const baseName = name.replace(' DST', '').replace(' Defense', '').trim();
        const words = baseName.split(' ');
        
        // Create variations for DST matching
        const dstVariations = [
          `${baseName} DST`,           // Full name with DST
          `${baseName} Defense`,       // Full name with Defense
          baseName,                    // Just team name
        ];
        
        // If multi-word team name, also add last word only (e.g., "Bills" from "Buffalo Bills")
        if (words.length > 1) {
          const cityName = words[words.length - 1]; // Last word (e.g., "Bills")
          dstVariations.push(`${cityName} DST`);
          dstVariations.push(`${cityName} Defense`);
          dstVariations.push(cityName);
        }
        
        // Also add first word for teams like "49ers"
        if (words.length >= 1) {
          const firstName = words[0];
          if (firstName !== baseName) {
            dstVariations.push(`${firstName} DST`);
            dstVariations.push(`${firstName} Defense`);
          }
        }
        
        // Create keys for all variations
        dstVariations.forEach(variation => {
          if (variation && variation !== name) {
            const altKey = this.generateKey(variation, team, position);
            this.playerIndex.set(altKey, player);
            // Created DST variation key
          }
        });
      }

      // Normalized index for fuzzy matching
      const normalizedKey = this.generateNormalizedKey(name, team, position);
      this.normalizedIndex.set(normalizedKey, player);

      // Team rosters
      if (!this.teamRosters.has(team)) {
        this.teamRosters.set(team, new Set());
      }
      this.teamRosters.get(team)!.add(name);
    });

    // Debug: Verify DST keys were created
    const dstKeys = Array.from(this.playerIndex.keys()).filter(k => k.includes('|DST'));
    if (dstKeys.length > 0) {
      // Successfully indexed DST keys
    } else {
      logger.warn('No DST keys were created in the player index!');
    }

    logger.info(`PlayerResolver initialized with ${this.playerIndex.size} players`);
    
    // Debug: Check if specific problematic players are in the index
    const problematicNames = ['Mims', 'Marquise', 'Luther', 'Bills', '49ers', 'Lions', 'Vikings', 'Packers', 'Cowboys', 'Patriots', 'Chiefs', 'Broncos'];
    const foundProblematic: string[] = [];
    this.playerIndex.forEach((player, key) => {
      if (problematicNames.some(name => key.toLowerCase().includes(name.toLowerCase()))) {
        foundProblematic.push(key);
      }
    });
    
    // Also check all DST keys
    const allDstKeys = Array.from(this.playerIndex.keys()).filter(k => k.includes('|DST'));
    
    // Index check completed
    if (allDstKeys.length > 0) {
      
      // Group DST keys by team
      const dstByTeam = new Map<string, string[]>();
      allDstKeys.forEach(key => {
        const parts = key.split('|');
        const team = parts[1];
        if (!dstByTeam.has(team)) {
          dstByTeam.set(team, []);
        }
        dstByTeam.get(team)!.push(key);
      });
      
      // Show DST keys for specific teams we're having trouble with
      const troubleTeams = ['BUF', 'PIT', 'KC', 'SF', 'DET', 'MIN', 'GB', 'DAL', 'NE'];
      troubleTeams.forEach(team => {
        const keys = dstByTeam.get(team);
        // Team DST keys checked
      });
    }
    
    // Completed problematic player check
  }

  /**
   * Generate primary key for player
   */
  generateKey(name: string, team: string, position: string): string {
    return `${name}|${this.normalizeTeam(team)}|${this.normalizePosition(position)}`;
  }

  /**
   * Generate normalized key for fuzzy matching
   */
  generateNormalizedKey(name: string, team: string, position: string): string {
    return `${this.normalizeName(name)}|${this.normalizeTeam(team)}|${this.normalizePosition(position)}`;
  }

  /**
   * Normalize player name for matching
   */
  normalizeName(name: string): string {
    if (!name) return '';
    
    // Check for known aliases first
    const aliased = PLAYER_NAME_ALIASES[name] || name;
    
    return aliased
      .toLowerCase()
      .replace(/[.']/g, '') // Remove punctuation
      .replace(/\s+(jr\.?|sr\.?|iii|ii|iv|v)$/i, '') // Remove suffixes (with or without period)
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim();
  }

  /**
   * Normalize team abbreviation
   */
  normalizeTeam(team: string): string {
    if (!team) return 'FA';
    const upper = team.toUpperCase().trim();
    return TEAM_ABBREVIATION_MAP[upper] || upper;
  }

  /**
   * Normalize position to uppercase
   */
  normalizePosition(position: string): string {
    if (!position) return '';
    return position.toUpperCase().trim();
  }

  /**
   * Generate DST name variations for matching
   */
  generateDSTVariations(name: string, teamCode: string): string[] {
    const variations: string[] = [];
    
    // Get full team name from team code
    const fullTeamName = this.getFullTeamName(teamCode);
    const teamParts = fullTeamName.split(' ');
    const cityName = teamParts.slice(0, -1).join(' '); // e.g., "Kansas City" from "Kansas City Chiefs"
    const nickname = teamParts[teamParts.length - 1]; // e.g., "Chiefs" from "Kansas City Chiefs"
    
    // Add all possible variations
    variations.push(name); // Original name
    variations.push(`${nickname} DST`); // e.g., "Chiefs DST"
    variations.push(`${fullTeamName} DST`); // e.g., "Kansas City Chiefs DST"
    variations.push(`${fullTeamName}`); // e.g., "Kansas City Chiefs"
    variations.push(`${nickname}`); // e.g., "Chiefs"
    variations.push(`${cityName} Defense`); // e.g., "Kansas City Defense"
    variations.push(`${nickname} Defense`); // e.g., "Chiefs Defense"
    variations.push(`${fullTeamName} Defense`); // e.g., "Kansas City Chiefs Defense"
    
    // Add city-based variations
    if (cityName && cityName !== nickname) {
      variations.push(`${cityName} DST`); // e.g., "Kansas City DST"
    }
    
    // Special cases for teams with unique names
    if (teamCode === 'SF') {
      variations.push('San Francisco DST');
      variations.push('49ers DST');
      variations.push('San Francisco 49ers DST');
      variations.push('49ers');
      variations.push('San Francisco 49ers');
    }
    
    if (teamCode === 'GB') {
      variations.push('Green Bay Defense');
      variations.push('Packers DST');
      variations.push('Green Bay DST');
      variations.push('Green Bay Packers DST');
      variations.push('Packers');
      variations.push('Green Bay Packers');
    }
    
    if (teamCode === 'NE') {
      variations.push('New England Defense');
      variations.push('Patriots DST');
      variations.push('New England DST');
      variations.push('New England Patriots DST');
      variations.push('Patriots');
      variations.push('New England Patriots');
    }
    
    // Remove duplicates
    return [...new Set(variations)];
  }

  /**
   * Get full team name from abbreviation or partial name
   */
  getFullTeamName(teamNameOrAbbr: string): string {
    if (!teamNameOrAbbr) return '';
    
    // Map of short names/abbreviations to full team names
    const teamFullNames: Record<string, string> = {
      // Abbreviations to full names
      'BUF': 'Buffalo Bills',
      'MIA': 'Miami Dolphins',
      'NE': 'New England Patriots',
      'NYJ': 'New York Jets',
      'BAL': 'Baltimore Ravens',
      'CIN': 'Cincinnati Bengals',
      'CLE': 'Cleveland Browns',
      'PIT': 'Pittsburgh Steelers',
      'HOU': 'Houston Texans',
      'IND': 'Indianapolis Colts',
      'JAC': 'Jacksonville Jaguars',
      'TEN': 'Tennessee Titans',
      'DEN': 'Denver Broncos',
      'KC': 'Kansas City Chiefs',
      'LV': 'Las Vegas Raiders',
      'LAC': 'Los Angeles Chargers',
      'DAL': 'Dallas Cowboys',
      'NYG': 'New York Giants',
      'PHI': 'Philadelphia Eagles',
      'WAS': 'Washington Commanders',
      'CHI': 'Chicago Bears',
      'DET': 'Detroit Lions',
      'GB': 'Green Bay Packers',
      'MIN': 'Minnesota Vikings',
      'ATL': 'Atlanta Falcons',
      'CAR': 'Carolina Panthers',
      'NO': 'New Orleans Saints',
      'TB': 'Tampa Bay Buccaneers',
      'ARI': 'Arizona Cardinals',
      'LAR': 'Los Angeles Rams',
      'SF': 'San Francisco 49ers',
      'SEA': 'Seattle Seahawks',
      
      // Short names to full names
      'Bills': 'Buffalo Bills',
      'Dolphins': 'Miami Dolphins',
      'Patriots': 'New England Patriots',
      'Jets': 'New York Jets',
      'Ravens': 'Baltimore Ravens',
      'Bengals': 'Cincinnati Bengals',
      'Browns': 'Cleveland Browns',
      'Steelers': 'Pittsburgh Steelers',
      'Texans': 'Houston Texans',
      'Colts': 'Indianapolis Colts',
      'Jaguars': 'Jacksonville Jaguars',
      'Titans': 'Tennessee Titans',
      'Broncos': 'Denver Broncos',
      'Chiefs': 'Kansas City Chiefs',
      'Raiders': 'Las Vegas Raiders',
      'Chargers': 'Los Angeles Chargers',
      'Cowboys': 'Dallas Cowboys',
      'Giants': 'New York Giants',
      'Eagles': 'Philadelphia Eagles',
      'Commanders': 'Washington Commanders',
      'Bears': 'Chicago Bears',
      'Lions': 'Detroit Lions',
      'Packers': 'Green Bay Packers',
      'Vikings': 'Minnesota Vikings',
      'Falcons': 'Atlanta Falcons',
      'Panthers': 'Carolina Panthers',
      'Saints': 'New Orleans Saints',
      'Buccaneers': 'Tampa Bay Buccaneers',
      'Cardinals': 'Arizona Cardinals',
      'Rams': 'Los Angeles Rams',
      '49ers': 'San Francisco 49ers',
      'Seahawks': 'Seattle Seahawks'
    };
    
    // Check if already a full name
    const fullNameValues = Object.values(teamFullNames);
    if (fullNameValues.includes(teamNameOrAbbr)) {
      return teamNameOrAbbr;
    }
    
    // Try exact match first
    if (teamFullNames[teamNameOrAbbr]) {
      return teamFullNames[teamNameOrAbbr];
    }
    
    // Try normalized team abbreviation
    const normalized = this.normalizeTeam(teamNameOrAbbr);
    if (teamFullNames[normalized]) {
      return teamFullNames[normalized];
    }
    
    // Return original if no match found
    return teamNameOrAbbr;
  }

  /**
   * Find best match for a player
   */
  findBestMatch(name: string, team: string, position: string): PlayerMatch {
    // Debug logging for problematic players
    const isProblematic = name?.includes('Mims') || name?.includes('Marquise') || 
                         name?.includes('Luther') || name?.includes('DST') || 
                         position === 'DST';
    
    if (isProblematic) {
      // Finding best match
    }
    
    // Special handling for DSTs
    if (position?.toUpperCase() === 'DST' || name?.includes('DST') || name?.includes('Defense')) {
      const normalizedTeam = this.normalizeTeam(team);
      
      // Try various DST name formats
      const dstVariations = this.generateDSTVariations(name, normalizedTeam);
      
      // Searching for DST variations
      
      for (const variation of dstVariations) {
        const key = this.generateKey(variation, normalizedTeam, 'DST');
        // Try DST key variation
        if (this.playerIndex.has(key)) {
          return {
            player: this.playerIndex.get(key)!,
            confidence: 1.0,
            matchType: 'exact',
            reason: `DST matched as ${variation}`
          };
        }
      }
      
      // If no exact match, try to find any DST for this team
      const allDstKeys = Array.from(this.playerIndex.keys()).filter(k => k.includes('|DST'));
      const teamDstKey = allDstKeys.find(k => k.includes(`|${normalizedTeam}|`));
      
      if (teamDstKey) {
        return {
          player: this.playerIndex.get(teamDstKey)!,
          confidence: 0.95,
          matchType: 'normalized',
          reason: `DST matched by team code ${normalizedTeam}`
        };
      }
      
      // DST not found - create provisional entry
      const provisionalDST = this.createProvisionalPlayer(name, normalizedTeam, 'DST', { fantasyPoints: 0 });
      return {
        player: provisionalDST,
        confidence: 0.5,
        matchType: 'normalized',
        reason: `Provisional DST created (not in ADP data)`
      };
    }
    
    // 1. Try exact match
    const exactKey = this.generateKey(name, team, position);
    if (this.playerIndex.has(exactKey)) {
      return {
        player: this.playerIndex.get(exactKey),
        confidence: 1.0,
        matchType: 'exact',
        reason: 'Exact match found'
      };
    }
    
    // 1.5 Special handling for FB/RB position flexibility
    // Many fullbacks are listed as RB in some sources and FB in others
    if (position === 'RB' || position === 'FB') {
      const altPosition = position === 'RB' ? 'FB' : 'RB';
      const altKey = this.generateKey(name, team, altPosition);
      if (this.playerIndex.has(altKey)) {
        return {
          player: this.playerIndex.get(altKey),
          confidence: 0.98,
          matchType: 'normalized',
          reason: `Matched with position flexibility: ${position} → ${altPosition}`
        };
      }
    }

    // 2. Try with alias resolution (check multiple variations)
    const aliasedName = PLAYER_NAME_ALIASES[name] || name;
    
    // Try direct alias match
    if (aliasedName !== name) {
      const aliasKey = this.generateKey(aliasedName, team, position);
      if (this.playerIndex.has(aliasKey)) {
        return {
          player: this.playerIndex.get(aliasKey)!,
          confidence: 0.95,
          matchType: 'alias',
          reason: `Matched via alias: ${name} → ${aliasedName}`
        };
      }
      
      // Also try alias with position flexibility for FB/RB
      if (position === 'RB' || position === 'FB') {
        const altPosition = position === 'RB' ? 'FB' : 'RB';
        const altAliasKey = this.generateKey(aliasedName, team, altPosition);
        if (this.playerIndex.has(altAliasKey)) {
          return {
            player: this.playerIndex.get(altAliasKey)!,
            confidence: 0.93,
            matchType: 'alias',
            reason: `Matched via alias + position: ${name} → ${aliasedName} (${position} → ${altPosition})`
          };
        }
      }
    }
    
    // Special handling for nicknamed players (e.g., "Hollywood" Brown)
    // Try removing nickname in quotes or parentheses
    const nameWithoutNickname = name
      .replace(/"[^"]*"/g, '') // Remove quoted nicknames
      .replace(/\([^)]*\)/g, '') // Remove parenthetical nicknames
      .replace(/\s+/g, ' ')
      .trim();
    
    if (nameWithoutNickname !== name && nameWithoutNickname.length > 0) {
      const withoutNicknameKey = this.generateKey(nameWithoutNickname, team, position);
      if (this.playerIndex.has(withoutNicknameKey)) {
        return {
          player: this.playerIndex.get(withoutNicknameKey)!,
          confidence: 0.95,
          matchType: 'alias',
          reason: `Matched by removing nickname: ${name} → ${nameWithoutNickname}`
        };
      }
      
      // Also try the alias of the name without nickname
      const aliasedWithoutNickname = PLAYER_NAME_ALIASES[nameWithoutNickname] || nameWithoutNickname;
      if (aliasedWithoutNickname !== nameWithoutNickname) {
        const aliasKey2 = this.generateKey(aliasedWithoutNickname, team, position);
        if (this.playerIndex.has(aliasKey2)) {
          return {
            player: this.playerIndex.get(aliasKey2)!,
            confidence: 0.95,
            matchType: 'alias',
            reason: `Matched via alias: ${nameWithoutNickname} → ${aliasedWithoutNickname}`
          };
        }
      }
    }

    // 3. Try normalized match
    const normalizedKey = this.generateNormalizedKey(name, team, position);
    if (this.normalizedIndex.has(normalizedKey)) {
      return {
        player: this.normalizedIndex.get(normalizedKey),
        confidence: 0.9,
        matchType: 'normalized',
        reason: 'Matched after normalization'
      };
    }

    // 4. Try fuzzy matching with same team
    const fuzzyMatch = this.fuzzyMatchPlayer(name, team, position);
    if (fuzzyMatch && fuzzyMatch.confidence > 0.7) {
      return fuzzyMatch;
    }

    // 5. Check if player exists on different team (possible trade)
    const differentTeamMatch = this.findPlayerOnDifferentTeam(name, position);
    if (differentTeamMatch) {
      return {
        ...differentTeamMatch,
        confidence: Math.min(0.8, differentTeamMatch.confidence),
        reason: `Found on different team: ${differentTeamMatch.player.team} (possible trade)`
      };
    }

    // Not found - return null for unmatched players
    // These are typically deep bench/practice squad players not relevant for fantasy
    return {
      player: null,
      confidence: 0,
      matchType: 'not_found',
      reason: `No match found for ${name} (${position}, ${team})`
    };
  }

  /**
   * Fuzzy match player name using Levenshtein distance
   */
  private fuzzyMatchPlayer(name: string, team: string, position: string): PlayerMatch | null {
    const normalized = this.normalizeName(name);
    let bestMatch: PlayerMatch | null = null;
    let bestDistance = Infinity;

    this.playerIndex.forEach((player, key) => {
      const [playerName, playerTeam, playerPos] = key.split('|');
      
      // Must match team and position for fuzzy matching
      if (this.normalizeTeam(playerTeam) !== this.normalizeTeam(team)) return;
      if (this.normalizePosition(playerPos) !== this.normalizePosition(position)) return;

      const distance = this.levenshteinDistance(
        normalized,
        this.normalizeName(playerName)
      );

      if (distance < bestDistance && distance <= 3) {
        bestDistance = distance;
        bestMatch = {
          player,
          confidence: Math.max(0.5, 1 - (distance * 0.15)),
          matchType: 'fuzzy',
          reason: `Fuzzy match (distance: ${distance})`
        };
      }
    });

    return bestMatch;
  }

  /**
   * Find player on different team
   */
  private findPlayerOnDifferentTeam(name: string, position: string): PlayerMatch | null {
    const normalized = this.normalizeName(name);
    
    for (const [key, player] of this.playerIndex.entries()) {
      const [playerName, _, playerPos] = key.split('|');
      
      if (this.normalizePosition(playerPos) !== this.normalizePosition(position)) continue;
      
      if (this.normalizeName(playerName) === normalized) {
        return {
          player,
          confidence: 0.85,
          matchType: 'normalized',
          reason: 'Found on different team'
        };
      }
    }
    
    return null;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Create provisional player entry for projection-only players
   */
  createProvisionalPlayer(name: string, team: string, position: string, projectionData: any): any {
    return {
      id: this.generateKey(name, team, position),
      name,
      team: this.normalizeTeam(team),
      position: this.normalizePosition(position),
      adp: 999, // Undrafted
      auctionValue: 0, // Minimum value
      isProvisional: true,
      dataSource: 'projection-only',
      projectedPoints: projectionData.fantasyPoints || 0,
      confidence: 0.5,
      note: 'Player not in ADP data - created from projections'
    };
  }

  /**
   * Resolve all foreign keys in a dataset
   */
  resolveDataset(data: any[], nameField: string, teamField: string, positionField: string): {
    resolved: any[];
    provisional: any[];
    unresolved: any[];
    stats: {
      total: number;
      exact: number;
      normalized: number;
      fuzzy: number;
      alias: number;
      provisional: number;
      unresolved: number;
    };
  } {
    const resolved: any[] = [];
    const provisional: any[] = [];
    const unresolved: any[] = [];
    
    const stats = {
      total: 0,
      exact: 0,
      normalized: 0,
      fuzzy: 0,
      alias: 0,
      provisional: 0,
      unresolved: 0
    };

    data.forEach(item => {
      const name = item[nameField];
      const team = item[teamField];
      const position = item[positionField];
      
      if (!name) return;
      
      stats.total++;
      
      const match = this.findBestMatch(name, team, position);
      
      if (match.matchType === 'exact') {
        stats.exact++;
        resolved.push({ ...item, _resolved: match.player, _confidence: match.confidence });
      } else if (match.matchType === 'normalized') {
        stats.normalized++;
        resolved.push({ ...item, _resolved: match.player, _confidence: match.confidence });
      } else if (match.matchType === 'fuzzy') {
        stats.fuzzy++;
        resolved.push({ ...item, _resolved: match.player, _confidence: match.confidence });
      } else if (match.matchType === 'alias') {
        stats.alias++;
        resolved.push({ ...item, _resolved: match.player, _confidence: match.confidence });
      } else {
        // Create provisional entry
        const provisionalPlayer = this.createProvisionalPlayer(name, team, position, item);
        provisional.push(provisionalPlayer);
        stats.provisional++;
      }
    });

    logger.info(`Foreign key resolution complete:`, stats);

    return {
      resolved,
      provisional,
      unresolved,
      stats
    };
  }
}

// Export singleton instance
export const playerResolver = new PlayerResolver();