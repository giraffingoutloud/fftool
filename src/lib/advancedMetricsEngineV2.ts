import {
  PlayerAdvanced,
  PlayerSeasonStats,
  TeamComposite,
  Position,
  WRAdvancedStats,
  RBAdvancedStats,
  QBAdvancedStats,
  MetricsAdjustmentV2,
  DepthChartEntry
} from '@/types';
import { getPlayerRole, getADPTierFromECR } from './depthChartsLoader';

/**
 * Advanced metrics engine for calculating player value adjustments based on
 * opportunity, efficiency, situation, and consistency scores. Uses position-specific
 * logic and integrates team metrics, player advanced stats, and depth charts.
 */
export class AdvancedMetricsEngineV2 {
  private totalAdjustmentCache = new Map<string, number>();
  
  constructor(
    private playerAdvanced: Map<string, PlayerAdvanced>,
    private playerStats: Map<string, PlayerSeasonStats>,
    private teamComposites: Map<string, TeamComposite>,
    private depthCharts: Map<string, DepthChartEntry>
  ) {}

  /**
   * Calculate comprehensive player adjustment based on multiple factors.
   * @param playerName - Player's full name
   * @param position - Player's position (QB/RB/WR/TE/DST/K)
   * @param team - Optional team abbreviation
   * @returns MetricsAdjustmentV2 with scores and confidence level
   */
  getPlayerAdjustment(
    playerName: string,
    position: Position,
    team?: string
  ): MetricsAdjustmentV2 {
    const key = this.normalizePlayerKey(playerName, position);
    
    const advanced = this.playerAdvanced.get(key);
    const stats = this.playerStats.get(key);
    const depthChart = this.depthCharts.get(key);
    const teamComposite = team ? this.teamComposites.get(team) : undefined;
    
    const factors: string[] = [];
    
    // Calculate component scores
    const opportunityScore = this.calculateOpportunityScore(
      position, advanced, stats, depthChart, teamComposite, factors
    );
    
    const efficiencyScore = this.calculateEfficiencyScore(
      position, advanced, stats, factors
    );
    
    const situationScore = this.calculateSituationScore(
      teamComposite, position, factors
    );
    
    const consistencyScore = this.calculateConsistencyScore(
      stats, position, factors
    );
    
    // Weights: 35% opportunity, 25% efficiency, 20% situation, 10% consistency, 10% base (1.0)
    const totalAdjustment = (
      opportunityScore * 0.35 +
      efficiencyScore * 0.25 +
      situationScore * 0.20 +
      consistencyScore * 0.10 +
      1.0 * 0.10
    );
    
    // Calculate confidence based on data availability
    const confidence = this.calculateConfidence(advanced, stats, depthChart, teamComposite);
    
    // Clamp to [0.7, 1.3]
    const clampedAdjustment = Math.max(0.7, Math.min(1.3, totalAdjustment));
    
    // Cache the total adjustment for quick lookup
    this.totalAdjustmentCache.set(key, clampedAdjustment);
    
    return {
      playerId: key,
      playerName,
      position,
      opportunityScore,
      efficiencyScore,
      situationScore,
      consistencyScore,
      totalAdjustment: clampedAdjustment,
      confidence,
      factors
    };
  }
  
  /**
   * Get cached total adjustment for a player by ID.
   * Returns undefined if not calculated yet.
   */
  getTotalAdjustmentForPlayer(playerId: string): number | undefined {
    return this.totalAdjustmentCache.get(playerId);
  }
  
