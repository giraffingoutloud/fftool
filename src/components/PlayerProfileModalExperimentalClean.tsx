import React, { useState } from 'react';
import { X, TrendingUp, Award, BarChart3, DollarSign, Users } from 'lucide-react';
import { useDraftStore } from '@/store/draftStore';
import type { ValuationResult } from '@/lib/calibratedValuationService';
import BidAdvisorEnhanced from './BidAdvisorEnhanced';

interface PlayerProfileModalProps {
  player: ValuationResult;
  isOpen: boolean;
  onClose: () => void;
  allPlayers?: ValuationResult[];
}

const PlayerProfileModal: React.FC<PlayerProfileModalProps> = ({ 
  player, 
  isOpen, 
  onClose, 
  allPlayers = [] 
}) => {
  const { completeAuction, myTeamId } = useDraftStore();
  const [activeTab, setActiveTab] = useState<'advisor' | 'stats' | 'projections' | 'analysis'>('advisor');

  if (!isOpen) return null;

  const handleDraft = (price: number, teamId: string) => {
    const playerData = {
      id: player.playerId,
      name: player.playerName,
      position: player.position,
      team: player.team,
      projectedPoints: player.projectedPoints,
      value: player.auctionValue,
      tier: player.tier || 'replacement'
    };

    completeAuction(playerData, price, teamId);
    onClose();
  };

  // Position color classes
  const getPositionColor = () => {
    const colors: Record<string, string> = {
      QB: 'from-red-500 to-red-700',
      RB: 'from-green-500 to-green-700',
      WR: 'from-blue-500 to-blue-700',
      TE: 'from-orange-500 to-orange-700',
      DST: 'from-purple-500 to-purple-700',
      K: 'from-yellow-500 to-yellow-700'
    };
    return colors[player.position] || 'from-gray-500 to-gray-700';
  };

  const getTierColor = () => {
    const tierColors: Record<string, string> = {
      elite: 'text-purple-400 bg-purple-900/30',
      tier1: 'text-blue-400 bg-blue-900/30',
      tier2: 'text-green-400 bg-green-900/30',
      tier3: 'text-yellow-400 bg-yellow-900/30',
      replacement: 'text-gray-400 bg-gray-900/30'
    };
    return tierColors[player.tier] || 'text-gray-400 bg-gray-900/30';
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className={`bg-gradient-to-r ${getPositionColor()} p-6 rounded-t-xl`}>
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-3xl font-bold text-white">
                  {player.playerName}
                </h2>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getTierColor()}`}>
                  {player.tier === 'elite' ? 'Elite' : 
                   player.tier === 'tier1' ? 'Tier 1' :
                   player.tier === 'tier2' ? 'Tier 2' :
                   player.tier === 'tier3' ? 'Tier 3' : 'Replacement'}
                </span>
              </div>
              <div className="flex items-center gap-4 mt-2">
                <span className="text-white/90">
                  {player.position} - {player.team}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-sm text-white/70">Bye Week</div>
                <div className="text-xl font-bold text-white">
                  {player.byeWeek || '-'}
                </div>
              </div>
              <div className="text-center">
                <div className="text-sm text-white/70">SOS</div>
                <div className={`text-xl font-bold ${
                  player.teamSeasonSOS && player.teamSeasonSOS < 0 ? 'text-green-300' :
                  player.teamSeasonSOS && player.teamSeasonSOS > 0 ? 'text-red-300' :
                  'text-white'
                }`}>
                  {player.teamSeasonSOS ? player.teamSeasonSOS.toFixed(2) : '-'}
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-white">
                  ${player.auctionValue}
                </div>
                <div className="text-sm text-white/80">Recommended Value</div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700">
          <button
            onClick={() => setActiveTab('advisor')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'advisor' 
                ? 'text-purple-400 border-b-2 border-purple-400' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            🤖 Bid Advisor
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'stats' 
                ? 'text-blue-400 border-b-2 border-blue-400' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Stats & Metrics
          </button>
          <button
            onClick={() => setActiveTab('projections')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'projections' 
                ? 'text-blue-400 border-b-2 border-blue-400' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Projections
          </button>
          <button
            onClick={() => setActiveTab('analysis')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'analysis' 
                ? 'text-blue-400 border-b-2 border-blue-400' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Analysis
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {activeTab === 'advisor' && (
            <BidAdvisorEnhanced 
              player={player} 
              currentBid={0}
              onDraft={handleDraft}
              allPlayers={allPlayers}
            />
          )}
          
          {activeTab === 'stats' && (
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <div className="text-gray-400 text-sm mb-1">Projected Points</div>
                  <div className="text-2xl font-bold text-white">
                    {player.projectedPoints.toFixed(1)}
                  </div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm mb-1">VORP</div>
                  <div className="text-xl font-semibold text-green-400">
                    {player.vorp?.toFixed(1) || player.vbd?.toFixed(1)}
                  </div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm mb-1">Overall Rank</div>
                  <div className="text-xl font-semibold text-white">
                    #{player.rank}
                  </div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm mb-1">Position Rank</div>
                  <div className="text-xl font-semibold text-white">
                    {player.position}{player.positionRank}
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <div className="text-gray-400 text-sm mb-1">ADP</div>
                  <div className="text-xl font-semibold text-white">
                    {player.adp ? player.adp.toFixed(1) : 'N/A'}
                  </div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm mb-1">Market Value</div>
                  <div className="text-xl font-semibold text-yellow-400">
                    ${player.marketValue}
                  </div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm mb-1">Edge vs Market</div>
                  <div className={`text-xl font-semibold ${player.edge >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {player.edge > 0 ? '+' : ''}${player.edge.toFixed(0)}
                  </div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm mb-1">SOS</div>
                  <div className="text-xl font-semibold text-white">
                    {player.teamSeasonSOS?.toFixed(2) || 'N/A'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'projections' && (
            <div className="space-y-4">
              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-white mb-3">2025 Projections</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-gray-400">Total Points:</span>
                    <span className="text-white ml-2">{player.projectedPoints.toFixed(1)}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Points/Game:</span>
                    <span className="text-white ml-2">{(player.projectedPoints / 17).toFixed(1)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'analysis' && (
            <div className="space-y-4">
              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-white mb-3">Valuation Analysis</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Our Value:</span>
                    <span className="text-green-400 font-semibold">${player.auctionValue}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Market Value:</span>
                    <span className="text-yellow-400">${player.marketValue}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Max Bid:</span>
                    <span className="text-blue-400">${player.maxBid}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Min Bid:</span>
                    <span className="text-gray-300">${player.minBid}</span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-white mb-3">Draft Strategy</h3>
                <div className="text-gray-300">
                  {player.tier === 'elite' ? 
                    'Elite talent - worth paying premium if needed for roster construction.' :
                   player.tier === 'tier1' ?
                    'Strong starter - target at or slightly above value.' :
                   player.tier === 'tier2' ?
                    'Solid contributor - good value play if price is right.' :
                   player.tier === 'tier3' ?
                    'Depth piece - only draft at discount.' :
                    'Replacement level - wait for end of draft.'}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/80 hover:text-white"
        >
          <X className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};

export default PlayerProfileModal;