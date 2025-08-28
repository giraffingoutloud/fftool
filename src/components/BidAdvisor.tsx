/**
 * Real-Time Bid Advisor Component
 * Displays dynamic bidding recommendations in player modals
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
  ChevronUp
} from 'lucide-react';
import { bidAdvisorService, type BidRecommendation } from '@/lib/bidAdvisorService';
import type { ValuationResult } from '@/lib/calibratedValuationService';
import { useDraftStore } from '@/store/draftStore';

interface BidAdvisorProps {
  player: ValuationResult;
  currentBid?: number;
  onBidChange?: (bid: number) => void;
  allPlayers?: ValuationResult[]; // Pass all players for context
}

const BidAdvisor: React.FC<BidAdvisorProps> = ({ player, currentBid = 0, onBidChange, allPlayers = [] }) => {
  const { teams, myTeamId, draftHistory } = useDraftStore();
  const [showDetails, setShowDetails] = useState(false);
  const [simulatedBid, setSimulatedBid] = useState(currentBid);

  // Get recommendation
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

    // Get available players (those not drafted)
    const draftedIds = new Set(draftHistory.map(pick => pick.player?.id).filter(Boolean));
    const availablePlayers = allPlayers.filter(p => !draftedIds.has(p.playerId));

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
  }, [player, simulatedBid, teams, myTeamId, draftHistory]);

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

      {/* Market Intelligence */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-gray-800/50 rounded-lg p-2">
          <div className="text-xs text-gray-400 mb-1">Market Inflation</div>
          <div className={`text-lg font-bold ${recommendation.marketInflation > 0 ? 'text-red-400' : 'text-green-400'}`}>
            {recommendation.marketInflation > 0 ? '+' : ''}{recommendation.marketInflation}%
          </div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-2">
          <div className="text-xs text-gray-400 mb-1">Expected Final</div>
          <div className="text-lg font-bold text-white">
            ${recommendation.expectedFinalPrice}
          </div>
        </div>
      </div>

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

      {/* Bid Simulator */}
      <div className="border-t border-gray-700 pt-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm text-gray-400">Simulate Bid Amount</label>
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
              onChange={(e) => setSimulatedBid(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-20 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-white text-center"
            />
            <button
              onClick={() => setSimulatedBid(simulatedBid + 5)}
              className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-white"
            >
              +$5
            </button>
          </div>
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

      {/* Expandable Details */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="w-full mt-4 flex items-center justify-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
      >
        {showDetails ? 'Hide' : 'Show'} Advanced Details
        {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {showDetails && (
        <div className="mt-4 pt-4 border-t border-gray-700 space-y-3">
          {/* Strategy Recommendations */}
          <div>
            <div className="text-sm font-medium text-gray-400 mb-2">Strategy</div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-gray-800/50 rounded p-2">
                <div className="text-xs text-gray-500">Nomination</div>
                <div className="text-sm text-white capitalize">
                  {recommendation.nominationStrategy.replace('-', ' ')}
                </div>
              </div>
              <div className="bg-gray-800/50 rounded p-2">
                <div className="text-xs text-gray-500">Bidding</div>
                <div className="text-sm text-white capitalize">
                  {recommendation.biddingStrategy}
                </div>
              </div>
            </div>
          </div>

          {/* Likely Competitors */}
          {recommendation.likelyCompetitors.length > 0 && (
            <div>
              <div className="text-sm font-medium text-gray-400 mb-2">Likely Competitors</div>
              <div className="flex gap-2 flex-wrap">
                {recommendation.likelyCompetitors.map((team, idx) => (
                  <span key={idx} className="px-2 py-1 bg-gray-700 rounded text-sm text-gray-300">
                    {team}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Alternative Players */}
          {recommendation.alternativePlayers.length > 0 && (
            <div>
              <div className="text-sm font-medium text-gray-400 mb-2">Alternative Options</div>
              <div className="space-y-1">
                {recommendation.alternativePlayers.map((alt, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="text-gray-300">{alt.playerName}</span>
                    <span className="text-gray-500">${alt.auctionValue}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BidAdvisor;