/**
 * Market Tracker for Real-Time Auction Price Tracking
 * Tracks actual draft prices vs predicted values
 */

import React, { useState, useEffect, useMemo } from 'react';
import { TrendingUp, TrendingDown, DollarSign, AlertTriangle, Activity, Gauge } from 'lucide-react';
import type { ValuationResult } from '@/lib/calibratedValuationService';
import { useDraftStore } from '@/store/draftStore';

interface DraftedPlayer {
  playerId: string;
  playerName: string;
  position: string;
  actualPrice: number;
  predictedValue: number;
  edge: number;
  teamId: string;
  timestamp: number;
}

interface MarketTrends {
  overallInflation: number;
  positionInflation: Record<string, number>;
  recentTrend: 'hot' | 'cold' | 'neutral';
  bargains: number;
  overpays: number;
  expectedInflation: number; // New: forecast based on money/players remaining
  inflationMultiplier: number; // New: for adjusting remaining player values
}

interface Props {
  valuations: ValuationResult[];
  draftHistory: any[];
  onPriceUpdate?: (playerId: string, actualPrice: number) => void;
}

const MarketTrackerCalibrated: React.FC<Props> = ({ 
  valuations, 
  draftHistory,
  onPriceUpdate 
}) => {
  const { teams } = useDraftStore();
  const [draftedPlayers, setDraftedPlayers] = useState<DraftedPlayer[]>([]);
  const [marketTrends, setMarketTrends] = useState<MarketTrends>({
    overallInflation: 0,
    positionInflation: {},
    recentTrend: 'neutral',
    bargains: 0,
    overpays: 0,
    expectedInflation: 0,
    inflationMultiplier: 1.0
  });

  // Process draft history into drafted players
  useEffect(() => {
    const processed: DraftedPlayer[] = draftHistory
      .filter(pick => pick.price && pick.player)
      .map(pick => {
        const valuation = valuations.find(v => v.playerId === pick.player.id);
        return {
          playerId: pick.player.id,
          playerName: pick.player.name,
          position: pick.player.position,
          actualPrice: pick.price,
          predictedValue: valuation?.auctionValue || pick.price,
          edge: (valuation?.auctionValue || pick.price) - pick.price,
          teamId: pick.team,
          timestamp: pick.timestamp || Date.now()
        };
      });
    
    setDraftedPlayers(processed);
    
    // Calculate market trends
    if (processed.length > 0) {
      const trends = calculateMarketTrends(processed);
      setMarketTrends(trends);
      
      // Update price predictions if callback provided
      if (onPriceUpdate) {
        processed.forEach(p => onPriceUpdate(p.playerId, p.actualPrice));
      }
    }
  }, [draftHistory, valuations, onPriceUpdate]);

  const calculateMarketTrends = (players: DraftedPlayer[]): MarketTrends => {
    // Overall inflation (actual vs predicted)
    const totalActual = players.reduce((sum, p) => sum + p.actualPrice, 0);
    const totalPredicted = players.reduce((sum, p) => sum + p.predictedValue, 0);
    const overallInflation = totalPredicted > 0 
      ? ((totalActual - totalPredicted) / totalPredicted) * 100 
      : 0;

    // Calculate expected inflation based on money and players remaining
    // This is the key formula from best practices
    const teamCount = teams.length || 12; // Default to 12 teams if not initialized
    const totalBudget = teamCount * 200; // $200 per team
    const totalRosterSpots = teamCount * 16; // 16 players per team
    
    const moneySpent = players.reduce((sum, p) => sum + p.actualPrice, 0);
    const moneyRemaining = totalBudget - moneySpent;
    
    const playersPickedCount = players.length;
    const playersRemainingCount = totalRosterSpots - playersPickedCount;
    
    // Get value of remaining players
    const draftedPlayerIds = new Set(players.map(p => p.playerId));
    const remainingPlayersValue = valuations
      .filter(v => !draftedPlayerIds.has(v.playerId))
      .slice(0, playersRemainingCount) // Only count players likely to be drafted
      .reduce((sum, v) => sum + v.auctionValue, 0);
    
    // Calculate inflation multiplier (money remaining / value remaining)
    const inflationMultiplier = remainingPlayersValue > 0 
      ? moneyRemaining / remainingPlayersValue 
      : 1.0;
    
    // Expected inflation percentage
    const expectedInflation = ((inflationMultiplier - 1) * 100);

    // Position-specific inflation
    const positionInflation: Record<string, number> = {};
    const positions = ['QB', 'RB', 'WR', 'TE', 'DST', 'K'];
    
    positions.forEach(pos => {
      const posPlayers = players.filter(p => p.position === pos);
      if (posPlayers.length > 0) {
        const posActual = posPlayers.reduce((sum, p) => sum + p.actualPrice, 0);
        const posPredicted = posPlayers.reduce((sum, p) => sum + p.predictedValue, 0);
        positionInflation[pos] = posPredicted > 0 
          ? ((posActual - posPredicted) / posPredicted) * 100 
          : 0;
      }
    });

    // Recent trend (last 5 picks)
    const recentPicks = players.slice(-5);
    const recentInflation = recentPicks.length > 0
      ? recentPicks.reduce((sum, p) => sum + (p.actualPrice - p.predictedValue), 0) / recentPicks.length
      : 0;
    
    const recentTrend = recentInflation > 2 ? 'hot' : recentInflation < -2 ? 'cold' : 'neutral';

    // Bargains and overpays
    const bargains = players.filter(p => p.edge >= 5).length;
    const overpays = players.filter(p => p.edge <= -5).length;

    return {
      overallInflation,
      positionInflation,
      recentTrend,
      bargains,
      overpays,
      expectedInflation,
      inflationMultiplier
    };
  };

  // Get recent draft activity
  const recentActivity = useMemo(() => {
    return draftedPlayers
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 5);
  }, [draftedPlayers]);

  // Get biggest values and overpays
  const biggestValues = useMemo(() => {
    return [...draftedPlayers]
      .sort((a, b) => b.edge - a.edge)
      .slice(0, 3);
  }, [draftedPlayers]);

  const biggestOverpays = useMemo(() => {
    return [...draftedPlayers]
      .sort((a, b) => a.edge - b.edge)
      .slice(0, 3);
  }, [draftedPlayers]);

  const getTrendIcon = (trend: 'hot' | 'cold' | 'neutral') => {
    switch (trend) {
      case 'hot': return <TrendingUp className="w-4 h-4 text-red-400" />;
      case 'cold': return <TrendingDown className="w-4 h-4 text-blue-400" />;
      default: return <Activity className="w-4 h-4 text-gray-400" />;
    }
  };

  const getInflationColor = (inflation: number) => {
    if (inflation > 10) return 'text-red-400';
    if (inflation > 5) return 'text-orange-400';
    if (inflation < -10) return 'text-blue-400';
    if (inflation < -5) return 'text-cyan-400';
    return 'text-gray-400';
  };

  return (
    <div className="bg-gray-900/50 backdrop-blur-sm rounded-xl p-4 border border-gray-800">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-green-400" />
          Market Tracker
        </h3>
        <div className="flex items-center gap-2">
          {getTrendIcon(marketTrends.recentTrend)}
          <span className="text-sm text-gray-400">
            {marketTrends.recentTrend === 'hot' ? 'Prices Running Hot' :
             marketTrends.recentTrend === 'cold' ? 'Bargain Territory' :
             'Market Normal'}
          </span>
        </div>
      </div>

      {/* Inflation Indicator - New Enhanced Section */}
      <div className="bg-gray-800/50 rounded-lg p-3 mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Gauge className="w-4 h-4 text-purple-400" />
            <span className="text-sm font-semibold text-purple-400">Market Inflation</span>
          </div>
          <div className="text-xs text-gray-400">
            x{marketTrends.inflationMultiplier.toFixed(2)} multiplier
          </div>
        </div>
        
        {/* Inflation Gauge Bar */}
        <div className="relative h-6 bg-gray-700 rounded-full overflow-hidden mb-2">
          <div 
            className={`absolute inset-y-0 left-0 transition-all duration-500 ${
              marketTrends.expectedInflation > 20 ? 'bg-gradient-to-r from-red-600 to-red-400' :
              marketTrends.expectedInflation > 10 ? 'bg-gradient-to-r from-orange-600 to-orange-400' :
              marketTrends.expectedInflation > 0 ? 'bg-gradient-to-r from-yellow-600 to-yellow-400' :
              marketTrends.expectedInflation > -10 ? 'bg-gradient-to-r from-cyan-600 to-cyan-400' :
              'bg-gradient-to-r from-blue-600 to-blue-400'
            }`}
            style={{ width: `${Math.min(100, Math.max(0, (marketTrends.expectedInflation + 50) * 1))}%` }}
          >
            <div className="h-full flex items-center justify-center">
              <span className="text-xs font-bold text-white px-2">
                {marketTrends.expectedInflation > 0 ? '+' : ''}{marketTrends.expectedInflation.toFixed(1)}%
              </span>
            </div>
          </div>
          {/* Center line for 0% */}
          <div className="absolute inset-y-0 left-1/2 w-0.5 bg-gray-900 opacity-50"></div>
        </div>
        
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-gray-500">Expected: </span>
            <span className={`font-bold ${getInflationColor(marketTrends.expectedInflation)}`}>
              {marketTrends.expectedInflation > 0 ? '+' : ''}{marketTrends.expectedInflation.toFixed(1)}%
            </span>
          </div>
          <div>
            <span className="text-gray-500">Actual: </span>
            <span className={`font-bold ${getInflationColor(marketTrends.overallInflation)}`}>
              {marketTrends.overallInflation > 0 ? '+' : ''}{marketTrends.overallInflation.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* Market Overview */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-gray-800/50 rounded-lg p-2">
          <div className="text-xs text-gray-500">Trend</div>
          <div className={`text-sm font-bold ${
            marketTrends.recentTrend === 'hot' ? 'text-red-400' :
            marketTrends.recentTrend === 'cold' ? 'text-blue-400' :
            'text-gray-400'
          }`}>
            {marketTrends.recentTrend.toUpperCase()}
          </div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-2">
          <div className="text-xs text-gray-500">Bargains</div>
          <div className="text-lg font-bold text-green-400">{marketTrends.bargains}</div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-2">
          <div className="text-xs text-gray-500">Overpays</div>
          <div className="text-lg font-bold text-red-400">{marketTrends.overpays}</div>
        </div>
      </div>

      {/* Position Inflation */}
      <div className="mb-4">
        <div className="text-xs text-gray-500 mb-2">Position Markets</div>
        <div className="grid grid-cols-6 gap-1">
          {['QB', 'RB', 'WR', 'TE', 'DST', 'K'].map(pos => (
            <div key={pos} className="text-center">
              <div className="text-xs text-gray-400">{pos}</div>
              <div className={`text-sm font-bold ${getInflationColor(marketTrends.positionInflation[pos] || 0)}`}>
                {marketTrends.positionInflation[pos] 
                  ? `${marketTrends.positionInflation[pos] > 0 ? '+' : ''}${marketTrends.positionInflation[pos].toFixed(0)}%`
                  : '-'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      {recentActivity.length > 0 && (
        <div className="mb-4">
          <div className="text-xs text-gray-500 mb-2">Recent Picks</div>
          <div className="space-y-1">
            {recentActivity.map((player, idx) => (
              <div key={`${player.playerId}-${idx}`} className="flex justify-between items-center text-xs">
                <span className="text-gray-300">
                  {player.playerName} ({player.position})
                </span>
                <div className="flex gap-2">
                  <span className="text-gray-400">${player.actualPrice}</span>
                  <span className={player.edge >= 0 ? 'text-green-400' : 'text-red-400'}>
                    {player.edge >= 0 ? '+' : ''}{player.edge}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Best/Worst Picks */}
      <div className="grid grid-cols-2 gap-2">
        {biggestValues.length > 0 && (
          <div>
            <div className="text-xs text-gray-500 mb-1">Best Values</div>
            {biggestValues.map((player, idx) => (
              <div key={`value-${idx}`} className="text-xs flex justify-between">
                <span className="text-gray-300 truncate">{player.playerName}</span>
                <span className="text-green-400">+${player.edge}</span>
              </div>
            ))}
          </div>
        )}
        
        {biggestOverpays.length > 0 && (
          <div>
            <div className="text-xs text-gray-500 mb-1">Overpays</div>
            {biggestOverpays.map((player, idx) => (
              <div key={`overpay-${idx}`} className="text-xs flex justify-between">
                <span className="text-gray-300 truncate">{player.playerName}</span>
                <span className="text-red-400">-${Math.abs(player.edge)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Market Alert - Enhanced with specific advice */}
      {Math.abs(marketTrends.expectedInflation) > 15 && (
        <div className={`mt-3 p-2 rounded-lg flex items-center gap-2 ${
          marketTrends.expectedInflation > 15 
            ? 'bg-red-900/20 border border-red-700/50' 
            : 'bg-blue-900/20 border border-blue-700/50'
        }`}>
          <AlertTriangle className={`w-4 h-4 ${
            marketTrends.expectedInflation > 15 ? 'text-red-400' : 'text-blue-400'
          }`} />
          <div className="flex-1">
            <span className={`text-xs font-semibold ${
              marketTrends.expectedInflation > 15 ? 'text-red-400' : 'text-blue-400'
            }`}>
              {marketTrends.expectedInflation > 15 
                ? `High Inflation Alert (${marketTrends.expectedInflation.toFixed(0)}%)` 
                : `Deflation Opportunity (${marketTrends.expectedInflation.toFixed(0)}%)`}
            </span>
            <p className="text-xs text-gray-400 mt-1">
              {marketTrends.expectedInflation > 15 
                ? `Multiply remaining player values by ${marketTrends.inflationMultiplier.toFixed(2)}x. Be aggressive on must-have targets.`
                : `Values are depressed. Look for bargains and be patient with nominations.`}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketTrackerCalibrated;