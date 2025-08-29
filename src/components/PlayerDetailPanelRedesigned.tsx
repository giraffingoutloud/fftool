import React, { useState } from 'react';
import { 
  X, 
  TrendingUp, 
  Award, 
  BarChart3, 
  DollarSign, 
  Target,
  Calendar,
  Activity,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  Zap,
  Users,
  Shield
} from 'lucide-react';
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
  const [activeView, setActiveView] = useState<'overview' | 'advisor' | 'projections'>('overview');

  if (!player) {
    return (
      <div className="bg-gray-900/80 backdrop-blur-sm border border-gray-700/50 rounded-xl p-6">
        <div className="flex items-center justify-center gap-3 text-gray-500">
          <Target className="w-8 h-8 opacity-40" />
          <div>
            <p className="text-sm font-medium">No Player Selected</p>
            <p className="text-xs opacity-75">Click the eye icon on any player to view details</p>
          </div>
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
    if (!player.edge) return { text: 'HOLD', color: 'text-gray-400', icon: <AlertCircle className="w-3 h-3" /> };
    if (player.edge > 10) return { text: 'STRONG BUY', color: 'text-green-400', icon: <CheckCircle className="w-3 h-3" /> };
    if (player.edge > 5) return { text: 'BUY', color: 'text-green-300', icon: <TrendingUp className="w-3 h-3" /> };
    if (player.edge > 0) return { text: 'VALUE', color: 'text-yellow-300', icon: <Zap className="w-3 h-3" /> };
    if (player.edge > -5) return { text: 'FAIR', color: 'text-gray-300', icon: <Activity className="w-3 h-3" /> };
    return { text: 'AVOID', color: 'text-red-400', icon: <X className="w-3 h-3" /> };
  };

  const recommendation = getRecommendation();
  const tier = getTierBadge();
  const edgePercent = player.edge && player.marketValue 
    ? ((player.edge / player.marketValue) * 100).toFixed(0) 
    : '0';

  // SOS color
  const getSosColor = () => {
    if (!player.teamSeasonSOS) return 'text-gray-400';
    if (player.teamSeasonSOS < -0.5) return 'text-green-400'; // Easy schedule
    if (player.teamSeasonSOS > 0.5) return 'text-red-400'; // Hard schedule
    return 'text-yellow-400'; // Average
  };

  return (
    <div className="bg-gray-900/90 backdrop-blur-md border border-gray-700/50 rounded-xl overflow-hidden shadow-2xl">
      {/* Compact Header */}
      <div className="bg-gradient-to-r from-gray-800 to-gray-850 p-3 border-b border-gray-700/50">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Player Info */}
          <div className="flex items-center gap-3 flex-1">
            <div className={`px-2 py-1 rounded-md text-xs font-bold border ${getPositionColor()}`}>
              {player.position}
            </div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white">{player.playerName}</h2>
              <span className="text-gray-400 text-sm">{player.team}</span>
            </div>
            <div className={`px-2 py-0.5 rounded text-xs font-bold ${tier.color}`}>
              {tier.label}
            </div>
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-800 ${recommendation.color}`}>
              {recommendation.icon}
              <span className="text-xs font-semibold">{recommendation.text}</span>
            </div>
          </div>

          {/* Right: Quick Stats */}
          <div className="flex items-center gap-4 text-xs">
            <div className="text-center">
              <div className="text-gray-500">BYE</div>
              <div className="font-bold text-white">{player.byeWeek || '-'}</div>
            </div>
            <div className="text-center">
              <div className="text-gray-500">SOS</div>
              <div className={`font-bold ${getSosColor()}`}>
                {player.teamSeasonSOS?.toFixed(1) || '-'}
              </div>
            </div>
            <div className="text-center">
              <div className="text-gray-500">PTS</div>
              <div className="font-bold text-white">{player.projectedPoints?.toFixed(0) || '-'}</div>
            </div>
            <div className="text-center">
              <div className="text-gray-500">RANK</div>
              <div className="font-bold text-yellow-400">#{player.rank || '-'}</div>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="text-gray-500 hover:text-white transition-colors p-1 hover:bg-gray-700 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* View Tabs */}
      <div className="flex border-b border-gray-700/50 bg-gray-800/50">
        <button
          onClick={() => setActiveView('overview')}
          className={`flex-1 px-3 py-2 text-xs font-medium transition-all ${
            activeView === 'overview'
              ? 'text-white bg-gray-700/50 border-b-2 border-blue-500'
              : 'text-gray-400 hover:text-white hover:bg-gray-700/30'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveView('advisor')}
          className={`flex-1 px-3 py-2 text-xs font-medium transition-all ${
            activeView === 'advisor'
              ? 'text-white bg-gray-700/50 border-b-2 border-blue-500'
              : 'text-gray-400 hover:text-white hover:bg-gray-700/30'
          }`}
        >
          Bid Advisor
        </button>
        <button
          onClick={() => setActiveView('projections')}
          className={`flex-1 px-3 py-2 text-xs font-medium transition-all ${
            activeView === 'projections'
              ? 'text-white bg-gray-700/50 border-b-2 border-blue-500'
              : 'text-gray-400 hover:text-white hover:bg-gray-700/30'
          }`}
        >
          Projections
        </button>
      </div>

      {/* Content Area - Compact */}
      <div className="p-3 bg-gray-850/50">
        {activeView === 'overview' && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Valuation Metrics */}
            <div className="col-span-2 grid grid-cols-4 gap-2">
              <div className="bg-gray-800/50 rounded-lg p-2 border border-gray-700/30">
                <div className="text-[10px] text-gray-500 uppercase tracking-wider">Our Value</div>
                <div className="text-lg font-bold text-white">${player.auctionValue || 0}</div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-2 border border-gray-700/30">
                <div className="text-[10px] text-gray-500 uppercase tracking-wider">Market</div>
                <div className="text-lg font-bold text-blue-400">${player.marketValue || '-'}</div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-2 border border-gray-700/30">
                <div className="text-[10px] text-gray-500 uppercase tracking-wider">Edge</div>
                <div className={`text-lg font-bold ${player.edge && player.edge > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  ${player.edge?.toFixed(0) || 0}
                </div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-2 border border-gray-700/30">
                <div className="text-[10px] text-gray-500 uppercase tracking-wider">Max Bid</div>
                <div className="text-lg font-bold text-yellow-400">
                  ${Math.round((player.auctionValue || 0) * 0.85)}
                </div>
              </div>
            </div>

            {/* Performance Metrics */}
            <div className="bg-gray-800/50 rounded-lg p-2 border border-gray-700/30">
              <div className="flex items-center gap-1 mb-1">
                <BarChart3 className="w-3 h-3 text-purple-400" />
                <span className="text-[10px] text-gray-500 uppercase">VORP</span>
              </div>
              <div className="text-lg font-bold text-white">{player.vbd?.toFixed(0) || '-'}</div>
              <div className="text-[10px] text-gray-400">vs replacement</div>
            </div>

            {/* ADP */}
            <div className="bg-gray-800/50 rounded-lg p-2 border border-gray-700/30">
              <div className="flex items-center gap-1 mb-1">
                <Users className="w-3 h-3 text-orange-400" />
                <span className="text-[10px] text-gray-500 uppercase">ADP</span>
              </div>
              <div className="text-lg font-bold text-white">{player.averageAuctionValue || '-'}</div>
              <div className="text-[10px] text-gray-400">consensus</div>
            </div>

            {/* Edge Summary */}
            <div className="col-span-2 bg-gray-800/50 rounded-lg p-2 border border-gray-700/30">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider">Value Rating</div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5].map(i => (
                        <div 
                          key={i} 
                          className={`w-4 h-2 rounded-sm ${
                            i <= Math.ceil((Number(edgePercent) + 50) / 20) 
                              ? 'bg-gradient-to-r from-green-500 to-green-400' 
                              : 'bg-gray-700'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-gray-400">{edgePercent}% edge</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-gray-500">Confidence</div>
                  <div className="text-sm font-bold text-white">{player.confidence?.toFixed(0) || '-'}/10</div>
                </div>
              </div>
            </div>

            {/* Position Rank */}
            <div className="bg-gray-800/50 rounded-lg p-2 border border-gray-700/30">
              <div className="flex items-center gap-1 mb-1">
                <Award className="w-3 h-3 text-yellow-400" />
                <span className="text-[10px] text-gray-500 uppercase">Position</span>
              </div>
              <div className="text-lg font-bold text-white">
                {player.position}{player.positionRank || '-'}
              </div>
              <div className="text-[10px] text-gray-400">rank</div>
            </div>

            {/* PPG */}
            <div className="bg-gray-800/50 rounded-lg p-2 border border-gray-700/30">
              <div className="flex items-center gap-1 mb-1">
                <Activity className="w-3 h-3 text-cyan-400" />
                <span className="text-[10px] text-gray-500 uppercase">PPG</span>
              </div>
              <div className="text-lg font-bold text-white">
                {player.projectedPoints ? (player.projectedPoints / 17).toFixed(1) : '-'}
              </div>
              <div className="text-[10px] text-gray-400">per game</div>
            </div>
          </div>
        )}

        {activeView === 'advisor' && (
          <div className="max-h-64 overflow-y-auto">
            <BidAdvisorEnhanced 
              player={player} 
              allPlayers={allPlayers}
              onDraft={handleDraft}
            />
          </div>
        )}

        {activeView === 'projections' && (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/30">
              <div className="text-xs text-gray-500 mb-1">Season Total</div>
              <div className="text-2xl font-bold text-white">
                {player.projectedPoints?.toFixed(0) || '-'}
              </div>
              <div className="text-xs text-gray-400">fantasy points</div>
            </div>
            
            <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/30">
              <div className="text-xs text-gray-500 mb-1">Weekly Avg</div>
              <div className="text-2xl font-bold text-white">
                {player.projectedPoints ? (player.projectedPoints / 17).toFixed(1) : '-'}
              </div>
              <div className="text-xs text-gray-400">points/game</div>
            </div>

            <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/30">
              <div className="text-xs text-gray-500 mb-1">Consistency</div>
              <div className="text-2xl font-bold text-white">
                {player.confidence ? (player.confidence * 10).toFixed(0) : '-'}%
              </div>
              <div className="text-xs text-gray-400">projection confidence</div>
            </div>

            {player.recommendation && (
              <div className="col-span-2 lg:col-span-3 bg-blue-900/20 rounded-lg p-3 border border-blue-700/30">
                <div className="flex items-start gap-2">
                  <Shield className="w-4 h-4 text-blue-400 mt-0.5" />
                  <div>
                    <div className="text-xs font-medium text-blue-400 mb-1">Analysis</div>
                    <p className="text-xs text-gray-300 leading-relaxed">
                      {player.recommendation}
                    </p>
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