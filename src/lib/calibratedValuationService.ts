/**
 * Service layer for the calibrated valuation model
 * Provides integration with the React app
 */

import { CalibratedValuationModel, type PlayerData } from './calibratedValuationModel';
import type { PlayerProjection } from '@/types';

export interface ValuationResult {
  // Core identification
  id: string;
  playerId: string;
  playerName: string;
  name: string; // Alias for playerName for compatibility
  position: string;
  team: string;
  
  // Valuation metrics
  projectedPoints: number;
  points: number; // Alias for projectedPoints
  positionRank: number;
  vbd: number;
  vorp?: number; // Alias for vbd
  
  // Pricing
  auctionValue: number;
  value: number; // Alias for auctionValue (max bid)
  marketPrice: number;
  marketValue: number; // Alias for marketPrice
  edge: number;
  intrinsicValue?: number; // Calculated fair value
  
  // Confidence and tiers
  confidence: number;
  tier: 'elite' | 'tier1' | 'tier2' | 'tier3' | 'replacement';
  minBid: number;
  targetBid: number;
  maxBid: number;
  
  // Additional data
  rank?: number; // Overall rank
  adp?: number; // Average draft position
  byeWeek?: number;
  teamSeasonSOS?: number; // Strength of schedule
  age?: number;
  isRookie?: boolean;
  injuryStatus?: 'Q' | 'D' | 'O' | 'IR' | 'PUP' | 'SUS' | null;
  
  // PPR-related stats (optional - used for PPR scoring display only)
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

export interface ValuationSummary {
  totalValue: number;
  budgetPercentage: number;
  positionDistribution: {
    QB: number;
    RB: number;
    WR: number;
    TE: number;
    DST: number;
    K: number;
  };
  topValuesByPosition: Map<string, ValuationResult[]>;
  replacementLevels: Map<string, number>;
  tierCounts: Map<string, number>;
}

class CalibratedValuationService {
  private model: CalibratedValuationModel;
  private lastValuations: ValuationResult[] = [];
  private lastSummary: ValuationSummary | null = null;

  constructor() {
    this.model = new CalibratedValuationModel();
  }