  private calculateOpportunityScore(
    position: Position,
    advanced?: PlayerAdvanced,
    stats?: PlayerSeasonStats,
    depthChart?: DepthChartEntry,
    teamComposite?: TeamComposite,
    factors?: string[]
  ): number {
    let score = 1.0;
    let weightSum = 0;
    let componentSum = 0;
    
    // Depth chart role is critical for opportunity
    if (depthChart) {
      const role = getPlayerRole(depthChart.depthOrder, position);
      let roleScore = 1.0;
      
      if (role === 'starter') {
        roleScore = 1.15;
        factors?.push('Starter role (+15%)');
      } else if (role === 'backup') {
        roleScore = 0.85;
        factors?.push('Backup role (-15%)');
      } else {
        roleScore = 0.7;
        factors?.push('Depth player (-30%)');
      }
      
      componentSum += roleScore * 0.3;
      weightSum += 0.3;
    }
    
    // Position-specific opportunity metrics
    switch (position) {
      case 'WR':
      case 'TE': {
        const wrStats = advanced as WRAdvancedStats;
        
        // Target share is key for WR/TE
        if (wrStats?.targetShare !== undefined) {
          let targetScore = 1.0;
          if (wrStats.targetShare > 0.25) {
            targetScore = 1.2;
            factors?.push('Elite target share (>25%)');
          } else if (wrStats.targetShare > 0.20) {
            targetScore = 1.1;
            factors?.push('High target share (>20%)');
          } else if (wrStats.targetShare > 0.15) {
            targetScore = 1.0;
          } else {
            targetScore = 0.85;
            factors?.push('Low target share (<15%)');
          }
          componentSum += targetScore * 0.4;
          weightSum += 0.4;
        }
        
        // Red zone targets
        if (wrStats?.redZoneTargets !== undefined && wrStats.redZoneTargets > 0) {
          const rzScore = 1 + (Math.min(wrStats.redZoneTargets, 20) / 100);
          componentSum += rzScore * 0.2;
          weightSum += 0.2;
          if (wrStats.redZoneTargets > 10) {
            factors?.push('High RZ targets');
          }
        }
        
        // Team passing rate boosts WR/TE opportunity
        if (teamComposite?.paceIndex !== undefined) {
          const paceBoost = 1 + (teamComposite.paceIndex * 0.1);
          componentSum += paceBoost * 0.1;
          weightSum += 0.1;
        }
        break;
      }
      
      case 'RB': {
        const rbStats = advanced as RBAdvancedStats;
        
        // Touches per game is critical for RBs
        if (rbStats?.touchesPerGame !== undefined) {
          let touchScore = 1.0;
          if (rbStats.touchesPerGame > 20) {
            touchScore = 1.25;
            factors?.push('Workhorse back (20+ touches)');
          } else if (rbStats.touchesPerGame > 15) {
            touchScore = 1.1;
            factors?.push('Lead back (15+ touches)');
          } else if (rbStats.touchesPerGame > 10) {
            touchScore = 1.0;
          } else {
            touchScore = 0.8;
            factors?.push('Committee back (<10 touches)');
          }
          componentSum += touchScore * 0.5;
          weightSum += 0.5;
        } else if (stats) {
          // Fallback to calculating from stats
          const games = stats.games || 1;
          const touches = ((stats.rushingAttempts || 0) + (stats.receptions || 0)) / games;
          let touchScore = 1.0;
          if (touches > 20) touchScore = 1.25;
          else if (touches > 15) touchScore = 1.1;
          else if (touches < 10) touchScore = 0.8;
          componentSum += touchScore * 0.5;
          weightSum += 0.5;
        }
        
        // Red zone carries
        if (rbStats?.redZoneCarries !== undefined && rbStats.redZoneCarries > 0) {
          const rzScore = 1 + (Math.min(rbStats.redZoneCarries, 30) / 150);
          componentSum += rzScore * 0.2;
          weightSum += 0.2;
          if (rbStats.redZoneCarries > 20) {
            factors?.push('Goal line back');
          }
        }
        
        // Time of possession helps RBs
        if (teamComposite) {
          const topBoost = 1 + (teamComposite.sustainIndex * 0.05);
          componentSum += topBoost * 0.1;
          weightSum += 0.1;
        }
        break;
      }
      
      case 'QB': {
        const qbStats = advanced as QBAdvancedStats;
        
        // QB opportunity is largely about attempts and team pace
        if (stats?.passingYards !== undefined && stats.games) {
          const attemptsPerGame = (stats.passingYards / 7.5) / stats.games; // Estimate
          let volumeScore = 1.0;
          if (attemptsPerGame > 35) {
            volumeScore = 1.15;
            factors?.push('High volume passer');
          } else if (attemptsPerGame > 30) {
            volumeScore = 1.05;
          } else if (attemptsPerGame < 25) {
            volumeScore = 0.9;
            factors?.push('Low volume passer');
          }
          componentSum += volumeScore * 0.4;
          weightSum += 0.4;
        }
        
        // Team pace directly impacts QB opportunity
        if (teamComposite) {
          const paceBoost = 1 + (teamComposite.paceIndex * 0.15);
          componentSum += paceBoost * 0.3;
          weightSum += 0.3;
          
          const qualityBoost = 1 + (teamComposite.offenseQualityIndex * 0.1);
          componentSum += qualityBoost * 0.3;
          weightSum += 0.3;
        }
        break;
      }
    }
    
    // Return weighted average or 1.0 if no data
    return weightSum > 0 ? componentSum / weightSum : 1.0;
  }
  
