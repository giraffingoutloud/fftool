export type Position = 'QB' | 'RB' | 'WR' | 'TE' | 'DST' | 'K';
export type TeamCode = 'ARI' | 'ATL' | 'BAL' | 'BUF' | 'CAR' | 'CHI' | 'CIN' | 'CLE' | 
  'DAL' | 'DEN' | 'DET' | 'GB' | 'HOU' | 'IND' | 'JAC' | 'KC' | 'LAC' | 'LAR' | 
  'LV' | 'MIA' | 'MIN' | 'NE' | 'NO' | 'NYG' | 'NYJ' | 'PHI' | 'PIT' | 'SF' | 
  'SEA' | 'TB' | 'TEN' | 'WAS';

export interface Player {
  id: string;
  name: string;
  team: string;
  position: Position;
  age?: number;
  byeWeek?: number;
  injuryStatus?: 'Q' | 'D' | 'O' | 'IR' | 'PUP' | 'SUS' | null;
  isRookie?: boolean;
  height?: string; // e.g., "6'2"" 
  weight?: number; // in pounds
  college?: string;
  draftYear?: number;
  draftRound?: number;
  draftPick?: number;
  teamSeasonSOS?: number; // Season strength of schedule
  teamPlayoffSOS?: number; // Playoff strength of schedule (weeks 15-17)
}

export interface PlayerProjection extends Player {
  projectedPoints: number;
  weeklyProjections?: number[];
  floorPoints?: number;
  ceilingPoints?: number;
  standardDeviation?: number;
  confidence?: number;
}

export interface PlayerADP extends Player {
  adp?: number; // Made optional to properly handle missing ADP values
  adpRank: number;
  positionRank: number;
  auctionValue?: number;
  draftedPercentage?: number;
  bestPick?: number;
  worstPick?: number;
  standardDeviation?: number;
  fantasyScore?: number; // Historical fantasy score from previous season
  adpSources?: { source: string; value: number }[]; // Track ADP from multiple sources
}

export interface PlayerStats extends Player {
  gamesPlayed?: number;
  passingYards?: number;
  passingTDs?: number;
  interceptions?: number;
  rushingYards?: number;
  rushingTDs?: number;
  receptions?: number;
  receivingYards?: number;
  receivingTDs?: number;
  fantasyPoints?: number;
  fantasyPointsPerGame?: number;
}

export interface PlayerAdvancedStats extends Player {
  pffGrade?: number;
  snapCount?: number;
  snapPercentage?: number;
  targetShare?: number;
  redZoneTargets?: number;
  yardsAfterCatch?: number;
  separationYards?: number;
  catchRate?: number;
}

export interface TeamData {
  team: string;
  powerRating?: number;
  strengthOfSchedule?: number;
  offensiveRank?: number;
  defensiveRank?: number;
  pointsPerGame?: number;
  yardsPerPlay?: number;
  redZoneEfficiency?: number;
  timeOfPossession?: number;
}

export interface DraftPick {
  player: Player;
  price: number;
  team: string;
  timestamp: number;
  nomination?: boolean;
}

export interface RosterSlot {
  position: 'QB' | 'RB' | 'WR' | 'TE' | 'FLEX' | 'DST' | 'K' | 'BE';
  player?: Player;
  required: number;
}

export interface Team {
  id: string;
  name: string;
  budget: number;
  spent: number;
  roster: DraftPick[];
  maxBid: number;
}

export interface LeagueSettings {
  teams: number;
  budget: number;
  scoring: 'PPR' | 'HALF_PPR' | 'STANDARD';
  rosterPositions: RosterSlot[];
}

export interface PlayerValuation extends PlayerProjection {
  intrinsicValue: number;
  marketPrice: number;
  edge: number;
  confidence: number;
  vorp: number;
  replacementLevel: number;
  recommendation: 'STRONG_BUY' | 'BUY' | 'FAIR' | 'PASS' | 'AVOID';
  maxBid: number;
  minBid: number;
}

export interface PriceFeatures {
  logAAV: number;
  adpTier: number;
  moneyPerStarter: number;
  inflationState: number;
  nominationEffect: number;
  daysToSeason: number;
  positionScarcity: number;
  recentTrend: number;
}

export interface EdgeContext {
  baseEdge: number;
  rosterAdjustment: number;
  confidenceAdjustment: number;
  valueOfWaiting: number;
  finalEdge: number;
  recommendation: PlayerValuation['recommendation'];
  bidRange: { min: number; max: number };
}

