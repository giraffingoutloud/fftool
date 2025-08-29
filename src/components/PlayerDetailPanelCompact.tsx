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
import type { Player, Position } from '@/types';
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
          <div className="flex items-center gap-2">
            <div className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${getPositionColor()}`}>
              {player.position}
            </div>
            <h2 className="text-base font-bold text-white">{player.playerName}</h2>
            <span className="text-gray-400 text-xs">{player.team}</span>
            <div className={`px-3 py-1.5 rounded text-sm font-bold ${tier.color}`}>
              {tier.label}
            </div>
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${recommendation.bg} ${recommendation.color}`}>
              {recommendation.icon}
              <span className="text-[10px] font-semibold">{recommendation.text}</span>
            </div>
          </div>

          {/* Center: Valuation Metrics */}
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

          {/* Right: Draft Button, Value Rating Bar and Close */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleDraft((player.auctionValue || 0), myTeamId)}
              className="px-4 py-1.5 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white font-bold rounded-lg text-sm transition-all transform hover:scale-105 shadow-lg"
            >
              Draft Player
            </button>
            <div className="bg-gray-900/50 rounded px-2 py-0.5">
              <div className="flex items-center gap-2">
                <div>
                  <div className="text-[9px] text-gray-500">EDGE</div>
                  <div className="text-[10px] font-bold text-white">{edgePercent}%</div>
                </div>
                <div className="flex gap-0.5">
                  {[1,2,3,4,5].map(i => (
                    <div 
                      key={i} 
                      className={`w-2 h-3 rounded-sm ${
                        i <= Math.ceil((Number(edgePercent) + 50) / 20) 
                          ? 'bg-gradient-to-r from-green-500 to-green-400' 
                          : 'bg-gray-700'
                      }`}
                    />
                  ))}
                </div>
                <div>
                  <div className="text-[9px] text-gray-500">CONF</div>
                  <div className="text-[10px] font-bold text-white">{player.confidence?.toFixed(0) || '-'}/10</div>
                </div>
              </div>
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