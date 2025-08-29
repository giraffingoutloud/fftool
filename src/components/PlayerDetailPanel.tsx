import React, { useState } from 'react';
import { X, TrendingUp, Award, BarChart3, DollarSign, Users, ChevronDown } from 'lucide-react';
import { useDraftStore } from '@/store/draftStore';
import type { ValuationResult } from '@/lib/calibratedValuationService';
import BidAdvisorEnhanced from './BidAdvisorEnhanced';

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
  const { completeAuction, myTeamId } = useDraftStore();
  const [activeTab, setActiveTab] = useState<'advisor' | 'stats' | 'projections' | 'analysis'>('advisor');
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (!player) {
    return (
      <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-700 rounded-lg p-8 text-center">
        <div className="text-gray-400">
          <Award className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-lg font-medium">Select a player to view details</p>
          <p className="text-sm mt-1">Click the eye icon on any player row</p>
        </div>
      </div>
    );
  }

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

  const getEdgeColor = (edge: number) => {
    if (edge > 10) return 'text-green-400';
    if (edge > 5) return 'text-green-300';
    if (edge > 0) return 'text-yellow-300';
    if (edge > -5) return 'text-orange-300';
    return 'text-red-400';
  };

  const edgePercent = player.edge && player.marketValue 
    ? ((player.edge / player.marketValue) * 100).toFixed(1) 
    : '0.0';

  // Get recommendation text
  const getRecommendation = () => {
    if (!player.edge) return '';
    if (player.edge > 10) return 'STRONG BUY';
    if (player.edge > 5) return 'BUY';
    if (player.edge > 0) return 'VALUE';
    if (player.edge > -5) return 'FAIR';
    return 'AVOID';
  };

  const getRecommendationColor = () => {
    const rec = getRecommendation();
    switch(rec) {
      case 'STRONG BUY': return 'text-green-400';
      case 'BUY': return 'text-green-300';
      case 'VALUE': return 'text-yellow-300';
      case 'FAIR': return 'text-gray-300';
      case 'AVOID': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  if (isCollapsed) {
    return (
      <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-700 rounded-lg px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className={`px-2 py-1 rounded text-xs font-bold bg-gradient-to-r ${getPositionColor()} text-white`}>
              {player.position}
            </span>
            <span className="text-white font-semibold">{player.playerName}</span>
            <span className={`font-medium ${getRecommendationColor()}`}>
              {getRecommendation()}
            </span>
            <span className="text-gray-400 text-sm">Bye: {player.byeWeek || '-'}</span>
            <span className="text-green-400 font-semibold">${player.auctionValue}</span>
          </div>
          <button
            onClick={() => setIsCollapsed(false)}
            className="text-gray-400 hover:text-white transition-colors p-1"
          >
            <ChevronDown className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-700 rounded-lg overflow-hidden">
      {/* Header - Single Line */}
      <div className={`bg-gradient-to-r ${getPositionColor()} px-4 py-3`}>
        <div className="flex justify-between items-center">
          {/* Left: Name and Recommendation */}
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-white">
              {player.playerName}
            </h2>
            <span className={`font-semibold ${getRecommendationColor()}`}>
              {getRecommendation()}
            </span>
          </div>
          
          {/* Center: Key Metrics */}
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <span className="text-sm text-white/70">Bye:</span>
              <span className="font-bold text-white">{player.byeWeek || '-'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-white/70">SOS:</span>
              <span className={`font-bold ${
                player.teamSeasonSOS && player.teamSeasonSOS < 0 ? 'text-green-300' :
                player.teamSeasonSOS && player.teamSeasonSOS > 0 ? 'text-red-300' :
                'text-white'
              }`}>
                {player.teamSeasonSOS?.toFixed(2) || '-'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-white/70">Points:</span>
              <span className="font-bold text-white">
                {player.projectedPoints?.toFixed(1) || '-'}
              </span>
            </div>
          </div>

          {/* Right: Close/Collapse buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => setIsCollapsed(true)}
              className="text-white/70 hover:text-white transition-colors p-1"
              title="Collapse panel"
            >
              <ChevronDown className="w-5 h-5 rotate-180" />
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="text-white/70 hover:text-white transition-colors p-1"
                title="Close panel"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-700">
        <div className="flex">
          {['advisor', 'stats', 'projections', 'analysis'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-4 py-2 font-medium capitalize transition-colors ${
                activeTab === tab
                  ? 'text-white border-b-2 border-blue-500 bg-gray-800/50'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/30'
              }`}
            >
              {tab === 'advisor' ? 'Bid Advisor' : tab}
            </button>
          ))}
        </div>
      </div>

      {/* Content - No scroll, full height */}
      <div className="p-4">
        {activeTab === 'advisor' && (
          <BidAdvisorEnhanced 
            player={player} 
            allPlayers={allPlayers}
            onDraft={handleDraft}
          />
        )}

        {activeTab === 'stats' && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="w-4 h-4 text-green-400" />
                <span className="text-xs text-gray-400">Our Value</span>
              </div>
              <div className="text-xl font-bold text-white">
                ${player.auctionValue}
              </div>
            </div>
            
            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-blue-400" />
                <span className="text-xs text-gray-400">Market Price</span>
              </div>
              <div className="text-xl font-bold text-white">
                ${player.marketValue || '-'}
              </div>
            </div>

            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Award className="w-4 h-4 text-yellow-400" />
                <span className="text-xs text-gray-400">Edge</span>
              </div>
              <div className={`text-xl font-bold ${getEdgeColor(player.edge || 0)}`}>
                ${player.edge?.toFixed(0) || '0'} ({edgePercent}%)
              </div>
            </div>

            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <BarChart3 className="w-4 h-4 text-purple-400" />
                <span className="text-xs text-gray-400">VORP</span>
              </div>
              <div className="text-xl font-bold text-white">
                {player.vbd?.toFixed(1) || '-'}
              </div>
            </div>

            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-4 h-4 text-orange-400" />
                <span className="text-xs text-gray-400">Rank</span>
              </div>
              <div className="text-xl font-bold text-white">
                #{player.rank || '-'}
              </div>
            </div>

            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-gray-400">Confidence</span>
              </div>
              <div className="text-xl font-bold text-white">
                {player.confidence?.toFixed(1) || '-'}/10
              </div>
            </div>
          </div>
        )}

        {activeTab === 'projections' && (
          <div className="space-y-3">
            <div className="bg-gray-800/50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-400 mb-3">Season Projections</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-xs text-gray-500">Total Points</span>
                  <div className="text-lg font-semibold text-white">
                    {player.projectedPoints?.toFixed(1) || '-'}
                  </div>
                </div>
                <div>
                  <span className="text-xs text-gray-500">Points/Game</span>
                  <div className="text-lg font-semibold text-white">
                    {player.projectedPoints ? (player.projectedPoints / 17).toFixed(1) : '-'}
                  </div>
                </div>
              </div>
            </div>

            {player.recommendation && (
              <div className="bg-gray-800/50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-400 mb-2">Recommendation</h3>
                <p className="text-white">
                  {player.recommendation}
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'analysis' && (
          <div className="space-y-3">
            <div className="bg-gray-800/50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-400 mb-2">Value Analysis</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Position Rank:</span>
                  <span className="text-white font-medium">
                    {player.position}{player.positionRank || '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Value Tier:</span>
                  <span className={`font-medium ${getTierColor()}`}>
                    {player.tier === 'elite' ? 'Elite' : 
                     player.tier === 'tier1' ? 'Tier 1' :
                     player.tier === 'tier2' ? 'Tier 2' :
                     player.tier === 'tier3' ? 'Tier 3' : 'Replacement'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Max Bid (85%):</span>
                  <span className="text-green-400 font-medium">
                    ${Math.round(player.auctionValue * 0.85)}
                  </span>
                </div>
              </div>
            </div>

            {player.edge && (
              <div className="bg-gray-800/50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-400 mb-2">Market Edge</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Value vs Market:</span>
                    <span className={`font-bold ${getEdgeColor(player.edge)}`}>
                      {player.edge > 0 ? '+' : ''}{player.edge.toFixed(0)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                    <div 
                      className={`h-full transition-all ${
                        player.edge > 0 ? 'bg-green-500' : 'bg-red-500'
                      }`}
                      style={{ 
                        width: `${Math.min(100, Math.abs(Number(edgePercent)))}%` 
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PlayerDetailPanel;