  /**
   * Process players and generate comprehensive valuations
   */
  processPlayers(
    projections: PlayerProjection[],
    adpData?: any[],
    sosData?: Map<string, number>,
    advancedStats?: Map<string, any>
  ): { valuations: ValuationResult[]; summary: ValuationSummary } {
    
    // Convert projections to PlayerData format
    const players: PlayerData[] = projections.map((proj, index) => {
      // Normalize position to uppercase for comparison
      const normalizedPosition = proj.position?.toUpperCase() || '';
      
      // Find matching ADP data
      const adpEntry = adpData?.find(
        adp =>
          adp.name?.toLowerCase().replace(/[^a-z]/g, '') ===
            proj.name?.toLowerCase().replace(/[^a-z]/g, '') &&
          (adp.position?.toUpperCase() || '') === normalizedPosition
      );

      // Calculate position rank based on points within position
      const positionPlayers = projections.filter(
        p => (p.position?.toUpperCase() || '') === normalizedPosition
      );
      positionPlayers.sort((a, b) => (b.projectedPoints || 0) - (a.projectedPoints || 0));
      const positionRank = positionPlayers.findIndex(
        p => p.name === proj.name && p.team === proj.team
      ) + 1;

      return {
        id: proj.id || `player-${index}`,
        name: proj.name,
        position: normalizedPosition, // Use normalized position
        team: proj.team || '',
        projectedPoints: proj.projectedPoints || 0,
        adp: adpEntry?.adp || 250,
        positionRank
      };
    });

    // Process through calibrated model
    const result = this.model.processAllPlayers(players);
    
    
    // Convert to ValuationResult format with enhanced data
    const valuations: ValuationResult[] = result.valuations.map((val, idx) => {
      // Find original projection data for additional fields
      const originalProj = projections.find(
        p => p.name === val.playerName && p.team === val.team && p.position === val.position
      );
      
      // Find matching ADP data for additional fields
      const adpEntry = adpData?.find(
        adp =>
          adp.name?.toLowerCase().replace(/[^a-z]/g, '') ===
            val.playerName?.toLowerCase().replace(/[^a-z]/g, '') &&
          adp.position === val.position
      );
      
      // Determine tier based on position rank and value
      let tier: ValuationResult['tier'] = 'replacement';
      if (val.positionRank <= 3) {
        tier = 'elite';
      } else if (val.positionRank <= 8) {
        tier = 'tier1';
      } else if (val.positionRank <= 20) {
        tier = 'tier2';
      } else if (val.auctionValue > 5) {
        tier = 'tier3';
      }

      // Use actual market price (AAV) from ADP data if available
      // This is the REAL market consensus, not a calculated value
      let marketPrice: number;
      
      // Check if we have actual AAV data from the ADP entry
      if (adpEntry?.auctionValue && adpEntry.auctionValue > 1) {
        // Use the actual Average Auction Value from market data
        marketPrice = adpEntry.auctionValue;
      } else {
        // If no market data, estimate conservatively based on our valuation
        // Most undrafted players go for $1-2
        marketPrice = Math.min(2, Math.max(1, Math.round(val.auctionValue * 0.5)));
      }
      
      // Calculate edge (value - market price)
      const edge = val.auctionValue - marketPrice;
      
      // Calculate intrinsic value (theoretical fair value)
      const intrinsicValue = val.auctionValue; // Use model's calculated value as intrinsic

      // Get advanced stats for PPR scoring
      // Try multiple key formats since advanced stats are keyed by name_position
      const namePositionKey = `${val.playerName.toLowerCase()}_${val.position.toLowerCase()}`;
      const nameTeamKey = `${val.playerName}_${val.team}`.toLowerCase();
      const nameOnlyKey = val.playerName.toLowerCase();
      
      const advanced = advancedStats?.get(namePositionKey) || 
                      advancedStats?.get(nameTeamKey) || 
                      advancedStats?.get(nameOnlyKey);

      return {
        // Core identification
        id: val.playerId,
        playerId: val.playerId,
        playerName: val.playerName,
        name: val.playerName, // Alias for compatibility
        position: val.position,
        team: val.team,
        
        // Valuation metrics
        projectedPoints: val.projectedPoints,
        points: val.projectedPoints, // Alias
        positionRank: val.positionRank,
        vbd: val.vbd,
        vorp: val.vbd, // Alias
        
        // Pricing
        auctionValue: val.auctionValue,
        value: val.maxBid, // Max bid for table display
        marketPrice: Math.max(1, marketPrice),
        marketValue: Math.max(1, marketPrice), // Alias
        edge,
        intrinsicValue,
        
        // Confidence and tiers
        confidence: val.confidence,
        tier,
        minBid: val.minBid,
        targetBid: val.targetBid,
        maxBid: val.maxBid,
        
        // Additional data from original sources
        rank: idx + 1, // Overall rank based on value
        adp: adpEntry?.adp || val.adp,
        byeWeek: originalProj?.byeWeek || adpEntry?.byeWeek,
        teamSeasonSOS: originalProj?.teamSeasonSOS,
        age: originalProj?.age || adpEntry?.age,
        isRookie: originalProj?.isRookie || adpEntry?.isRookie,
        injuryStatus: originalProj?.injuryStatus,
        
        // PPR-related stats from advanced data
        targets: advanced?.targets || 0,
        receptions: advanced?.receptions || originalProj?.receptions || 0,
        games: originalProj?.games || 16,
        teamTargets: advanced?.teamTargets,
        catchableTargets: advanced?.catchableTargets,
        yardsPerRouteRun: advanced?.yardsPerRouteRun,
        redZoneTargets: advanced?.redZoneTargets,
        routesRun: advanced?.routesRun,
        teamPassPlays: advanced?.teamPassPlays,
        receivingYards: advanced?.receivingYards || originalProj?.receivingYards || 0,
        teamReceivingYards: advanced?.teamReceivingYards,
        dropRate: advanced?.dropRate,
        targetShare: advanced?.targetShare,
        catchRate: advanced?.catchRate
      };
    });

    
    // Calculate summary statistics
    const summary = this.calculateSummary(valuations, result);
    
    // Cache results
    this.lastValuations = valuations;
    this.lastSummary = summary;

    return { valuations, summary };
  }

