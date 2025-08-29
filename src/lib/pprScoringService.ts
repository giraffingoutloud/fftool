/**
 * PPR Scoring Service
 * 
 * Calculates PPR-specific metrics for display purposes only.
 * Does NOT affect valuation calculations.
 * Provides a 0-100 score indicating reception/PPR value for each player.
 */

export interface PPRMetrics {
  score: number; // 0-100
  percentile: number; // 0-100 percentile among position
  components: {
    targetShare?: number;
    catchRate?: number;
    yprrScore?: number;
    redZoneTargets?: number;
    targetsPerGame?: number;
    routesRunRate?: number;
    receivingYardsShare?: number;
  };
  tier: 'elite' | 'high' | 'average' | 'below' | 'low';
  color: string; // Tailwind color class
  hexColor: string; // Hex color for custom styling
}

interface PlayerStats {
  position: string;
  targets?: number;
  receptions?: number;
  games?: number;
  teamTargets?: number;
  catchableTargets?: number;
  yardsPerRouteRun?: number;
  redZoneTargets?: number;
  routesRun?: number;
  teamPassPlays?: number;
  receivingYards?: number;
  teamReceivingYards?: number;
  dropRate?: number;
}

export class PPRScoringService {
  /**
   * Calculate PPR score for a player based on their position and stats
   */
  calculatePPRScore(player: PlayerStats): PPRMetrics | null {
    // No PPR relevance for these positions
    if (['QB', 'DST', 'K'].includes(player.position)) {
      return null;
    }

    let score = 0;
    const components: PPRMetrics['components'] = {};

    switch (player.position) {
      case 'WR':
        score = this.calculateWRScore(player, components);
        break;
      case 'RB':
        score = this.calculateRBScore(player, components);
        break;
      case 'TE':
        score = this.calculateTEScore(player, components);
        break;
      default:
        return null;
    }

    // Ensure score is between 0 and 100
    score = Math.max(0, Math.min(100, score));

    // Calculate percentile (will be updated when comparing to all players)
    const percentile = score; // Placeholder, updated later

    // Determine tier and color
    const { tier, color, hexColor } = this.getTierAndColor(score);

    return {
      score,
      percentile,
      components,
      tier,
      color,
      hexColor
    };
  }

  /**
   * Calculate WR PPR Score
   * Based on volume and efficiency metrics
   */
  private calculateWRScore(player: PlayerStats, components: PPRMetrics['components']): number {
    let score = 0;
    let weightUsed = 0;

    // Targets (40% weight) - Most important for PPR
    if (player.targets && player.games) {
      const targetsPerGame = player.targets / player.games;
      components.targetsPerGame = targetsPerGame;
      // Elite WR: 10+ targets/game (like Ja'Marr Chase with 175/17 = 10.3)
      // Good: 7+ targets/game
      // Average: 5+ targets/game
      const targetScore = Math.min(100, (targetsPerGame / 10) * 100);
      score += targetScore * 0.4;
      weightUsed += 0.4;
    } else if (player.targetShare) {
      // Use target share if raw targets not available
      components.targetShare = player.targetShare * 100;
      // Elite is 28%+ (like Chase), good is 20%+, average is 15%
      const targetScore = Math.min(100, (player.targetShare * 100 / 28) * 100);
      score += targetScore * 0.4;
      weightUsed += 0.4;
    }

    // Receptions (30% weight) - Direct PPR points
    if (player.receptions && player.games) {
      const receptionsPerGame = player.receptions / player.games;
      components.receptionsPerGame = receptionsPerGame;
      // Elite: 7+ rec/game (Chase had 127/17 = 7.5)
      // Good: 5+ rec/game
      // Average: 3+ rec/game
      const recScore = Math.min(100, (receptionsPerGame / 7) * 100);
      score += recScore * 0.3;
      weightUsed += 0.3;
    }

    // Catch Rate (15% weight) - Efficiency metric
    if (player.receptions && player.targets && player.targets > 0) {
      const catchRate = (player.receptions / player.targets) * 100;
      components.catchRate = catchRate;
      // Elite is 72%+ (Chase had 127/175 = 72.6%), good is 65%+, average is 60%
      const catchRateScore = Math.min(100, (catchRate / 72) * 100);
      score += catchRateScore * 0.15;
      weightUsed += 0.15;
    } else if (player.catchRate) {
      components.catchRate = player.catchRate * 100;
      const catchRateScore = Math.min(100, (player.catchRate * 100 / 72) * 100);
      score += catchRateScore * 0.15;
      weightUsed += 0.15;
    }

    // Red Zone Targets (15% weight) - TD upside
    if (player.redZoneTargets !== undefined && player.games) {
      const rzTargetsPerGame = player.redZoneTargets / player.games;
      components.redZoneTargets = rzTargetsPerGame;
      // Elite is 2+ per game (Chase had 35/17 = 2.1), good is 1.2+, average is 0.6
      const rzScore = Math.min(100, (rzTargetsPerGame / 2) * 100);
      score += rzScore * 0.15;
      weightUsed += 0.15;
    }

    // Normalize score if not all components available
    if (weightUsed > 0 && weightUsed < 1) {
      score = score / weightUsed;
    }

    return score;
  }

