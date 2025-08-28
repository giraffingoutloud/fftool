/**
 * Robust Player Name Matching System
 * Handles name variations, aliases, and fuzzy matching
 */

import { logger } from './utils/logger';

interface MatchResult {
  matched: boolean;
  confidence: number;
  matchedName: string;
  matchType: 'exact' | 'alias' | 'fuzzy' | 'none';
  source?: string;
}

export class PlayerNameMatcher {
  private static instance: PlayerNameMatcher;
  
  // Known name variations and aliases
  private readonly aliases: Map<string, string[]> = new Map([
    // Format: [canonical_name, [variations]]
    ['patrick mahomes', ['patrick mahomes ii', 'pat mahomes']],
    ['odell beckham jr', ['odell beckham', 'obj']],
    ['marvin harrison jr', ['marvin harrison']],
    ['calvin ridley', ['calvin ridley jr']],
    ['michael pittman jr', ['michael pittman']],
    ['travis etienne jr', ['travis etienne']],
    ['brian robinson jr', ['brian robinson']],
    ['kenneth walker iii', ['kenneth walker', 'ken walker']],
    ['will levis', ['william levis']],
    ['gabriel davis', ['gabe davis']],
    ['dj moore', ['d.j. moore', 'david moore']],
    ['aj brown', ['a.j. brown', 'arthur brown']],
    ['dk metcalf', ['d.k. metcalf', 'decaf metcalf']],
    ['cj stroud', ['c.j. stroud']],
    ['tj hockenson', ['t.j. hockenson']],
    ['cd lamb', ['ceedee lamb', 'c.d. lamb']],
    ['michael thomas', ['mike thomas']],
    ['chris olave', ['christopher olave']],
    ['mike evans', ['michael evans']],
    ['chris godwin', ['christopher godwin']],
    ['deandre hopkins', ['d hopkins', 'nuk hopkins']],
    ['stefon diggs', ['stefan diggs']],
    ['tyreek hill', ['tyreke hill']],
    ['davante adams', ['devante adams']],
    ['cooper kupp', ['cooper cup']],
    ['justin jefferson', ['j jefferson']],
    ['jamarr chase', ['ja\'marr chase', 'jamar chase']],
    ['tee higgins', ['t higgins']],
    ['jaylen waddle', ['jalen waddle']],
    ['amon-ra st brown', ['amon ra st brown', 'amonra st brown', 'amon-ra st. brown', 'the sun god']],
    ['deebo samuel', ['deebo samuel sr', 'deebo samuels']],
    ['brandon aiyuk', ['b aiyuk']],
    ['terry mclaurin', ['scary terry']],
    ['calvin austin iii', ['calvin austin', 'calvin austin 3']],
    ['marvin mims jr', ['marvin mims']],
    ['robert woods', ['bobby woods']],
    // Defenses
    ['49ers dst', ['san francisco dst', 'sf dst', '49ers defense', 'niners dst']],
    ['cowboys dst', ['dallas dst', 'dal dst', 'cowboys defense']],
    ['bills dst', ['buffalo dst', 'buf dst', 'bills defense']],
    ['ravens dst', ['baltimore dst', 'bal dst', 'ravens defense']],
    ['steelers dst', ['pittsburgh dst', 'pit dst', 'steelers defense']],
    ['jets dst', ['new york jets dst', 'nyj dst', 'jets defense']],
    ['browns dst', ['cleveland dst', 'cle dst', 'browns defense']],
    ['saints dst', ['new orleans dst', 'no dst', 'saints defense']],
    ['buccaneers dst', ['tampa bay dst', 'tb dst', 'bucs dst', 'buccaneers defense']],
    ['dolphins dst', ['miami dst', 'mia dst', 'dolphins defense']],
    ['chiefs dst', ['kansas city dst', 'kc dst', 'chiefs defense']],
    ['eagles dst', ['philadelphia dst', 'phi dst', 'eagles defense']],
    ['bengals dst', ['cincinnati dst', 'cin dst', 'bengals defense']],
    ['packers dst', ['green bay dst', 'gb dst', 'packers defense']],
    ['patriots dst', ['new england dst', 'ne dst', 'patriots defense']],
    ['colts dst', ['indianapolis dst', 'ind dst', 'colts defense']],
    ['chargers dst', ['los angeles chargers dst', 'la chargers dst', 'lac dst', 'chargers defense']],
    ['rams dst', ['los angeles rams dst', 'la rams dst', 'lar dst', 'rams defense']],
    ['bears dst', ['chicago dst', 'chi dst', 'bears defense']],
    ['vikings dst', ['minnesota dst', 'min dst', 'vikings defense']],
    ['lions dst', ['detroit dst', 'det dst', 'lions defense']],
    ['falcons dst', ['atlanta dst', 'atl dst', 'falcons defense']],
    ['panthers dst', ['carolina dst', 'car dst', 'panthers defense']],
    ['commanders dst', ['washington dst', 'was dst', 'commanders defense', 'washington defense']],
    ['giants dst', ['new york giants dst', 'nyg dst', 'giants defense']],
    ['cardinals dst', ['arizona dst', 'ari dst', 'cardinals defense']],
    ['seahawks dst', ['seattle dst', 'sea dst', 'seahawks defense']],
    ['broncos dst', ['denver dst', 'den dst', 'broncos defense']],
    ['raiders dst', ['las vegas dst', 'lv dst', 'raiders defense']],
    ['jaguars dst', ['jacksonville dst', 'jac dst', 'jaguars defense', 'jags dst']],
    ['texans dst', ['houston dst', 'hou dst', 'texans defense']],
    ['titans dst', ['tennessee dst', 'ten dst', 'titans defense']]
  ]);
  
