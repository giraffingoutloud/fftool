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
  Eye
} from 'lucide-react';
import { bidAdvisorService, type BidRecommendation } from '@/lib/bidAdvisorService';
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
  const [showDetails, setShowDetails] = useState(false);
  const [showCompetitors, setShowCompetitors] = useState(false);
  const [simulatedBid, setSimulatedBid] = useState(currentBid);
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
      draftHistory.map(pick => pick.player?.id || pick.player?.playerId).filter(Boolean)
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
      currentBid: simulatedBid,
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
        position: player.position,
        team: player.team,
        projectedPoints: player.projectedPoints,
        value: player.auctionValue,
        tier: player.tier || 'replacement'
      };
      completeAuction(playerData, price, teamId);
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
      {/* Main Recommendation Header */}
      <div className={`flex items-center justify-between mb-4 ${actionDisplay.pulseAnimation}`}>
        <div className="flex items-center gap-3">
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

        <div className="text-right">
          <div className="text-sm text-gray-400">Max Profitable Bid</div>
          <div className="text-2xl font-bold text-white">
            ${recommendation.maxBid}
          </div>
          {simulatedBid > 0 && (
            <div className={`text-sm ${simulatedBid <= recommendation.maxBid ? 'text-green-400' : 'text-red-400'}`}>
              {simulatedBid <= recommendation.maxBid ? '+' : ''}{recommendation.maxBid - simulatedBid} edge
            </div>
          )}
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

      {/* Primary Reason */}
      <div className="mb-4 p-3 bg-gray-800/50 rounded-lg">
        <div className="text-sm font-medium text-gray-300 mb-1">Primary Reason</div>
        <div className="text-white">{recommendation.primaryReason}</div>
      </div>

      {/* Decision Matrix */}
      <div className="space-y-2 mb-4">
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

      {/* Market Intelligence */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-gray-800/50 rounded-lg p-2">
          <div className="text-xs text-gray-400 mb-1">Market</div>
          <div className={`text-sm font-bold ${recommendation.marketInflation > 0 ? 'text-red-400' : 'text-green-400'}`}>
            {recommendation.marketInflation > 0 ? '+' : ''}{recommendation.marketInflation}%
          </div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-2">
          <div className="text-xs text-gray-400 mb-1">Expected</div>
          <div className="text-sm font-bold text-white">
            ${recommendation.expectedFinalPrice}
          </div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-2">
          <div className="text-xs text-gray-400 mb-1">Nomination</div>
          <div className="text-sm font-bold text-purple-400">
            {recommendation.nominationStrategy.replace('-', ' ')}
          </div>
        </div>
      </div>

      {/* Smart Alternatives */}
      {recommendation.smartAlternatives && recommendation.smartAlternatives.length > 0 && (
        <div className="mb-4 p-3 bg-gray-800/30 rounded">
          <div className="flex items-center gap-2 mb-2">
            <Shuffle className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-medium text-blue-400">Smart Alternatives</span>
          </div>
          <div className="space-y-2">
            {recommendation.smartAlternatives.map((alt, idx) => (
              <div key={idx} className="text-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-white font-medium">{alt.player.playerName}</span>
                    <span className={`ml-2 text-xs px-2 py-0.5 rounded ${
                      alt.availability === 'immediate' ? 'bg-green-600/30 text-green-400' :
                      alt.availability === 'likely-available' ? 'bg-yellow-600/30 text-yellow-400' :
                      'bg-red-600/30 text-red-400'
                    }`}>
                      {alt.availability}
                    </span>
                  </div>
                  <span className="text-gray-400">Target: ${alt.targetPrice}</span>
                </div>
                <div className="text-xs text-gray-500 mt-1">{alt.reasoning}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Warnings and Opportunities */}
      {(recommendation.warnings.length > 0 || recommendation.opportunities.length > 0) && (
        <div className="space-y-2 mb-4">
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

      {/* Bid Simulator & Draft Controls */}
      <div className="border-t border-gray-700 pt-4">
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm text-gray-400">Draft Price</label>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSimulatedBid(Math.max(1, simulatedBid - 5))}
              className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-white"
            >
              -$5
            </button>
            <input
              type="number"
              value={simulatedBid}
              onChange={(e) => {
                const value = Math.max(0, parseInt(e.target.value) || 0);
                setSimulatedBid(value);
                if (onBidChange) onBidChange(value);
              }}
              onKeyPress={handleKeyPress}
              className="w-20 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-white text-center"
              placeholder="Price"
            />
            <button
              onClick={() => setSimulatedBid(simulatedBid + 5)}
              className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-white"
            >
              +$5
            </button>
          </div>
        </div>

        {/* Team Selection and Draft Button */}
        <div className="flex items-center gap-2 mb-3">
          <select
            value={selectedTeam}
            onChange={(e) => setSelectedTeam(e.target.value)}
            className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white"
          >
            {teams.map(team => (
              <option key={team.id} value={team.name}>
                {team.name}
              </option>
            ))}
          </select>
          <button
            onClick={handleDraft}
            disabled={simulatedBid <= 0}
            className={`px-4 py-2 rounded font-medium transition-colors ${
              simulatedBid > 0
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-gray-700 text-gray-400 cursor-not-allowed'
            }`}
          >
            Draft Player (${simulatedBid})
          </button>
        </div>
        
        {/* Quick bid buttons */}
        <div className="flex gap-2 flex-wrap">
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
  );
};

export default BidAdvisorEnhanced;