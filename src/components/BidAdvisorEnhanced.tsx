/**
 * Enhanced Bid Advisor Component with Advanced Features
 * Displays opponent tracking, bye weeks, stacks, and smart alternatives
 */

import React, { useMemo, useState } from 'react';
import { 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  DollarSign,
  Users,
  Target,
  Zap,
  Info,
  ChevronDown,
  ChevronUp,
  Calendar,
  Link,
  Shuffle,
  Trophy,
  Activity,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { bidAdvisorService } from '@/lib/bidAdvisorService';
import type { ValuationResult } from '@/lib/calibratedValuationService';
import { useDraftStore } from '@/store/draftStore';

interface BidAdvisorEnhancedProps {
  player: ValuationResult;
  currentBid?: number;
  onBidChange?: (bid: number) => void;
  allPlayers?: ValuationResult[];
  onDraft?: (price: number, teamId: string) => void; // Callback for drafting
}

const BidAdvisorEnhanced: React.FC<BidAdvisorEnhancedProps> = ({ 
  player, 
  currentBid = 0, 
  onBidChange, 
  allPlayers = [],
  onDraft
}) => {
  const { teams, myTeamId, draftHistory, completeAuction } = useDraftStore();
  const [showCompetitors, setShowCompetitors] = useState(false);
  const [simulatedBid, setSimulatedBid] = useState<number | ''>(currentBid || '');
  const [selectedTeam, setSelectedTeam] = useState<string>(teams.find(t => t.id === myTeamId)?.name || 'My Team');

  // Get recommendation with all new features
  const recommendation = useMemo(() => {
    const foundTeam = teams.find(t => t.id === myTeamId);
    
    // Convert roster (DraftPick[]) to players array for the service
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

    // Convert all teams to the format the service expects
    const convertedTeams = teams.map(t => ({
      id: t.id,
      name: t.name,
      budget: t.budget - t.spent,
      players: t.roster?.map(pick => pick.player) || [],
      isUser: t.id === myTeamId,
      maxBid: t.maxBid || (t.budget - t.spent),
      nominations: 0
    }));
    
    // Get available players (those not drafted)
    // Note: Check both 'id' and 'playerId' fields for compatibility
    const draftedIds = new Set(
      draftHistory.map(pick => pick.player?.id || (pick.player as any)?.playerId).filter(Boolean)
    );
    
    // Filter to get only undrafted players
    const availablePlayers = allPlayers.filter(p => {
      // Check both possible ID fields
      const playerId = p.playerId || p.id;
      return !draftedIds.has(playerId);
    });
    
    // Debug log to see what we're working with
    console.log('[BidAdvisor Debug]', {
      allPlayersCount: allPlayers.length,
      draftedCount: draftedIds.size,
      availableCount: availablePlayers.length,
      currentPlayer: player.playerName,
      samplePlayer: availablePlayers[0]
    });

    const context = {
      myTeam,
      allTeams: convertedTeams.length > 0 ? convertedTeams : [myTeam],
      draftHistory: draftHistory || [],
      availablePlayers,
      currentBid: typeof simulatedBid === 'number' ? simulatedBid : 0,
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

    return bidAdvisorService.getRecommendation(player, context, simulatedBid);
  }, [player, simulatedBid, teams, myTeamId, draftHistory, allPlayers]);

  // Get action color and icon
  const getActionDisplay = () => {
    switch (recommendation.action) {
      case 'strong-buy':
        return {
          color: 'bg-green-500',
          borderColor: 'border-green-500',
          textColor: 'text-green-400',
          bgLight: 'bg-green-500/10',
          icon: <CheckCircle className="w-5 h-5" />,
          label: 'STRONG BUY',
          pulseAnimation: 'animate-pulse'
        };
      case 'consider':
        return {
          color: 'bg-yellow-500',
          borderColor: 'border-yellow-500',
          textColor: 'text-yellow-400',
          bgLight: 'bg-yellow-500/10',
          icon: <Info className="w-5 h-5" />,
          label: 'CONSIDER',
          pulseAnimation: ''
        };
      case 'avoid':
        return {
          color: 'bg-orange-500',
          borderColor: 'border-orange-500',
          textColor: 'text-orange-400',
          bgLight: 'bg-orange-500/10',
          icon: <AlertTriangle className="w-5 h-5" />,
          label: 'AVOID',
          pulseAnimation: ''
        };
      case 'pass':
        return {
          color: 'bg-red-500',
          borderColor: 'border-red-500',
          textColor: 'text-red-400',
          bgLight: 'bg-red-500/10',
          icon: <XCircle className="w-5 h-5" />,
          label: 'PASS',
          pulseAnimation: ''
        };
    }
  };

  const actionDisplay = getActionDisplay();

  // Handle draft action
  const handleDraft = () => {
    const price = simulatedBid;
    if (price <= 0) {
      alert('Please enter a valid purchase price');
      return;
    }

    // Map team selection to team ID
    const selectedTeamObj = teams.find(t => t.name === selectedTeam);
    const teamId = selectedTeamObj?.id || myTeamId;
    
    if (onDraft) {
      onDraft(price, teamId);
    } else {
      // Fallback to direct store action
      const playerData = {
        id: player.playerId || player.id,
        name: player.playerName || player.name,
        position: player.position as any,
        team: player.team,
        projectedPoints: player.projectedPoints,
        value: player.auctionValue,
        tier: player.tier || 'replacement'
      };
      completeAuction(playerData as any, price, teamId);
    }
  };

  // Handle enter key on input
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleDraft();
    }
  };

  // Score bar component
  const ScoreBar = ({ label, score, icon }: { label: string; score: number; icon: React.ReactNode }) => {
    const getScoreColor = (score: number) => {
      if (score >= 75) return 'bg-green-500';
      if (score >= 50) return 'bg-yellow-500';
      if (score >= 25) return 'bg-orange-500';
      return 'bg-red-500';
    };

    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 w-20">
          {icon}
          <span className="text-xs text-gray-400">{label}</span>
        </div>
        <div className="flex-1 bg-gray-700 rounded-full h-2 overflow-hidden">
          <div 
            className={`h-full transition-all duration-500 ${getScoreColor(score)}`}
            style={{ width: `${score}%` }}
          />
        </div>
        <span className="text-xs text-gray-300 w-10 text-right">{score}%</span>
      </div>
    );
  };

  return (
    <div className={`border rounded-lg p-4 ${actionDisplay.borderColor} ${actionDisplay.bgLight}`}>
      {/* Strategy and Budget Status Bar */}
      {(recommendation.budgetAdvantage || recommendation.draftProgress || recommendation.strategyPivotAlert || recommendation.nominationStrategy) && (
        <div className="mb-4 p-2 bg-gray-800/50 rounded-lg">
          <div className="flex items-center justify-between gap-4">
            {/* Active Strategy and Nomination */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-medium text-purple-300">
                  {recommendation.activeStrategy === 'robust-rb' && '🎯 Robust RB'}
                  {recommendation.activeStrategy === 'hero-rb' && '🦸 Hero RB'}
                  {recommendation.activeStrategy === 'zero-rb' && '⚡ Zero RB'}
                  {recommendation.activeStrategy === 'balanced' && '⚖️ Balanced'}
                </span>
              </div>
              {recommendation.nominationStrategy && (
                <div className="flex items-center gap-2 border-l border-gray-600 pl-4">
                  <Target className="w-4 h-4 text-yellow-400" />
                  <span className="text-xs font-medium text-yellow-300">
                    Nominate: {recommendation.nominationStrategy.replace(/-/g, ' ')}
                  </span>
                </div>
              )}
            </div>
            
            {/* Budget Advantage */}
            {recommendation.budgetAdvantage && (
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-green-400" />
                <div className="text-xs">
                  <span className="text-gray-400">Budget: </span>
                  <span className={`font-bold ${
                    recommendation.budgetAdvantage.advantage > 0 ? 'text-green-400' : 
                    recommendation.budgetAdvantage.advantage < 0 ? 'text-red-400' : 'text-gray-300'
                  }`}>
                    ${recommendation.budgetAdvantage.myBudget}
                  </span>
                  <span className="text-gray-500"> (avg: ${recommendation.budgetAdvantage.averageBudget})</span>
                  {recommendation.budgetAdvantage.canDominate && (
                    <span className="ml-2 text-green-400 font-bold">👑 CAN DOMINATE</span>
                  )}
                </div>
              </div>
            )}
            
            {/* Draft Progress */}
            {recommendation.draftProgress && (
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-400" />
                <div className="text-xs">
                  <span className="text-gray-400">Draft: </span>
                  <span className="font-bold text-white">{recommendation.draftProgress.percentComplete}%</span>
                  {recommendation.draftProgress.isHalfway && (
                    <span className="ml-2 text-yellow-400">⚡ HALFWAY</span>
                  )}
                  <span className="ml-2 text-gray-500">({recommendation.draftProgress.phase})</span>
                </div>
              </div>
            )}
          </div>
          
          {/* Strategy Pivot Alert */}
          {recommendation.strategyPivotAlert && (
            <div className="mt-2 p-2 bg-orange-900/30 border border-orange-600/30 rounded">
              <div className="text-sm text-orange-300">{recommendation.strategyPivotAlert}</div>
            </div>
          )}
        </div>
      )}

      {/* Main Recommendation Header with Decision Factors */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Left: Buy Recommendation */}
        <div className={`${actionDisplay.pulseAnimation}`}>
          <div className="flex items-center gap-3 mb-3">
            <div className={`p-2 rounded-lg ${actionDisplay.color} text-white`}>
              {actionDisplay.icon}
            </div>
            <div>
              <div className={`text-lg font-bold ${actionDisplay.textColor}`}>
                {actionDisplay.label}
              </div>
              <div className="text-sm text-gray-300">
                Confidence: {recommendation.confidence}%
              </div>
            </div>
          </div>
          
          <div className="flex gap-4">
            <div>
              <div className="text-xs text-gray-400">Tier</div>
              <div className="text-sm font-bold text-white">
                {player.tier === 'elite' ? 'Elite' : 
                 player.tier === 'tier1' ? 'Tier 1' :
                 player.tier === 'tier2' ? 'Tier 2' :
                 player.tier === 'tier3' ? 'Tier 3' : 'Repl'}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-400">Max Bid</div>
              <div className="text-sm font-bold text-green-400">
                ${Math.round(player.auctionValue * 0.85)}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-400">Our Value</div>
              <div className="text-sm font-bold text-white">
                ${player.auctionValue || 0}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-400">Market</div>
              <div className="text-sm font-bold text-blue-400">
                ${player.marketValue || '-'}
              </div>
            </div>
          </div>
        </div>
        
        {/* Right: Decision Factors */}
        <div className="bg-gray-800/30 rounded-lg p-3">
          <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Decision Factors</div>
          <div className="space-y-1.5">
            <ScoreBar 
              label="Value" 
              score={recommendation.valueScore} 
              icon={<DollarSign className="w-3 h-3 text-gray-400" />}
            />
            <ScoreBar 
              label="Need" 
              score={recommendation.needScore} 
              icon={<Target className="w-3 h-3 text-gray-400" />}
            />
            <ScoreBar 
              label="Scarcity" 
              score={recommendation.scarcityScore} 
              icon={<Users className="w-3 h-3 text-gray-400" />}
            />
            <ScoreBar 
              label="Budget" 
              score={recommendation.budgetScore} 
              icon={<Zap className="w-3 h-3 text-gray-400" />}
            />
          </div>
        </div>
      </div>

      {/* Team Stack Bonus */}
      {recommendation.teamStackBonus && recommendation.teamStackBonus.synergyBonus > 0 && (
        <div className="mb-3 p-2 bg-purple-900/30 border border-purple-600/30 rounded">
          <div className="flex items-center gap-2">
            <Link className="w-4 h-4 text-purple-400" />
            <span className="text-sm text-purple-300">
              {recommendation.teamStackBonus.stackType === 'QB-WR' && '🎯 QB-WR Stack'}
              {recommendation.teamStackBonus.stackType === 'QB-TE' && '🎯 QB-TE Stack'}
              {recommendation.teamStackBonus.stackType === 'multiple' && '📊 Team Stack'}
              {' '}+{recommendation.teamStackBonus.synergyBonus}% bonus
            </span>
          </div>
          {recommendation.teamStackBonus.warning && (
            <div className="text-xs text-orange-300 mt-1">{recommendation.teamStackBonus.warning}</div>
          )}
        </div>
      )}

      {/* Bye Week Warning */}
      {recommendation.byeWeekImpact?.warning && (
        <div className="mb-3 p-2 bg-red-900/30 border border-red-600/30 rounded">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-red-400" />
            <span className="text-sm text-red-300">{recommendation.byeWeekImpact.warning}</span>
          </div>
        </div>
      )}

      {/* Primary Reason and Smart Alternatives Side by Side */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* Primary Reason */}
        <div className="p-3 bg-gray-800/50 rounded-lg">
          <div className="text-sm font-medium text-gray-300 mb-1">Primary Reason</div>
          <div className="text-white">{recommendation.primaryReason}</div>
        </div>

        {/* Smart Alternatives */}
        <div className="bg-gray-800/30 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <Shuffle className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Smart Alternatives</span>
          </div>
          {recommendation.smartAlternatives && recommendation.smartAlternatives.length > 0 ? (
            <div className="space-y-2">
              {recommendation.smartAlternatives.slice(0, 3).map((alt, idx) => (
                <div key={idx} className="text-xs">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-white font-medium">{alt.player.playerName}</span>
                      <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded ${
                        alt.availability === 'immediate' ? 'bg-green-600/30 text-green-400' :
                        alt.availability === 'likely-available' ? 'bg-yellow-600/30 text-yellow-400' :
                        'bg-red-600/30 text-red-400'
                      }`}>
                        {alt.availability.replace('-', ' ')}
                      </span>
                    </div>
                    <span className="text-gray-400 text-[10px]">$${alt.targetPrice}</span>
                  </div>
                  <div className="text-[10px] text-gray-500 mt-0.5">{alt.reasoning}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-gray-500">No comparable alternatives available</div>
          )}
        </div>
      </div>

      {/* Competitor Analysis */}
      {recommendation.competitorAnalysis && recommendation.competitorAnalysis.length > 0 && (
        <div className="mb-4">
          <button
            onClick={() => setShowCompetitors(!showCompetitors)}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-2"
          >
            <Users className="w-4 h-4" />
            Competitor Analysis ({recommendation.competitorAnalysis.length} teams)
            {showCompetitors ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          
          {showCompetitors && (
            <div className="space-y-2">
              {recommendation.competitorAnalysis.map((comp, idx) => (
                <div key={idx} className="flex justify-between items-center p-2 bg-gray-800/50 rounded">
                  <div>
                    <span className="text-sm font-medium text-white">{comp.teamName}</span>
                    <span className={`ml-2 text-xs ${comp.aggressionLevel === 'high' ? 'text-red-400' : comp.aggressionLevel === 'medium' ? 'text-yellow-400' : 'text-green-400'}`}>
                      {comp.aggressionLevel} aggression
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-300">Max: ${comp.maxPossibleBid}</div>
                    <div className="text-xs text-gray-500">Budget: ${comp.remainingBudget}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Market Intelligence and Nomination Strategy */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="bg-gray-800/50 rounded-lg p-2">
          <div className="text-xs text-gray-400 mb-1">Market Inflation</div>
          <div className={`text-sm font-bold ${recommendation.marketInflation > 0 ? 'text-red-400' : 'text-green-400'}`}>
            {recommendation.marketInflation > 0 ? '+' : ''}{recommendation.marketInflation}%
          </div>
        </div>
        <div className="bg-purple-900/30 border border-purple-600/30 rounded-lg p-2">
          <div className="flex items-center gap-2 mb-1">
            <Target className="w-3 h-3 text-purple-400" />
            <span className="text-xs text-gray-400">Nomination Strategy</span>
          </div>
          <div className="text-sm font-bold text-purple-300">
            {recommendation.nominationStrategy ? recommendation.nominationStrategy.replace(/-/g, ' ').toUpperCase() : 'CONSIDER'}
          </div>
          <div className="text-[10px] text-gray-400 mt-1">
            {recommendation.nominationStrategy === 'nominate-early' && 'Get this player early'}
            {recommendation.nominationStrategy === 'nominate-late' && 'Wait for better timing'}
            {recommendation.nominationStrategy === 'avoid-nominating' && 'Let others nominate'}
          </div>
        </div>
      </div>


      {/* Warnings/Opportunities and Tier Availability Side by Side */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* Left: Warnings and Opportunities */}
        <div>
          {(recommendation.warnings.length > 0 || recommendation.opportunities.length > 0) && (
            <div className="space-y-2">
              {recommendation.warnings.map((warning, idx) => (
                <div key={idx} className="flex items-start gap-2 text-sm">
                  <AlertTriangle className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
                  <span className="text-orange-300">{warning}</span>
                </div>
              ))}
              {recommendation.opportunities.map((opportunity, idx) => (
                <div key={idx} className="flex items-start gap-2 text-sm">
                  <TrendingUp className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                  <span className="text-green-300">{opportunity}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Right: Tier Availability Indicator */}
        <div>
          {(() => {
            // Get drafted player IDs
            const draftedIds = new Set(draftHistory.map(pick => pick.player?.id).filter(Boolean));
            
            // Filter available players at same position
            const availableAtPosition = allPlayers.filter(
              p => p.position === player.position && !draftedIds.has(p.playerId)
            );
            
            // Group by tier
            const tierGroups = {
              elite: availableAtPosition.filter(p => p.tier === 'elite'),
              tier1: availableAtPosition.filter(p => p.tier === 'tier1'),
              tier2: availableAtPosition.filter(p => p.tier === 'tier2'),
              tier3: availableAtPosition.filter(p => p.tier === 'tier3'),
              replacement: availableAtPosition.filter(p => p.tier === 'replacement')
            };
            
            // Find highest tier with available players
            let displayTier = '';
            let displayPlayers: ValuationResult[] = [];
            
            if (tierGroups.elite.length > 0) {
              displayTier = 'Elite';
              displayPlayers = tierGroups.elite;
            } else if (tierGroups.tier1.length > 0) {
              displayTier = 'Tier 1';
              displayPlayers = tierGroups.tier1;
            } else if (tierGroups.tier2.length > 0) {
              displayTier = 'Tier 2';
              displayPlayers = tierGroups.tier2;
            } else if (tierGroups.tier3.length > 0) {
              displayTier = 'Tier 3';
              displayPlayers = tierGroups.tier3;
            } else if (tierGroups.replacement.length > 0) {
              displayTier = 'Replacement';
              displayPlayers = tierGroups.replacement;
            }
            
            // Sort by rank
            displayPlayers.sort((a, b) => (a.rank || 999) - (b.rank || 999));
            
            // Limit to top 5 for display
            const showPlayers = displayPlayers.slice(0, 5);
            const isLastInTier = displayPlayers.length === 1;
            const isCurrentPlayerInList = displayPlayers.some(p => p.playerId === player.playerId);
            
            if (displayPlayers.length === 0) return null;
            
            return (
              <div className="bg-gray-800/30 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                      {displayTier} {player.position}s
                    </span>
                    <span className="text-[10px] text-gray-500">
                      ({displayPlayers.length})
                    </span>
                  </div>
                  {isLastInTier && (
                    <div className="flex items-center gap-1 px-1.5 py-0.5 bg-red-900/30 border border-red-600/30 rounded">
                      <AlertTriangle className="w-3 h-3 text-red-400" />
                      <span className="text-[10px] text-red-400 font-medium">Last!</span>
                    </div>
                  )}
                </div>
                
                <div className="space-y-1">
                  {showPlayers.map((p, idx) => {
                    const isCurrentPlayer = p.playerId === player.playerId;
                    return (
                      <div 
                        key={p.playerId}
                        className={`flex items-center justify-between py-0.5 px-1.5 rounded text-[11px] ${
                          isCurrentPlayer 
                            ? 'bg-purple-900/30 border border-purple-600/30' 
                            : 'bg-gray-900/50'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="text-gray-500 font-mono text-[10px]">#{p.rank || '-'}</span>
                          <span className={`font-medium ${
                            isCurrentPlayer ? 'text-purple-300' : 'text-white'
                          }`}>
                            {p.playerName}
                          </span>
                          {isCurrentPlayer && (
                            <span className="text-[9px] bg-purple-600/50 px-1 rounded text-purple-200">
                              YOU
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px]">
                          <span className="text-gray-400">${p.value || 0}</span>
                          <span className={`font-medium ${
                            (p.edge || 0) > 0 ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {(p.edge || 0) > 0 ? '+' : ''}${Math.abs(p.edge || 0)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  {displayPlayers.length > 5 && (
                    <div className="text-center text-[10px] text-gray-500 pt-0.5">
                      +{displayPlayers.length - 5} more
                    </div>
                  )}
                </div>
                
                {isLastInTier && (
                  <div className="mt-2 p-1.5 bg-orange-900/20 border border-orange-600/30 rounded">
                    <div className="flex items-start gap-1.5">
                      <AlertCircle className="w-3 h-3 text-orange-400 mt-0.5 flex-shrink-0" />
                      <div className="text-[10px] text-orange-300">
                        <span className="font-semibold">Scarcity:</span> Last {displayTier.toLowerCase()} {player.position}!
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Bid Simulator & Draft Controls - Centered Box */}
      <div className="border-t border-gray-700 pt-4">
        <div className="flex justify-center">
          <div className="w-full max-w-md bg-gray-800/50 border border-gray-600 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm text-gray-400 font-medium">Draft Price</label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSimulatedBid(Math.max(1, (typeof simulatedBid === 'number' ? simulatedBid : 0) - 5))}
                  className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-white"
                >
                  -$5
                </button>
                <input
                  type="number"
                  value={simulatedBid}
                  onChange={(e) => {
                    const value = e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0);
                    setSimulatedBid(value);
                    if (onBidChange && typeof value === 'number') onBidChange(value);
                  }}
                  onKeyPress={handleKeyPress}
                  className="w-20 px-2 py-1 bg-gray-900 border border-gray-600 rounded text-white text-center font-bold"
                  placeholder="Price"
                />
                <button
                  onClick={() => setSimulatedBid((typeof simulatedBid === 'number' ? simulatedBid : 0) + 5)}
                  className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-white"
                >
                  +$5
                </button>
              </div>
            </div>

            {/* Team Selection and Draft Button */}
            <div className="flex items-center gap-2">
              <select
                value={selectedTeam}
                onChange={(e) => setSelectedTeam(e.target.value)}
                className="flex-1 px-3 py-2 bg-gray-900 border border-gray-600 rounded text-white"
              >
                {teams.map(team => (
                  <option key={team.id} value={team.name}>
                    {team.name}
                  </option>
                ))}
              </select>
              <button
                onClick={handleDraft}
                disabled={!simulatedBid || simulatedBid <= 0}
                className={`px-4 py-2 rounded font-medium transition-colors ${
                  simulatedBid && simulatedBid > 0
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-gray-700 text-gray-400 cursor-not-allowed'
            }`}
          >
            Draft Player (${simulatedBid})
          </button>
        </div>
        
        {/* Quick bid buttons */}
        <div className="flex gap-2 flex-wrap mt-3">
          {[
            { label: 'Min', value: 1 },
            { label: '25%', value: Math.floor(recommendation.maxBid * 0.25) },
            { label: '50%', value: Math.floor(recommendation.maxBid * 0.5) },
            { label: '75%', value: Math.floor(recommendation.maxBid * 0.75) },
            { label: 'Max', value: recommendation.maxBid }
          ].map(({ label, value }) => (
            <button
              key={label}
              onClick={() => setSimulatedBid(value)}
              className={`px-3 py-1 rounded text-sm ${
                simulatedBid === value 
                  ? 'bg-purple-600 text-white' 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {label} (${value})
            </button>
          ))}
        </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BidAdvisorEnhanced;