  private calculateEfficiencyScore(
    position: Position,
    advanced?: PlayerAdvanced,
    stats?: PlayerSeasonStats,
    factors?: string[]
  ): number {
    let score = 1.0;
    let weightSum = 0;
    let componentSum = 0;
    
    switch (position) {
      case 'WR':
      case 'TE': {
        const wrStats = advanced as WRAdvancedStats;
        
        // Catch rate
        if (wrStats?.catchRate !== undefined) {
          let catchScore = 1.0;
          if (wrStats.catchRate > 0.75) {
            catchScore = 1.15;
            factors?.push('Elite catch rate (>75%)');
          } else if (wrStats.catchRate > 0.65) {
            catchScore = 1.05;
          } else if (wrStats.catchRate < 0.55) {
            catchScore = 0.9;
            factors?.push('Poor catch rate (<55%)');
          }
          componentSum += catchScore * 0.25;
          weightSum += 0.25;
        }
        
        // YAC ability
        if (wrStats?.yardsAfterCatchPerRec !== undefined) {
          let yacScore = 1.0;
          if (wrStats.yardsAfterCatchPerRec > 6) {
            yacScore = 1.1;
            factors?.push('Elite YAC ability');
          } else if (wrStats.yardsAfterCatchPerRec > 4) {
            yacScore = 1.05;
          } else if (wrStats.yardsAfterCatchPerRec < 3) {
            yacScore = 0.95;
          }
          componentSum += yacScore * 0.2;
          weightSum += 0.2;
        }
        
        // Separation
        if (wrStats?.separationYards !== undefined) {
          let sepScore = 1.0;
          if (wrStats.separationYards > 3) {
            sepScore = 1.12;
            factors?.push('Elite separation');
          } else if (wrStats.separationYards > 2) {
            sepScore = 1.05;
          } else if (wrStats.separationYards < 1.5) {
            sepScore = 0.92;
          }
          componentSum += sepScore * 0.2;
          weightSum += 0.2;
        }
        
        // FPTS per target efficiency
        if (stats?.fantasyPoints && wrStats?.targets && wrStats.targets > 0) {
          const fptsPerTarget = stats.fantasyPoints / wrStats.targets;
          let effScore = 1.0;
          if (fptsPerTarget > 2.0) {
            effScore = 1.15;
            factors?.push('Very efficient scorer');
          } else if (fptsPerTarget > 1.5) {
            effScore = 1.05;
          } else if (fptsPerTarget < 1.0) {
            effScore = 0.9;
          }
          componentSum += effScore * 0.35;
          weightSum += 0.35;
        }
        break;
      }
      
      case 'RB': {
        const rbStats = advanced as RBAdvancedStats;
        
        // Yards per carry
        if (rbStats?.yardsPerCarry !== undefined) {
          let ypcScore = 1.0;
          if (rbStats.yardsPerCarry > 5.0) {
            ypcScore = 1.15;
            factors?.push('Elite efficiency (>5.0 YPC)');
          } else if (rbStats.yardsPerCarry > 4.5) {
            ypcScore = 1.08;
          } else if (rbStats.yardsPerCarry > 4.0) {
            ypcScore = 1.0;
          } else {
            ypcScore = 0.9;
            factors?.push('Poor efficiency (<4.0 YPC)');
          }
          componentSum += ypcScore * 0.35;
          weightSum += 0.35;
        }
        
        // Yards after contact
        if (rbStats?.yardsAfterContact !== undefined) {
          let yacScore = 1.0;
          if (rbStats.yardsAfterContact > 3.5) {
            yacScore = 1.12;
            factors?.push('Elite contact balance');
          } else if (rbStats.yardsAfterContact > 2.8) {
            yacScore = 1.05;
          } else if (rbStats.yardsAfterContact < 2.0) {
            yacScore = 0.92;
          }
          componentSum += yacScore * 0.25;
          weightSum += 0.25;
        }
        
        // Broken tackles
        if (rbStats?.brokenTackles !== undefined && rbStats.rushingAttempts) {
          const btPerAttempt = rbStats.brokenTackles / rbStats.rushingAttempts;
          let btScore = 1.0;
          if (btPerAttempt > 0.2) {
            btScore = 1.1;
            factors?.push('Tackle-breaking ability');
          } else if (btPerAttempt > 0.15) {
            btScore = 1.05;
          } else if (btPerAttempt < 0.08) {
            btScore = 0.95;
          }
          componentSum += btScore * 0.15;
          weightSum += 0.15;
        }
        
        // Overall efficiency from FPTS
        if (stats?.fantasyPointsPerGame) {
          let fpgScore = 1.0;
          if (stats.fantasyPointsPerGame > 15) {
            fpgScore = 1.1;
          } else if (stats.fantasyPointsPerGame > 12) {
            fpgScore = 1.05;
          } else if (stats.fantasyPointsPerGame < 8) {
            fpgScore = 0.9;
          }
          componentSum += fpgScore * 0.25;
          weightSum += 0.25;
        }
        break;
      }
      
      case 'QB': {
        const qbStats = advanced as QBAdvancedStats;
        
        // TD rate
        if (qbStats?.tdRate !== undefined) {
          let tdScore = 1.0;
          if (qbStats.tdRate > 0.06) {
            tdScore = 1.18;
            factors?.push('Elite TD rate (>6%)');
          } else if (qbStats.tdRate > 0.05) {
            tdScore = 1.08;
          } else if (qbStats.tdRate > 0.04) {
            tdScore = 1.0;
          } else {
            tdScore = 0.88;
            factors?.push('Low TD rate (<4%)');
          }
          componentSum += tdScore * 0.35;
          weightSum += 0.35;
        }
        
        // Yards per attempt
        if (qbStats?.yardsPerAttempt !== undefined) {
          let ypaScore = 1.0;
          if (qbStats.yardsPerAttempt > 8.0) {
            ypaScore = 1.12;
            factors?.push('Elite Y/A (>8.0)');
          } else if (qbStats.yardsPerAttempt > 7.5) {
            ypaScore = 1.06;
          } else if (qbStats.yardsPerAttempt < 6.5) {
            ypaScore = 0.92;
          }
          componentSum += ypaScore * 0.25;
          weightSum += 0.25;
        }
        
        // Completion percentage
        if (qbStats?.completionPct !== undefined) {
          let compScore = 1.0;
          if (qbStats.completionPct > 0.68) {
            compScore = 1.08;
            factors?.push('High completion % (>68%)');
          } else if (qbStats.completionPct > 0.64) {
            compScore = 1.02;
          } else if (qbStats.completionPct < 0.60) {
            compScore = 0.95;
          }
          componentSum += compScore * 0.2;
          weightSum += 0.2;
        }
        
        // Pressure handling (negative factor)
        if (qbStats?.pressureRate !== undefined) {
          let pressureScore = 1.0;
          if (qbStats.pressureRate > 0.35) {
            pressureScore = 0.92;
            factors?.push('Under heavy pressure');
          } else if (qbStats.pressureRate < 0.25) {
            pressureScore = 1.05;
            factors?.push('Well protected');
          }
          componentSum += pressureScore * 0.2;
          weightSum += 0.2;
        }
        break;
      }
    }
    
    return weightSum > 0 ? componentSum / weightSum : 1.0;
  }
  