  /**
   * Calculate summary statistics
   */
  private calculateSummary(
    valuations: ValuationResult[],
    modelResult: any
  ): ValuationSummary {
    // Get top 192 players (12 teams × 16 roster spots)
    const topPlayers = valuations
      .sort((a, b) => b.auctionValue - a.auctionValue)
      .slice(0, 192);

    const totalValue = topPlayers.reduce((sum, p) => sum + p.auctionValue, 0);
    const budgetPercentage = (totalValue / 2400) * 100;

    // Calculate position distribution
    const positionValues = new Map<string, number>();
    const positionCounts = new Map<string, number>();
    
    const starterCounts = {
      QB: 12,
      RB: 30,
      WR: 36,
      TE: 12,
      DST: 12,
      K: 12
    };

    Object.entries(starterCounts).forEach(([pos, count]) => {
      const posPlayers = valuations
        .filter(p => p.position === pos)
        .sort((a, b) => b.auctionValue - a.auctionValue)
        .slice(0, count);
      
      const total = posPlayers.reduce((sum, p) => sum + p.auctionValue, 0);
      positionValues.set(pos, total);
    });

    const totalStarterValue = Array.from(positionValues.values()).reduce(
      (sum, val) => sum + val,
      0
    );

    const positionDistribution = {
      QB: (positionValues.get('QB') || 0) / totalStarterValue,
      RB: (positionValues.get('RB') || 0) / totalStarterValue,
      WR: (positionValues.get('WR') || 0) / totalStarterValue,
      TE: (positionValues.get('TE') || 0) / totalStarterValue,
      DST: (positionValues.get('DST') || 0) / totalStarterValue,
      K: (positionValues.get('K') || 0) / totalStarterValue
    };

    // Get top values by position
    const topValuesByPosition = new Map<string, ValuationResult[]>();
    ['QB', 'RB', 'WR', 'TE', 'DST', 'K'].forEach(pos => {
      const top = valuations
        .filter(p => p.position === pos)
        .sort((a, b) => b.auctionValue - a.auctionValue)
        .slice(0, 10);
      topValuesByPosition.set(pos, top);
    });

    // Get replacement levels from model
    const replacementLevels = new Map(modelResult.replacementLevels);

    // Count tiers
    const tierCounts = new Map<string, number>();
    valuations.forEach(v => {
      tierCounts.set(v.tier, (tierCounts.get(v.tier) || 0) + 1);
    });

    return {
      totalValue,
      budgetPercentage,
      positionDistribution,
      topValuesByPosition,
      replacementLevels,
      tierCounts
    };
  }

  /**
   * Get last calculated valuations
   */
  getLastValuations(): ValuationResult[] {
    return this.lastValuations;
  }

  /**
   * Get last calculated summary
   */
  getLastSummary(): ValuationSummary | null {
    return this.lastSummary;
  }

  /**
   * Update a single player's market price (for draft tracking)
   */
  updateMarketPrice(playerId: string, actualPrice: number): void {
    const player = this.lastValuations.find(v => v.playerId === playerId);
    if (player) {
      player.marketPrice = actualPrice;
      player.edge = player.auctionValue - actualPrice;
    }
  }
}

export const calibratedValuationService = new CalibratedValuationService();