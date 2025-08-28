import React, { useMemo, useState } from 'react';
import { Gavel, TrendingUp, AlertTriangle, Target, Brain, DollarSign, Users, Clock } from 'lucide-react';
import { useDraftStore } from '@/store/draftStore';
import type { ValuationResult } from '@/lib/calibratedValuationService';

interface NominationStrategyProps {
  valuations: ValuationResult[];
}

const NominationStrategy: React.FC<NominationStrategyProps> = ({ valuations }) => {
  const { draftHistory, teams, myTeamId } = useDraftStore();
  const [strategyMode, setStrategyMode] = useState<'aggressive' | 'balanced' | 'value'>('balanced');
  
  // Calculate draft phase based on picks made
  const draftPhase = useMemo(() => {
    const totalPicks = draftHistory.length;
    const teamCount = teams.length || 12; // Default to 12 teams if not initialized
    const totalRosterSpots = teamCount * 16; // 16 players per team
    const percentComplete = totalRosterSpots > 0 ? (totalPicks / totalRosterSpots) * 100 : 0;
    
    if (percentComplete < 25) return 'early';
    if (percentComplete < 75) return 'mid';
    return 'late';
  }, [draftHistory, teams]);
  
  // Filter out drafted players
  const draftedIds = useMemo(() => 
    new Set(draftHistory.map(pick => pick.player?.id)), 
    [draftHistory]
  );
  
  const availableValuations = useMemo(() => 
    valuations.filter(p => !draftedIds.has(p.playerId)),
    [valuations, draftedIds]
  );
  
  // Calculate team budgets
  const teamBudgets = useMemo(() => {
    const budgets = new Map<string, number>();
    teams.forEach(team => {
      const spent = draftHistory
        .filter(pick => pick.team === team.id)
        .reduce((sum, pick) => sum + (pick.price || 0), 0);
      budgets.set(team.id, 200 - spent); // $200 starting budget
    });
    return budgets;
  }, [teams, draftHistory]);
  
  // Get other teams' average remaining budget
  const avgOpponentBudget = useMemo(() => {
    let total = 0;
    let count = 0;
    teamBudgets.forEach((budget, teamId) => {
      if (teamId !== myTeamId) {
        total += budget;
        count++;
      }
    });
    return count > 0 ? Math.round(total / count) : 0;
  }, [teamBudgets, myTeamId]);
  
  // Get my team's roster composition
  const myRoster = useMemo(() => {
    const roster = draftHistory
      .filter(pick => pick.team === myTeamId)
      .map(pick => pick.player);
    
    const positions: Record<string, number> = {
      QB: 0, RB: 0, WR: 0, TE: 0, DST: 0, K: 0
    };
    
    roster.forEach(player => {
      if (player && positions[player.position] !== undefined) {
        positions[player.position]++;
      }
    });
    
    return positions;
  }, [draftHistory, myTeamId]);
  
  // Identify position scarcity
  const positionScarcity = useMemo(() => {
    const scarcity: Record<string, { remaining: number; tier1Remaining: number }> = {};
    const positions = ['QB', 'RB', 'WR', 'TE'];
    
    positions.forEach(pos => {
      const available = availableValuations.filter(p => p.position === pos);
      const tier1 = available.filter(p => p.tier === 'elite' || p.tier === 'tier1');
      scarcity[pos] = {
        remaining: available.length,
        tier1Remaining: tier1.length
      };
    });
    
    return scarcity;
  }, [availableValuations]);
  
  // Generate nomination suggestions based on strategy
  const nominationSuggestions = useMemo(() => {
    const suggestions: {
      player: ValuationResult;
      reason: string;
      priority: 'high' | 'medium' | 'low';
      type: 'trap' | 'value' | 'scarcity' | 'handcuff';
    }[] = [];
    
    // Always provide suggestions, even at draft start
    if (availableValuations.length === 0) return suggestions;
    
    // Apply strategy mode modifiers
    if (strategyMode === 'aggressive') {
      // Focus on expensive players and creating bidding wars
      const expensivePlayers = availableValuations
        .filter(p => p.auctionValue >= 25)
        .sort((a, b) => b.auctionValue - a.auctionValue)
        .slice(0, 3);
      
      expensivePlayers.forEach(player => {
        suggestions.push({
          player,
          reason: `High-value ${player.position} to force spending`,
          priority: 'high',
          type: 'trap'
        });
      });
    } else if (strategyMode === 'value') {
      // Focus on undervalued players
      const valuePlayers = availableValuations
        .filter(p => p.edge >= 5)
        .sort((a, b) => b.edge - a.edge)
        .slice(0, 3);
      
      valuePlayers.forEach(player => {
        suggestions.push({
          player,
          reason: `Undervalued by $${Math.round(player.edge)}`,
          priority: 'high',
          type: 'value'
        });
      });
    }
    
    // Original draft phase logic (now combined with strategy mode)
    if (draftPhase === 'early' || strategyMode === 'balanced') {
      // Nominate expensive players you don't want
      const expensivePlayers = availableValuations
        .filter(p => p.auctionValue >= 30)
        .sort((a, b) => b.auctionValue - a.auctionValue)
        .slice(0, 3);
      
      expensivePlayers.forEach(player => {
        // Check if it's a position we don't need
        const positionFilled = myRoster[player.position] >= (player.position === 'QB' || player.position === 'TE' ? 1 : 2);
        if (positionFilled || player.edge < -5) {
          suggestions.push({
            player,
            reason: `Expensive ${player.position} to drain budgets`,
            priority: 'high',
            type: 'trap'
          });
        }
      });
      
      // Nominate overvalued players (negative edge)
      const overvalued = availableValuations
        .filter(p => p.edge < -10 && p.auctionValue >= 15)
        .sort((a, b) => a.edge - b.edge)
        .slice(0, 2);
      
      overvalued.forEach(player => {
        suggestions.push({
          player,
          reason: `Overvalued by market ($${Math.abs(player.edge)} above fair value)`,
          priority: 'high',
          type: 'trap'
        });
      });
    } else if (draftPhase === 'mid') {
      // Check for position runs
      ['RB', 'WR'].forEach(pos => {
        if (positionScarcity[pos].tier1Remaining <= 3 && positionScarcity[pos].tier1Remaining > 0) {
          const lastElite = availableValuations
            .filter(p => p.position === pos && (p.tier === 'elite' || p.tier === 'tier1'))
            .sort((a, b) => b.auctionValue - a.auctionValue)[0];
          
          if (lastElite && myRoster[pos] >= 2) {
            suggestions.push({
              player: lastElite,
              reason: `Last elite ${pos} - will trigger bidding war`,
              priority: 'high',
              type: 'scarcity'
            });
          }
        }
      });
      
      // Nominate mid-tier players at positions you're set at
      const filledPositions = Object.entries(myRoster)
        .filter(([pos, count]) => {
          if (pos === 'QB' || pos === 'TE') return count >= 1;
          if (pos === 'RB' || pos === 'WR') return count >= 3;
          return false;
        })
        .map(([pos]) => pos);
      
      filledPositions.forEach(pos => {
        const midTier = availableValuations
          .filter(p => p.position === pos && p.auctionValue >= 10 && p.auctionValue <= 25)
          .sort((a, b) => b.auctionValue - a.auctionValue)
          .slice(0, 2);
        
        midTier.forEach(player => {
          suggestions.push({
            player,
            reason: `Mid-tier ${pos} (position already filled)`,
            priority: 'medium',
            type: 'trap'
          });
        });
      });
    } else {
      // Late draft - nominate players you want
      const values = availableValuations
        .filter(p => p.edge >= 5 && p.auctionValue <= 10)
        .sort((a, b) => b.edge - a.edge)
        .slice(0, 5);
      
      values.forEach(player => {
        suggestions.push({
          player,
          reason: `High value target (+$${player.edge} edge)`,
          priority: 'high',
          type: 'value'
        });
      });
      
      // Nominate handcuffs if you have the starter
      const myRBs = draftHistory
        .filter(pick => pick.team === myTeamId && pick.player?.position === 'RB')
        .map(pick => pick.player);
      
      // This is simplified - in reality you'd have a handcuff mapping
      const handcuffs = availableValuations
        .filter(p => p.position === 'RB' && p.auctionValue <= 5)
        .slice(0, 2);
      
      handcuffs.forEach(player => {
        suggestions.push({
          player,
          reason: 'Potential handcuff/lottery ticket',
          priority: 'low',
          type: 'handcuff'
        });
      });
    }
    
    return suggestions.slice(0, 5); // Return top 5 suggestions
  }, [availableValuations, draftPhase, myRoster, positionScarcity, draftHistory, myTeamId, strategyMode]);
  
  const getStrategyDescription = () => {
    switch (draftPhase) {
      case 'early':
        return 'Nominate expensive players you DON\'T want to drain opponent budgets';
      case 'mid':
        return 'Target position scarcity and create bidding wars';
      case 'late':
        return 'Nominate your value targets and sleepers';
      default:
        return '';
    }
  };
  
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-400';
      case 'medium': return 'text-yellow-400';
      case 'low': return 'text-gray-400';
      default: return 'text-gray-400';
    }
  };
  
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'trap': return <AlertTriangle className="w-3 h-3 text-red-400" />;
      case 'value': return <TrendingUp className="w-3 h-3 text-green-400" />;
      case 'scarcity': return <Clock className="w-3 h-3 text-yellow-400" />;
      case 'handcuff': return <Target className="w-3 h-3 text-blue-400" />;
      default: return null;
    }
  };
  
  return (
    <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Gavel className="w-5 h-5 text-purple-400" />
          Nomination Strategy
        </h2>
        <span className={`text-xs px-2 py-1 rounded ${
          draftPhase === 'early' ? 'bg-blue-900 text-blue-300' :
          draftPhase === 'mid' ? 'bg-yellow-900 text-yellow-300' :
          'bg-green-900 text-green-300'
        }`}>
          {draftPhase.toUpperCase()}
        </span>
      </div>
      
      {/* Strategy Mode Selector */}
      <div className="flex gap-1 mb-3">
        {(['aggressive', 'balanced', 'value'] as const).map(mode => (
          <button
            key={mode}
            onClick={() => setStrategyMode(mode)}
            className={`flex-1 px-2 py-1 text-xs rounded ${
              strategyMode === mode
                ? 'bg-purple-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {mode.charAt(0).toUpperCase() + mode.slice(1)}
          </button>
        ))}
      </div>
      
      {/* Current Strategy */}
      <div className="bg-gray-800 rounded p-2 mb-3">
        <div className="flex items-center gap-2 mb-1">
          <Brain className="w-4 h-4 text-purple-400" />
          <span className="text-xs font-semibold text-purple-400">Current Strategy</span>
        </div>
        <p className="text-xs text-gray-300">{getStrategyDescription()}</p>
      </div>
      
      {/* Budget Status */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-gray-800 rounded p-2">
          <div className="flex items-center gap-1 mb-1">
            <DollarSign className="w-3 h-3 text-green-400" />
            <span className="text-xs text-gray-400">My Budget</span>
          </div>
          <span className="text-sm font-bold text-green-400">
            ${teamBudgets.get(myTeamId) || 0}
          </span>
        </div>
        <div className="bg-gray-800 rounded p-2">
          <div className="flex items-center gap-1 mb-1">
            <Users className="w-3 h-3 text-yellow-400" />
            <span className="text-xs text-gray-400">Avg Opp</span>
          </div>
          <span className="text-sm font-bold text-yellow-400">
            ${avgOpponentBudget}
          </span>
        </div>
      </div>
      
      {/* Position Scarcity Alert */}
      {Object.entries(positionScarcity).some(([_, data]) => data.tier1Remaining <= 2 && data.tier1Remaining > 0) && (
        <div className="bg-red-900/20 border border-red-500/30 rounded p-2 mb-3">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="text-xs font-semibold text-red-400">Position Scarcity Alert</span>
          </div>
          <div className="text-xs text-red-300">
            {Object.entries(positionScarcity)
              .filter(([_, data]) => data.tier1Remaining <= 2 && data.tier1Remaining > 0)
              .map(([pos, data]) => `${pos}: ${data.tier1Remaining} elite left`)
              .join(', ')}
          </div>
        </div>
      )}
      
      {/* Nomination Suggestions */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-gray-300 mb-1">Suggested Nominations:</div>
        {nominationSuggestions.length === 0 ? (
          <p className="text-xs text-gray-500 italic">No suggestions available</p>
        ) : (
          nominationSuggestions.map((suggestion, idx) => (
            <div key={idx} className="bg-gray-800 rounded p-2">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  {getTypeIcon(suggestion.type)}
                  <span className="text-sm font-medium text-white">
                    {suggestion.player.playerName}
                  </span>
                  <span className="text-xs text-gray-400">
                    {suggestion.player.position} - ${suggestion.player.auctionValue}
                  </span>
                </div>
                <span className={`text-xs ${getPriorityColor(suggestion.priority)}`}>
                  {suggestion.priority === 'high' ? '!' : 
                   suggestion.priority === 'medium' ? '!!' : '!!!'}
                </span>
              </div>
              <p className="text-xs text-gray-400">{suggestion.reason}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default NominationStrategy;