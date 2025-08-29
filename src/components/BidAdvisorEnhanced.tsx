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
  Calendar,
  Link,
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
    const price = typeof simulatedBid === 'number' ? simulatedBid : 0;
    if (!simulatedBid || price <= 0) {
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
          <span className="text-sm text-gray-400">{label}</span>
        </div>
        <div className="flex-1 bg-gray-700 rounded-full h-2 overflow-hidden">
          <div 
            className={`h-full transition-all duration-500 ${getScoreColor(score)}`}
            style={{ width: `${score}%` }}
          />
        </div>
        <span className="text-sm text-gray-300 w-10 text-right">{score}%</span>
      </div>
    );
  };

  return (
    <div className={`border rounded-lg p-4 ${actionDisplay.borderColor} ${actionDisplay.bgLight}`}>
      {/* Main Three Column Layout */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {/* Column 1: Buy Recommendation with Primary Reason */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className={`p-2 rounded-lg ${actionDisplay.color} text-white`}>
              {actionDisplay.icon}
            </div>
            <div>
              <div className={`text-lg font-bold ${actionDisplay.textColor}`}>
                {actionDisplay.label}
              </div>
              <div className="text-sm text-gray-300">
                Conf: {recommendation.confidence}%
              </div>
            </div>
          </div>
          
          {/* Primary Reason */}
          <div className="p-2 bg-gray-800/50 rounded-lg mb-3">
            <div className="text-sm font-medium text-gray-400 mb-1">Primary Reason</div>
            <div className="text-base text-white">{recommendation.primaryReason}</div>
          </div>
          
          {/* Warnings and Opportunities */}
          {(recommendation.warnings.length > 0 || recommendation.opportunities.length > 0) && (
            <div className="space-y-1.5 mb-3">
              {recommendation.warnings.map((warning, idx) => (
                <div key={idx} className="flex items-start gap-1.5 text-sm">
                  <AlertTriangle className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
                  <span className="text-orange-300 leading-tight">{warning}</span>
                </div>
              ))}
              {recommendation.opportunities.map((opportunity, idx) => (
                <div key={idx} className="flex items-start gap-1.5 text-sm">
                  <TrendingUp className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                  <span className="text-green-300 leading-tight">{opportunity}</span>
                </div>
              ))}
            </div>
          )}
          
          {/* Nomination Strategy */}
          <div className="bg-purple-900/30 border border-purple-600/30 rounded-lg p-2">
            <div className="flex items-center gap-2 mb-1">
              <Target className="w-4 h-4 text-purple-400" />
              <span className="text-sm text-gray-400">Nomination</span>
            </div>
            <div className="text-sm font-bold text-purple-300">
              {recommendation.nominationStrategy ? recommendation.nominationStrategy.replace(/-/g, ' ').toUpperCase() : 'CONSIDER'}
            </div>
          </div>
        </div>
        
        {/* Column 2: Decision Factors + Warnings/Opportunities */}
        <div className="bg-gray-800/30 rounded-lg p-3">
          <div className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-2">Decision Factors</div>
          <div className="space-y-1.5 mb-3">
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
          
          {/* Tier Availability */}
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
            
            // Helper functions for colors
            const getByeWeekColor = (bye?: number) => {
              if (!bye) return 'text-gray-500';
              if (bye >= 9 && bye <= 11) return 'text-green-500 font-semibold';
              if (bye === 7 || bye === 8 || bye === 12) return 'text-green-400';
              if (bye === 6 || bye === 13) return 'text-yellow-400';
              if (bye === 5 || bye === 14) return 'text-orange-400';
              return 'text-red-400';
            };
            
            const getSosColor = (sos?: number) => {
              if (!sos && sos !== 0) return 'text-gray-500';
              if (sos >= 8) return 'text-red-500 font-semibold';
              if (sos >= 6) return 'text-red-400';
              if (sos >= 4) return 'text-orange-400';
              if (sos >= 2) return 'text-yellow-400';
              if (sos >= 1) return 'text-green-400';
              return 'text-green-500 font-semibold';
            };
            
            // Show more players - up to 6
            const showPlayers = displayPlayers.slice(0, 6);
            const isLastInTier = displayPlayers.length === 1;
            const isCurrentPlayerInList = displayPlayers.some(p => p.playerId === player.playerId);
            
            if (displayPlayers.length === 0) return null;
            
            return (
              <div className="mt-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-400" />
                    <span className="text-base font-medium text-gray-400">
                      {displayTier} {player.position}s ({displayPlayers.length})
                    </span>
                  </div>
                  {isLastInTier && (
                    <span className="text-sm text-red-400 font-medium">Last!</span>
                  )}
                </div>
                
                <div className="space-y-1">
                  {showPlayers.map((p, idx) => {
                    const isCurrentPlayer = p.playerId === player.playerId;
                    return (
                      <div 
                        key={p.playerId}
                        className={`flex items-center justify-between py-1 px-2 rounded text-sm ${
                          isCurrentPlayer 
                            ? 'bg-purple-900/30 border border-purple-600/30' 
                            : 'bg-gray-900/30'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500">#{p.rank || '-'}</span>
                          <span className={`font-medium ${
                            isCurrentPlayer ? 'text-purple-300' : 'text-white'
                          }`}>
                            {p.playerName}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-cyan-400 font-medium">
                            {p.pprMetrics?.score ? p.pprMetrics.score.toFixed(0) : '-'}
                          </span>
                          <span className={`${getByeWeekColor(p.byeWeek)}`}>
                            W{p.byeWeek || '-'}
                          </span>
                          <span className={`${getSosColor(p.teamSeasonSOS)}`}>
                            {p.teamSeasonSOS?.toFixed(1) || '-'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  {displayPlayers.length > 6 && (
                    <div className="text-center text-sm text-gray-500">
                      +{displayPlayers.length - 6} more
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
        
        {/* Column 3: Draft Controls */}
        <div className="bg-gray-800/50 border border-gray-600 rounded-lg p-3">
          <div className="mb-2">
            <label className="text-sm text-gray-400 font-medium uppercase tracking-wider">Draft Price</label>
          </div>
          
          {/* Price Input with Controls */}
          <div className="flex items-center gap-1 mb-3">
            <button
              onClick={() => setSimulatedBid(Math.max(1, (typeof simulatedBid === 'number' ? simulatedBid : 0) - 5))}
              className="px-2 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-white text-base"
            >
              -5
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
              className="flex-1 px-2 py-1.5 bg-gray-900 border border-gray-600 rounded text-white text-center font-bold text-xl"
              placeholder="$"
            />
            <button
              onClick={() => setSimulatedBid((typeof simulatedBid === 'number' ? simulatedBid : 0) + 5)}
              className="px-2 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-white text-base"
            >
              +5
            </button>
          </div>

          {/* Quick bid buttons */}
          <div className="grid grid-cols-2 gap-1 mb-3">
            {[
              { label: 'Min', value: 1 },
              { label: '25%', value: Math.floor(recommendation.maxBid * 0.25) },
              { label: '50%', value: Math.floor(recommendation.maxBid * 0.5) },
              { label: '75%', value: Math.floor(recommendation.maxBid * 0.75) },
              { label: 'Max', value: recommendation.maxBid },
              { label: 'Val', value: player.auctionValue || 0 }
            ].map(({ label, value }) => (
              <button
                key={label}
                onClick={() => setSimulatedBid(value)}
                className={`px-2 py-1.5 rounded text-sm ${
                  simulatedBid === value 
                    ? 'bg-purple-600 text-white' 
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {label}: ${value}
              </button>
            ))}
          </div>

          {/* Team Selection */}
          <select
            value={selectedTeam}
            onChange={(e) => setSelectedTeam(e.target.value)}
            className="w-full px-2 py-1.5 bg-gray-900 border border-gray-600 rounded text-white text-base mb-3"
          >
            {teams.map(team => (
              <option key={team.id} value={team.name}>
                {team.name}
              </option>
            ))}
          </select>

          {/* Draft Button */}
          <button
            onClick={handleDraft}
            disabled={!simulatedBid || simulatedBid <= 0}
            className={`w-full px-3 py-2.5 rounded font-medium transition-colors text-base ${
              simulatedBid && simulatedBid > 0
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-gray-700 text-gray-400 cursor-not-allowed'
            }`}
          >
            Draft for ${simulatedBid || 0}
          </button>
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






    </div>
  );
};

export default BidAdvisorEnhanced;