export interface RosterNeeds {
  criticalNeeds: Set<Position | 'FLEX'>;
  moderateNeeds: Set<Position>;
  overfilled: Set<Position>;
  filled: Set<Position>;
}

// Team Metrics from canonical_data
export interface TeamMetrics {
  team: string;
  pointsPerPlay?: number;
  pointsPerGame?: number;
  playsPerGame?: number;
  offensiveTDsPerGame?: number;
  yardsPerPlay?: number;
  touchdownsPerGame?: number;
  secondsPerPlay?: number;
  timeOfPossessionPct?: number;
  thirdDownConvPct?: number;
  fourthDownConvPct?: number;
  firstDownsPerGame?: number;
  redZoneTDsPerGame?: number;
  redZoneTDScoringPct?: number;
  redZoneAttemptsPerGame?: number;
  scoringMargin?: number;
  pointsPerPlayMargin?: number;
  // Trend windows
  last3?: {
    pointsPerPlay?: number;
    pointsPerGame?: number;
    yardsPerPlay?: number;
  };
  last1?: {
    pointsPerPlay?: number;
    pointsPerGame?: number;
    yardsPerPlay?: number;
  };
  // Splits
  home?: {
    pointsPerPlay?: number;
    pointsPerGame?: number;
    yardsPerPlay?: number;
  };
  away?: {
    pointsPerPlay?: number;
    pointsPerGame?: number;
    yardsPerPlay?: number;
  };
}

export interface TeamComposite {
  team: string;
  offenseQualityIndex: number;
  paceIndex: number;
  redZoneIndex: number;
  sustainIndex: number;
  environmentIndex: number;
  trendIndex: number;
}

// Player Advanced Stats (position-specific)
export interface WRAdvancedStats {
  name: string;
  team: string;
  targetShare?: number;
  catchRate?: number;
  yardsAfterCatch?: number;
  yardsAfterCatchPerRec?: number;
  separationYards?: number;
  drops?: number;
  redZoneTargets?: number;
  airYards?: number;
  yardsBeforeContact?: number;
  targets?: number;
  receptions?: number;
}

export interface RBAdvancedStats {
  name: string;
  team: string;
  yardsPerCarry?: number;
  yardsBeforeContact?: number;
  yardsAfterContact?: number;
  brokenTackles?: number;
  touchesPerGame?: number;
  targetShare?: number;
  rushingAttempts?: number;
  targets?: number;
  receptions?: number;
  redZoneCarries?: number;
}

export interface TEAdvancedStats extends WRAdvancedStats {}

export interface QBAdvancedStats {
  name: string;
  team: string;
  tdRate?: number;
  yardsPerAttempt?: number;
  airYardsPerAttempt?: number;
  completionPct?: number;
  pressureRate?: number;
  knockdownRate?: number;
  hurryRate?: number;
  pocketTime?: number;
  blitzesVs?: number;
}

export type PlayerAdvanced = WRAdvancedStats | RBAdvancedStats | TEAdvancedStats | QBAdvancedStats;

// Player Season Stats (position-specific)
export interface PlayerSeasonStats {
  name: string;
  team: string;
  position: Position;
  games?: number;
  fantasyPoints?: number;
  fantasyPointsPerGame?: number;
  passingYards?: number;
  passingTDs?: number;
  interceptions?: number;
  rushingYards?: number;
  rushingTDs?: number;
  rushingAttempts?: number;
  receptions?: number;
  targets?: number;
  receivingYards?: number;
  receivingTDs?: number;
}

// Depth Chart
export interface DepthChartEntry {
  team: string;
  position: Position;
  name: string;
  ecr: number;
  depthOrder: number;
}

export interface DepthChartTeam {
  team: string;
  QB: DepthChartEntry[];
  RB: DepthChartEntry[];
  WR: DepthChartEntry[];
  TE: DepthChartEntry[];
  DST?: DepthChartEntry[];
  K?: DepthChartEntry[];
}

// Metrics Adjustment V2
export interface MetricsAdjustmentV2 {
  playerId: string;
  playerName: string;
  position: Position;
  opportunityScore: number;
  efficiencyScore: number;
  situationScore: number;
  consistencyScore: number;
  totalAdjustment: number;
  confidence: number;
  factors: string[];
}