  /**
   * Calculate RB PPR Score
   * Focus on receiving volume for PPR value
   */
  private calculateRBScore(player: PlayerStats, components: PPRMetrics['components']): number {
    let score = 0;
    let weightUsed = 0;

    // Targets per Game (40% weight) - Most important for RB PPR value
    if (player.targets && player.games) {
      const targetsPerGame = player.targets / player.games;
      components.targetsPerGame = targetsPerGame;
      // Elite RB: 5+ targets/game (Barkley, CMC, Ekeler)
      // Good: 3.5+ targets/game
      // Average: 2+ targets/game
      const targetScore = Math.min(100, (targetsPerGame / 5) * 100);
      score += targetScore * 0.4;
      weightUsed += 0.4;
    }

    // Receptions per Game (35% weight) - Direct PPR value
    if (player.receptions && player.games) {
      const receptionsPerGame = player.receptions / player.games;
      components.receptionsPerGame = receptionsPerGame;
      // Elite RB: 4+ rec/game (Barkley had 57/17 = 3.4)
      // Good: 3+ rec/game
      // Average: 2+ rec/game
      const recScore = Math.min(100, (receptionsPerGame / 4) * 100);
      score += recScore * 0.35;
      weightUsed += 0.35;
    }

    // Catch Rate (15% weight) - Efficiency
    if (player.receptions && player.targets && player.targets > 0) {
      const catchRate = (player.receptions / player.targets) * 100;
      components.catchRate = catchRate;
      // Elite RB is 75%+ catch rate, good is 70%+, average is 65%
      const catchRateScore = Math.min(100, (catchRate / 75) * 100);
      score += catchRateScore * 0.15;
      weightUsed += 0.15;
    } else if (player.catchRate) {
      components.catchRate = player.catchRate * 100;
      const catchRateScore = Math.min(100, (player.catchRate * 100 / 75) * 100);
      score += catchRateScore * 0.15;
      weightUsed += 0.15;
    }

    // Receiving Yards (10% weight) - Bonus for big play ability
    if (player.receivingYards && player.games) {
      const yardsPerGame = player.receivingYards / player.games;
      components.receivingYardsPerGame = yardsPerGame;
      // Elite RB is 40+ rec yards/game, good is 25+, average is 15+
      const yardsScore = Math.min(100, (yardsPerGame / 40) * 100);
      score += yardsScore * 0.1;
      weightUsed += 0.1;
    }

    // Normalize score if not all components available
    if (weightUsed > 0 && weightUsed < 1) {
      score = score / weightUsed;
    }

    return score;
  }