  // Reverse lookup for aliases
  private aliasToCanonical: Map<string, string> = new Map();
  
  private constructor() {
    this.buildReverseLookup();
  }
  
  public static getInstance(): PlayerNameMatcher {
    if (!PlayerNameMatcher.instance) {
      PlayerNameMatcher.instance = new PlayerNameMatcher();
    }
    return PlayerNameMatcher.instance;
  }
  
  private buildReverseLookup(): void {
    this.aliases.forEach((variations, canonical) => {
      variations.forEach(variation => {
        this.aliasToCanonical.set(this.normalize(variation), canonical);
      });
      // Also add the canonical name itself
      this.aliasToCanonical.set(this.normalize(canonical), canonical);
    });
  }
  
  /**
   * Normalize a name for comparison
   */
  public normalize(name: string): string {
    if (!name) return '';
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '') // Remove special characters
      .replace(/\s+/g, ' ')         // Normalize spaces
      .trim();
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
            matrix[i - 1][j - 1] + 1,  // Substitution
            matrix[i][j - 1] + 1,       // Insertion
            matrix[i - 1][j] + 1        // Deletion
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }
  
  /**
   * Calculate similarity score (0-1)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const distance = this.levenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);
    if (maxLength === 0) return 1;
    return 1 - (distance / maxLength);
  }
  
  /**
   * Match player name with confidence scoring
   */
  public matchPlayer(
    inputName: string,
    candidateNames?: string[]
  ): MatchResult {
    const normalized = this.normalize(inputName);
    
    // 1. Check exact match
    if (this.aliasToCanonical.has(normalized)) {
      return {
        matched: true,
        confidence: 1.0,
        matchedName: this.aliasToCanonical.get(normalized)!,
        matchType: 'exact',
        source: 'alias_database'
      };
    }
    
    // 2. Check if it's an alias
    for (const [aliasNorm, canonical] of this.aliasToCanonical.entries()) {
      if (aliasNorm === normalized) {
        return {
          matched: true,
          confidence: 1.0,
          matchedName: canonical,
          matchType: 'alias',
          source: 'alias_database'
        };
      }
    }
    
    // 3. Fuzzy matching against known names
    let bestMatch: MatchResult = {
      matched: false,
      confidence: 0,
      matchedName: '',
      matchType: 'none'
    };
    
    // Check against all known canonical names
    for (const canonical of this.aliases.keys()) {
      const similarity = this.calculateSimilarity(normalized, this.normalize(canonical));
      if (similarity > bestMatch.confidence && similarity > 0.85) {
        bestMatch = {
          matched: true,
          confidence: similarity,
          matchedName: canonical,
          matchType: 'fuzzy',
          source: 'levenshtein'
        };
      }
    }
    
    // 4. If candidate names provided, check against them
    if (candidateNames && candidateNames.length > 0) {
      for (const candidate of candidateNames) {
        const candNorm = this.normalize(candidate);
        const similarity = this.calculateSimilarity(normalized, candNorm);
        
        if (similarity > bestMatch.confidence && similarity > 0.85) {
          bestMatch = {
            matched: true,
            confidence: similarity,
            matchedName: candidate,
            matchType: 'fuzzy',
            source: 'candidate_list'
          };
        }
      }
    }
    
    // Log fuzzy matches for review
    if (bestMatch.matchType === 'fuzzy' && bestMatch.confidence < 0.95) {
      logger.info('Fuzzy match found', {
        input: inputName,
        matched: bestMatch.matchedName,
        confidence: bestMatch.confidence
      });
    }
    
    return bestMatch.matched ? bestMatch : {
      matched: false,
      confidence: 0,
      matchedName: inputName,
      matchType: 'none'
    };
  }
  
  /**
   * Add a new alias
   */
  public addAlias(canonical: string, alias: string): void {
    const canonicalNorm = this.normalize(canonical);
    const aliasNorm = this.normalize(alias);
    
    if (!this.aliases.has(canonicalNorm)) {
      this.aliases.set(canonicalNorm, []);
    }
    
    const aliases = this.aliases.get(canonicalNorm)!;
    if (!aliases.includes(alias)) {
      aliases.push(alias);
      this.aliasToCanonical.set(aliasNorm, canonicalNorm);
      
      logger.info('Added alias', {
        canonical: canonicalNorm,
        alias: aliasNorm
      });
    }
  }
  
  /**
   * Get all aliases for a player
   */
  public getAliases(playerName: string): string[] {
    const normalized = this.normalize(playerName);
    
    // Check if it's a canonical name
    if (this.aliases.has(normalized)) {
      return this.aliases.get(normalized) || [];
    }
    
    // Check if it's an alias
    const canonical = this.aliasToCanonical.get(normalized);
    if (canonical) {
      return this.aliases.get(canonical) || [];
    }
    
    return [];
  }
  
  /**
   * Export aliases for persistence
   */
  public exportAliases(): Record<string, string[]> {
    const result: Record<string, string[]> = {};
    this.aliases.forEach((aliases, canonical) => {
      result[canonical] = aliases;
    });
    return result;
  }
  
  /**
   * Import aliases from storage
   */
  public importAliases(data: Record<string, string[]>): void {
    Object.entries(data).forEach(([canonical, aliases]) => {
      this.aliases.set(canonical, aliases);
    });
    this.buildReverseLookup();
  }
}

export const playerNameMatcher = PlayerNameMatcher.getInstance();