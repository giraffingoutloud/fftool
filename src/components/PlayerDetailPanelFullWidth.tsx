import React from 'react';
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

  if (!player) {
    return (
      <div className="bg-gray-900/80 backdrop-blur-sm border border-gray-700/50 rounded-xl p-4">
        <div className="flex items-center justify-center gap-3 text-gray-500">
          <Target className="w-6 h-6 opacity-40" />
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

  // SOS color
  const getSosColor = () => {
    if (!player.teamSeasonSOS) return 'text-gray-400';
    if (player.teamSeasonSOS < -0.5) return 'text-green-400';
    if (player.teamSeasonSOS > 0.5) return 'text-red-400';
    return 'text-yellow-400';
  };

  return (
    <div className="bg-gray-900/90 backdrop-blur-md border border-gray-700/50 rounded-xl overflow-hidden shadow-2xl">
      {/* Enhanced Header Bar with Valuation Info */}
      <div className="bg-gradient-to-r from-gray-800 to-gray-850 px-4 py-2 border-b border-gray-700/50">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Player Identity */}
          <div className="flex items-center gap-3">
            <div className={`px-2 py-1 rounded-md text-xs font-bold border ${getPositionColor()}`}>
              {player.position}
            </div>
            <h2 className="text-lg font-bold text-white">{player.playerName}</h2>
            <span className="text-gray-400 text-sm">{player.team}</span>
            <div className={`px-2 py-0.5 rounded text-xs font-bold ${tier.color}`}>
              {tier.label}
            </div>
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${recommendation.bg} ${recommendation.color}`}>
              {recommendation.icon}
              <span className="text-xs font-semibold">{recommendation.text}</span>
            </div>
          </div>

          {/* Center: Valuation Metrics */}
          <div className="flex items-center gap-4 bg-gray-900/50 rounded-lg px-3 py-1">
            <div className="text-center">
              <div className="text-[10px] text-gray-500">OUR VALUE</div>
              <div className="text-sm font-bold text-white">${player.auctionValue || 0}</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] text-gray-500">MARKET</div>
              <div className="text-sm font-bold text-blue-400">${player.marketValue || '-'}</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] text-gray-500">EDGE</div>
              <div className={`text-sm font-bold ${player.edge && player.edge > 0 ? 'text-green-400' : 'text-red-400'}`}>
                ${player.edge?.toFixed(0) || 0}
              </div>
            </div>
            <div className="text-center">
              <div className="text-[10px] text-gray-500">MAX BID</div>
              <div className="text-sm font-bold text-yellow-400">
                ${Math.round((player.auctionValue || 0) * 0.85)}
              </div>
            </div>
          </div>

          {/* Right: Value Rating Bar and Close */}
          <div className="flex items-center gap-4">
            <div className="bg-gray-900/50 rounded-lg px-3 py-1">
              <div className="flex items-center gap-3">
                <div>
                  <div className="text-[10px] text-gray-500">EDGE</div>
                  <div className="text-xs font-bold text-white">{edgePercent}%</div>
                </div>
                <div className="flex gap-0.5">
                  {[1,2,3,4,5].map(i => (
                    <div 
                      key={i} 
                      className={`w-3 h-4 rounded-sm ${
                        i <= Math.ceil((Number(edgePercent) + 50) / 20) 
                          ? 'bg-gradient-to-r from-green-500 to-green-400' 
                          : 'bg-gray-700'
                      }`}
                    />
                  ))}
                </div>
                <div>
                  <div className="text-[10px] text-gray-500">CONF</div>
                  <div className="text-xs font-bold text-white">{player.confidence?.toFixed(0) || '-'}/10</div>
                </div>
              </div>
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

      {/* Main Content Grid - All Info in One View */}
      <div className="grid grid-cols-12 gap-3 p-3 bg-gray-850/50">
        
        {/* Left Section: Stats and Performance */}
        <div className="col-span-12 lg:col-span-3 space-y-2">

          {/* Combined Stats Grid */}
          <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/30">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-3">Player Stats</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400">Rank</span>
                <span className="text-sm font-bold text-yellow-400">#{player.rank || '-'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400">Position</span>
                <span className="text-sm font-bold text-white">{player.position}{player.positionRank || '-'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400">Points</span>
                <span className="text-sm font-bold text-white">{player.projectedPoints?.toFixed(0) || '-'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400">PPG</span>
                <span className="text-sm font-bold text-white">
                  {player.projectedPoints ? (player.projectedPoints / 17).toFixed(1) : '-'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400">VORP</span>
                <span className="text-sm font-bold text-purple-400">{player.vbd?.toFixed(0) || '-'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400">ADP</span>
                <span className="text-sm font-bold text-white">{player.averageAuctionValue || '-'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400">Bye</span>
                <span className="text-sm font-bold text-white">{player.byeWeek || '-'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400">SOS</span>
                <span className={`text-sm font-bold ${getSosColor()}`}>
                  {player.teamSeasonSOS?.toFixed(1) || '-'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Center Section: Bid Advisor */}
        <div className="col-span-12 lg:col-span-6">
          <div className="bg-gray-800/50 rounded-lg border border-gray-700/30 h-full">
            <div className="p-3 border-b border-gray-700/30">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-blue-400" />
                <span className="text-xs text-gray-500 uppercase tracking-wider">Bid Advisor</span>
              </div>
            </div>
            <div className="p-3" style={{ minHeight: '400px' }}>
              <BidAdvisorEnhanced 
                player={player} 
                allPlayers={allPlayers}
                onDraft={handleDraft}
              />
            </div>
          </div>
        </div>

        {/* Right Section: Additional Info */}
        <div className="col-span-12 lg:col-span-3 space-y-2">

          {/* Key Insights */}
          <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/30">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Key Insights</div>
            <div className="space-y-2">
              {player.edge && player.edge > 10 && (
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-3 h-3 text-green-400 mt-0.5" />
                  <span className="text-xs text-gray-300">Significant value opportunity</span>
                </div>
              )}
              {player.tier === 'elite' && (
                <div className="flex items-start gap-2">
                  <Award className="w-3 h-3 text-purple-400 mt-0.5" />
                  <span className="text-xs text-gray-300">Elite tier player</span>
                </div>
              )}
              {player.teamSeasonSOS && player.teamSeasonSOS < -0.5 && (
                <div className="flex items-start gap-2">
                  <Shield className="w-3 h-3 text-green-400 mt-0.5" />
                  <span className="text-xs text-gray-300">Favorable schedule</span>
                </div>
              )}
              {player.teamSeasonSOS && player.teamSeasonSOS > 0.5 && (
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-3 h-3 text-red-400 mt-0.5" />
                  <span className="text-xs text-gray-300">Difficult schedule</span>
                </div>
              )}
              {player.vbd && player.vbd > 50 && (
                <div className="flex items-start gap-2">
                  <BarChart3 className="w-3 h-3 text-purple-400 mt-0.5" />
                  <span className="text-xs text-gray-300">High VORP value</span>
                </div>
              )}
            </div>
          </div>

          {/* Recommendation Summary */}
          {player.recommendation && (
            <div className="bg-blue-900/20 rounded-lg p-3 border border-blue-700/30">
              <div className="flex items-start gap-2">
                <Activity className="w-3 h-3 text-blue-400 mt-0.5" />
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
      </div>
    </div>
  );
};

export default PlayerDetailPanel;