  private calculateSituationScore(
    teamComposite?: TeamComposite,
    position?: Position,
    factors?: string[]
  ): number {
    if (!teamComposite) return 1.0;
    
    let score = 1.0;
    let weightSum = 0;
    let componentSum = 0;
    
    // Offense quality impacts all positions
    if (teamComposite.offenseQualityIndex !== undefined) {
      let qualityScore = 1.0;
      if (teamComposite.offenseQualityIndex > 1.0) {
        qualityScore = 1.15;
        factors?.push('Elite offense');
      } else if (teamComposite.offenseQualityIndex > 0.5) {
        qualityScore = 1.08;
        factors?.push('Above-average offense');
      } else if (teamComposite.offenseQualityIndex > -0.5) {
        qualityScore = 1.0;
      } else {
        qualityScore = 0.88;
        factors?.push('Below-average offense');
      }
      componentSum += qualityScore * 0.35;
      weightSum += 0.35;
    }
    
    // Red zone efficiency
    if (teamComposite.redZoneIndex !== undefined) {
      let rzScore = 1.0;
      if (teamComposite.redZoneIndex > 0.5) {
        rzScore = 1.1;
        factors?.push('High RZ efficiency');
      } else if (teamComposite.redZoneIndex > 0) {
        rzScore = 1.03;
      } else if (teamComposite.redZoneIndex < -0.5) {
        rzScore = 0.93;
      }
      componentSum += rzScore * 0.25;
      weightSum += 0.25;
    }
    
    // Game script (environment)
    if (teamComposite.environmentIndex !== undefined) {
      let envScore = 1.0;
      if (teamComposite.environmentIndex > 0.5) {
        // Positive game scripts help RBs more
        if (position === 'RB') {
          envScore = 1.12;
          factors?.push('Positive game scripts');
        } else {
          envScore = 1.05;
        }
      } else if (teamComposite.environmentIndex < -0.5) {
        // Negative game scripts help pass catchers
        if (position === 'WR' || position === 'TE') {
          envScore = 1.08;
          factors?.push('Pass-heavy game scripts');
        } else if (position === 'RB') {
          envScore = 0.92;
          factors?.push('Negative game scripts');
        }
      }
      componentSum += envScore * 0.2;
      weightSum += 0.2;
    }
    
    // Pace helps everyone but especially QBs and WRs
    if (teamComposite.paceIndex !== undefined) {
      let paceScore = 1.0;
      if (teamComposite.paceIndex > 0.5) {
        paceScore = position === 'QB' || position === 'WR' ? 1.08 : 1.04;
        factors?.push('Fast-paced offense');
      } else if (teamComposite.paceIndex < -0.5) {
        paceScore = 0.96;
        factors?.push('Slow-paced offense');
      }
      componentSum += paceScore * 0.2;
      weightSum += 0.2;
    }
    
    return weightSum > 0 ? componentSum / weightSum : 1.0;
  }
  