  /**
   * Calculate TE PPR Score
   * Focus on volume for TEs since they're scarce
   */
  private calculateTEScore(player: PlayerStats, components: PPRMetrics['components']): number {
    let score = 0;
    let weightUsed = 0;

    // Targets per Game (45% weight) - Volume is king for TEs
    if (player.targets && player.games) {
      const targetsPerGame = player.targets / player.games;
      components.targetsPerGame = targetsPerGame;
      // Elite TE: 6+ targets/game (Kelce, Andrews typically get 7-8)
      // Good: 4+ targets/game
      // Average: 2.5+ targets/game
      const targetScore = Math.min(100, (targetsPerGame / 6) * 100);
      score += targetScore * 0.45;
      weightUsed += 0.45;
    } else if (player.targetShare) {
      components.targetShare = player.targetShare * 100;
      // Elite TE is 18%+ target share, good is 12%+, average is 8%
      const targetScore = Math.min(100, (player.targetShare * 100 / 18) * 100);
      score += targetScore * 0.45;
      weightUsed += 0.45;
    }

    // Receptions per Game (35% weight) - Direct PPR value
    if (player.receptions && player.games) {
      const receptionsPerGame = player.receptions / player.games;
      components.receptionsPerGame = receptionsPerGame;
      // Elite TE: 4.5+ rec/game (Kelce averages 5-6)
      // Good: 3+ rec/game
      // Average: 2+ rec/game
      const recScore = Math.min(100, (receptionsPerGame / 4.5) * 100);
      score += recScore * 0.35;
      weightUsed += 0.35;
    }

    // Red Zone Targets (20% weight) - TEs are red zone weapons
    if (player.redZoneTargets !== undefined && player.games) {
      const rzTargetsPerGame = player.redZoneTargets / player.games;
      components.redZoneTargets = rzTargetsPerGame;
      // Elite is 1.2+ per game, good is 0.8+, average is 0.4
      const rzScore = Math.min(100, (rzTargetsPerGame / 1.2) * 100);
      score += rzScore * 0.2;
      weightUsed += 0.2;
    }

    // Normalize score if not all components available
    if (weightUsed > 0 && weightUsed < 1) {
      score = score / weightUsed;
    }

    return score;
  }

  /**
   * Determine tier and color based on score
   */
  private getTierAndColor(score: number): { tier: PPRMetrics['tier'], color: string, hexColor: string } {
    if (score >= 80) {
      return { tier: 'elite', color: 'text-green-600 dark:text-green-400', hexColor: '#16a34a' };
    } else if (score >= 60) {
      return { tier: 'high', color: 'text-green-500 dark:text-green-500', hexColor: '#22c55e' };
    } else if (score >= 40) {
      return { tier: 'average', color: 'text-yellow-500 dark:text-yellow-400', hexColor: '#eab308' };
    } else if (score >= 20) {
      return { tier: 'below', color: 'text-orange-500 dark:text-orange-400', hexColor: '#f97316' };
    } else {
      return { tier: 'low', color: 'text-red-500 dark:text-red-400', hexColor: '#ef4444' };
    }
  }

  /**
   * Update percentiles for a group of players
   */
  updatePercentiles(players: Array<{ position: string; pprMetrics: PPRMetrics | null }>): void {
    // Group by position
    const positionGroups: Record<string, number[]> = {};
    
    players.forEach(player => {
      if (player.pprMetrics) {
        if (!positionGroups[player.position]) {
          positionGroups[player.position] = [];
        }
        positionGroups[player.position].push(player.pprMetrics.score);
      }
    });

    // Calculate percentiles for each position
    Object.keys(positionGroups).forEach(position => {
      const scores = positionGroups[position].sort((a, b) => a - b);
      
      players.forEach(player => {
        if (player.pprMetrics && player.position === position) {
          const rank = scores.indexOf(player.pprMetrics.score);
          player.pprMetrics.percentile = Math.round((rank / scores.length) * 100);
        }
      });
    });
  }
}

export const pprScoringService = new PPRScoringService();