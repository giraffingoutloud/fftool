import React, { useMemo } from 'react';
import { 
  X, 
  TrendingUp, 
  Award, 
  BarChart3, 
  DollarSign, 
  Target,
  Calendar,
  Activity,
  AlertCircle,
  CheckCircle,
  Zap,
  Users,
  Shield,
  ChevronRight
} from 'lucide-react';
import { useDraftStore } from '@/store/draftStore';
import type { ValuationResult } from '@/lib/calibratedValuationService';
import type { Player, Position } from '@/types';
import BidAdvisorEnhanced from './BidAdvisorEnhanced';
import { pprScoringService } from '@/lib/pprScoringService';
import { bidAdvisorService } from '@/lib/bidAdvisorService';

interface PlayerDetailPanelProps {
  player: ValuationResult | null;
  allPlayers?: ValuationResult[];
  onClose?: () => void;
}

const PlayerDetailPanel: React.FC<PlayerDetailPanelProps> = ({ 
  player, 
  allPlayers = [],
  onClose
}) => {
  const { completeAuction, myTeamId, draftHistory, teams } = useDraftStore();

  // Calculate PPR metrics - must be before any early returns due to React hooks rules
  const pprMetrics = useMemo(() => {
    if (!player) return null;
    
    // Map ValuationResult data to PPR service format
    const playerStats = {
      position: player.position,
      targets: player.targets,
      receptions: player.receptions,
      games: player.games || 16, // Default to 16 if not provided
      teamTargets: player.teamTargets,
      catchableTargets: player.catchableTargets || player.targets, // Fallback to targets
      yardsPerRouteRun: player.yardsPerRouteRun,
      redZoneTargets: player.redZoneTargets,
      routesRun: player.routesRun,
      teamPassPlays: player.teamPassPlays,
      receivingYards: player.receivingYards,
      teamReceivingYards: player.teamReceivingYards,
      dropRate: player.dropRate
    };
    
    return pprScoringService.calculatePPRScore(playerStats);
  }, [player]);

  // Calculate market inflation using the same logic as BidAdvisorEnhanced
  const marketInflation = useMemo(() => {
    if (!player) return 0;
    
    const foundTeam = teams.find(t => t.id === myTeamId);
    const myPlayers = foundTeam?.roster?.map(pick => pick.player) || [];
    const remainingBudget = foundTeam ? (foundTeam.budget - foundTeam.spent) : 200;
    
    const myTeam = {
      id: foundTeam?.id || myTeamId || 'team_0',
      name: foundTeam?.name || 'My Team',
      budget: remainingBudget,
      players: myPlayers,
      isUser: true,
      maxBid: foundTeam?.maxBid || remainingBudget,
      nominations: 0
    };

    const convertedTeams = teams.map(t => ({
      id: t.id,
      name: t.name,
      budget: t.budget - t.spent,
      players: t.roster?.map(pick => pick.player) || [],
      isUser: t.id === myTeamId,
      maxBid: t.maxBid || (t.budget - t.spent),
      nominations: 0
    }));
    
    const draftedIds = new Set(
      draftHistory.map(pick => pick.player?.id || (pick.player as any)?.playerId).filter(Boolean)
    );
    
    const availablePlayers = allPlayers.filter(p => {
      const playerId = p.playerId || p.id;
      return !draftedIds.has(playerId);
    });

    const context = {
      myTeam,
      allTeams: convertedTeams.length > 0 ? convertedTeams : [myTeam],
      draftHistory: draftHistory || [],
      availablePlayers,
      currentBid: 0,
      totalBudget: 200,
      rosterRequirements: {
        QB: { min: 1, max: 2, optimal: 1 },
        RB: { min: 2, max: 6, optimal: 4 },
        WR: { min: 2, max: 6, optimal: 4 },
        TE: { min: 1, max: 3, optimal: 2 },
        DST: { min: 1, max: 2, optimal: 1 },
        K: { min: 1, max: 2, optimal: 1 },
        FLEX: { count: 1, eligiblePositions: ['RB', 'WR', 'TE'] },
        BENCH: 6
      }
    };

    const recommendation = bidAdvisorService.getRecommendation(player, context, 0);
    return recommendation.marketInflation;
  }, [player, teams, myTeamId, draftHistory, allPlayers]);

  if (!player) {
    return (
      <div className="bg-gray-900/80 backdrop-blur-sm border border-gray-700/50 rounded-xl p-3">
        <div className="flex items-center justify-center gap-3 text-gray-500">
          <Target className="w-5 h-5 opacity-40" />
          <div>
            <p className="text-sm font-medium">No Player Selected</p>
            <p className="text-xs opacity-75">Search or click the eye icon on any player</p>
          </div>
        </div>
      </div>
    );
  }

  const handleDraft = (price: number, teamId: string) => {
    const playerData: Player = {
      id: player.playerId,
      name: player.playerName,
      position: player.position as Position,
      team: player.team,
      playerId: player.playerId,
      projectedPoints: player.projectedPoints || 0,
      auctionValue: player.auctionValue || 0,
      marketValue: player.marketValue || 0,
      vorp: player.vorp || 0,
      tier: player.tier || 'replacement'
    };
    completeAuction(playerData, price, teamId);
    
    // Close the panel after drafting
    if (onClose) {
      onClose();
    }
  };

  // Get position color
  const getPositionColor = () => {
    const colors: Record<string, string> = {
      QB: 'bg-red-500/20 text-red-400 border-red-500/30',
      RB: 'bg-green-500/20 text-green-400 border-green-500/30',
      WR: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      TE: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      DST: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      K: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
    };
    return colors[player.position] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  };

  // Get tier badge
  const getTierBadge = () => {
    const tierMap: Record<string, { label: string; color: string }> = {
      elite: { label: 'ELITE', color: 'bg-gradient-to-r from-purple-600 to-pink-600 text-white' },
      tier1: { label: 'T1', color: 'bg-blue-600 text-white' },
      tier2: { label: 'T2', color: 'bg-green-600 text-white' },
      tier3: { label: 'T3', color: 'bg-yellow-600 text-white' },
      replacement: { label: 'REP', color: 'bg-gray-600 text-gray-300' }
    };
    const tier = tierMap[player.tier] || tierMap.replacement;
    return tier;
  };

  // Get recommendation
  const getRecommendation = () => {
    if (!player.edge) return { text: 'HOLD', color: 'text-gray-400', bg: 'bg-gray-800', icon: <AlertCircle className="w-3 h-3" /> };
    if (player.edge > 10) return { text: 'STRONG BUY', color: 'text-green-400', bg: 'bg-green-900/30', icon: <CheckCircle className="w-3 h-3" /> };
    if (player.edge > 5) return { text: 'BUY', color: 'text-green-300', bg: 'bg-green-900/20', icon: <TrendingUp className="w-3 h-3" /> };
    if (player.edge > 0) return { text: 'VALUE', color: 'text-yellow-300', bg: 'bg-yellow-900/20', icon: <Zap className="w-3 h-3" /> };
    if (player.edge > -5) return { text: 'FAIR', color: 'text-gray-300', bg: 'bg-gray-800', icon: <Activity className="w-3 h-3" /> };
    return { text: 'AVOID', color: 'text-red-400', bg: 'bg-red-900/20', icon: <X className="w-3 h-3" /> };
  };

  const recommendation = getRecommendation();
  const tier = getTierBadge();
  const edgePercent = player.edge && player.marketValue 
    ? ((player.edge / player.marketValue) * 100).toFixed(0) 
    : '0';


  return (
    <div className="bg-gray-900/90 backdrop-blur-md border border-gray-700/50 rounded-xl overflow-hidden shadow-2xl">
      {/* Compact Header Bar with All Valuation Info */}
      <div className="bg-gradient-to-r from-gray-800 to-gray-850 px-4 py-2.5 border-b border-gray-700/50">
        <div className="flex items-center justify-between gap-3">
          {/* Left: Player Identity */}
          <div className="flex items-center gap-3">
            <div className={`px-2 py-1 rounded text-lg font-bold border-2 ${getPositionColor()}`}>
              {player.position}
            </div>
            <h2 className="text-2xl font-bold text-white">{player.playerName}</h2>
            <span className="text-gray-400 text-xl">{player.team}</span>
            <div className={`px-3 py-1.5 rounded text-lg font-bold ${tier.color}`}>
              {tier.label}
            </div>
            <div className={`flex items-center gap-1 px-3 py-1 rounded-full ${recommendation.bg} ${recommendation.color}`}>
              {recommendation.icon}
              <span className="text-sm font-semibold">{recommendation.text}</span>
            </div>
          </div>

          {/* Center: Budget, Valuation Metrics, and Draft Progress */}
          <div className="flex items-center gap-4">
            {/* Budget Info */}
            {(() => {
              const myTeam = teams.find(t => t.id === myTeamId);
              const myBudget = myTeam ? (myTeam.budget - myTeam.spent) : 200;
              // Calculate average of OPPONENT teams only (excluding my team)
              const opponentTeams = teams.filter(t => t.id !== myTeamId);
              const avgOpponentBudget = opponentTeams.length > 0 
                ? Math.round(opponentTeams.reduce((sum, t) => sum + (t.budget - t.spent), 0) / opponentTeams.length)
                : 200;
              
              // Calculate difference for additional context
              const budgetDiff = myBudget - avgOpponentBudget;
              
              return (
                <div className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-green-400" />
                  <div>
                    <div className="text-xs text-gray-500 font-medium">BUDGET</div>
                    <div className="text-2xl font-bold">
                      <span className={`${
                        myBudget > avgOpponentBudget ? 'text-green-400' : 
                        myBudget < avgOpponentBudget ? 'text-red-400' : 'text-gray-300'
                      }`}>
                        ${myBudget}
                      </span>
                      <span className="text-lg text-gray-500 ml-2">
                        vs ${avgOpponentBudget}
                      </span>
                      {budgetDiff !== 0 && (
                        <span className={`text-base ml-2 ${
                          budgetDiff > 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          ({budgetDiff > 0 ? '+' : ''}{budgetDiff})
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
            
            {/* Valuation Metrics */}
            <div className="flex items-center gap-6 bg-gray-900/50 rounded px-4 py-2">
              <div className="text-center">
                <div className="text-xs text-gray-500 font-medium">VALUE</div>
                <div className="text-2xl font-bold text-white">${player.intrinsicValue?.toFixed(0) || 0}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-500 font-medium">MARKET</div>
                <div className="text-2xl font-bold text-blue-400">${player.marketValue || 0}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-500 font-medium">EDGE</div>
                <div className={`text-2xl font-bold ${player.edge && player.edge > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {player.edge && player.edge > 0 ? '+' : ''}${Math.abs(player.edge || 0).toFixed(0)}
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-500 font-medium">MAX</div>
                <div className="text-2xl font-bold text-yellow-400">
                  ${player.value || 0}
                </div>
              </div>
            </div>

            {/* PPR Score Display */}
            {pprMetrics && (
              <div className="flex items-center gap-2 bg-gray-900/50 rounded px-3 py-2">
                <Target className="w-5 h-5 text-purple-400" />
                <div>
                  <div className="text-xs text-gray-500 font-medium">PPR</div>
                  <div className="flex items-center gap-2">
                    <div className={`text-2xl font-bold ${pprMetrics.color}`}>
                      {pprMetrics.score.toFixed(0)}
                    </div>
                    <div 
                      className="w-12 h-2 bg-gray-700 rounded-full overflow-hidden"
                      title={`PPR Score: ${pprMetrics.score.toFixed(1)}/100`}
                    >
                      <div 
                        className="h-full transition-all duration-300"
                        style={{ 
                          width: `${pprMetrics.score}%`,
                          backgroundColor: pprMetrics.hexColor 
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Draft Progress */}
            {(() => {
              const totalPicks = (teams.length || 12) * 16;
              const percentComplete = Math.round((draftHistory.length / totalPicks) * 100);
              const phase = percentComplete < 25 ? 'early' : 
                          percentComplete < 50 ? 'early-mid' :
                          percentComplete < 75 ? 'late-mid' : 'late';
              
              return (
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-blue-400" />
                  <div>
                    <div className="text-xs text-gray-500 font-medium">DRAFT</div>
                    <div className="text-2xl font-bold">
                      <span className="text-white">{percentComplete}%</span>
                      <span className="text-lg text-gray-500 ml-2">
                        ({phase})
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}
            
            {/* Market Inflation - Moved from BidAdvisorEnhanced */}
            <div className="flex items-center gap-2 bg-gray-900/50 rounded px-3 py-2">
              <TrendingUp className="w-5 h-5 text-purple-400" />
              <div>
                <div className="text-xs text-gray-500 font-medium">INFLATION</div>
                <div className={`text-2xl font-bold ${
                  marketInflation > 10 ? 'text-red-400' :
                  marketInflation > 5 ? 'text-orange-400' :
                  marketInflation < -10 ? 'text-blue-400' :
                  marketInflation < -5 ? 'text-cyan-400' :
                  'text-gray-400'
                }`}>
                  {marketInflation > 0 ? '+' : ''}{marketInflation}%
                </div>
              </div>
            </div>
          </div>

          {/* Right: Tier Availability Indicators and Close */}
          <div className="flex items-center gap-3">
            {/* Tier Availability */}
            <div className="bg-gray-900/50 rounded px-4 py-2">
              {(() => {
                const draftedIds = new Set(draftHistory.map(pick => pick.player?.id).filter(Boolean));
                
                // Filter available players at same position
                const availableAtPosition = allPlayers.filter(
                  p => p.position === player.position && !draftedIds.has(p.playerId)
                );
                
                // Group by tier and count
                const tierCounts = {
                  elite: availableAtPosition.filter(p => p.tier === 'elite').length,
                  tier1: availableAtPosition.filter(p => p.tier === 'tier1').length,
                  tier2: availableAtPosition.filter(p => p.tier === 'tier2').length,
                  tier3: availableAtPosition.filter(p => p.tier === 'tier3').length,
                };
                
                return (
                  <div className="flex items-center gap-4">
                    {/* Elite */}
                    <div className="text-center">
                      <div className="text-xs text-gray-500 font-medium">ELITE</div>
                      <div className={`text-2xl font-bold ${
                        tierCounts.elite > 0 ? 'text-purple-400' : 'text-gray-600'
                      }`}>
                        {tierCounts.elite}
                      </div>
                    </div>
                    
                    {/* Tier 1 */}
                    <div className="text-center">
                      <div className="text-xs text-gray-500 font-medium">TIER 1</div>
                      <div className={`text-2xl font-bold ${
                        tierCounts.tier1 > 0 ? 'text-blue-400' : 'text-gray-600'
                      }`}>
                        {tierCounts.tier1}
                      </div>
                    </div>
                    
                    {/* Tier 2 */}
                    <div className="text-center">
                      <div className="text-xs text-gray-500 font-medium">TIER 2</div>
                      <div className={`text-2xl font-bold ${
                        tierCounts.tier2 > 0 ? 'text-green-400' : 'text-gray-600'
                      }`}>
                        {tierCounts.tier2}
                      </div>
                    </div>
                    
                    {/* Tier 3 */}
                    <div className="text-center">
                      <div className="text-xs text-gray-500 font-medium">TIER 3</div>
                      <div className={`text-2xl font-bold ${
                        tierCounts.tier3 > 0 ? 'text-yellow-400' : 'text-gray-600'
                      }`}>
                        {tierCounts.tier3}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
            
            {onClose && (
              <button
                onClick={onClose}
                className="text-gray-500 hover:text-white transition-colors p-0.5 hover:bg-gray-700 rounded"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Full Width Bid Advisor Area */}
      <div className="bg-gray-850/50 p-2">
        <div className="bg-gray-800/50 rounded-lg border border-gray-700/30 p-3">
          <BidAdvisorEnhanced 
            player={player} 
            allPlayers={allPlayers}
            onDraft={handleDraft}
          />
        </div>
      </div>
    </div>
  );
};

export default PlayerDetailPanel;