  private calculateConsistencyScore(
    stats?: PlayerSeasonStats,
    position?: Position,
    factors?: string[]
  ): number {
    if (!stats || !stats.games || !stats.fantasyPointsPerGame) return 1.0;
    
    // Simple consistency based on games played and scoring
    let score = 1.0;
    
    // Games played indicates health/reliability
    if (stats.games >= 16) {
      score *= 1.08;
      factors?.push('Durable (16+ games)');
    } else if (stats.games >= 14) {
      score *= 1.03;
    } else if (stats.games < 10) {
      score *= 0.92;
      factors?.push('Injury concerns (<10 games)');
    }
    
    // Consistent scoring (using coefficient of variation proxy)
    // Higher PPG generally means more consistent
    const ppg = stats.fantasyPointsPerGame;
    if (ppg > 15) {
      score *= 1.05;
      factors?.push('Consistent producer');
    } else if (ppg > 10) {
      score *= 1.02;
    } else if (ppg < 7) {
      score *= 0.95;
    }
    
    return score;
  }
  
  private calculateConfidence(
    advanced?: PlayerAdvanced,
    stats?: PlayerSeasonStats,
    depthChart?: DepthChartEntry,
    teamComposite?: TeamComposite
  ): number {
    let confidence = 0.5; // Base confidence
    
    // Each data source adds confidence
    if (advanced) confidence += 0.15;
    if (stats && stats.games && stats.games > 8) confidence += 0.15;
    if (depthChart) confidence += 0.10;
    if (teamComposite) confidence += 0.10;
    
    return Math.min(0.95, confidence);
  }
  
  private normalizePlayerKey(name: string, position: string): string {
    return `${name.toLowerCase().trim()}_${position}`;
  }
}