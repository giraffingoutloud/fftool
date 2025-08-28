import React, { useMemo } from 'react';
import { UltraPlayerValuation } from '@/AppV3';
import { EnsembleKalmanFilter } from '@/lib/ensembleKalmanFilter';

interface Props {
  players: UltraPlayerValuation[];
  kalmanFilter: EnsembleKalmanFilter;
}

const MarketTracker: React.FC<Props> = ({ players, kalmanFilter }) => {
  const trackedPlayers = useMemo(() => {
    return players
      .filter(p => p.kalmanPrice !== undefined)
      .map(p => {
        const stats = kalmanFilter.getEnsembleStatistics(p.id);
        const priceDiff = p.kalmanPrice! - p.marketPrice;
        const priceDiffPct = (priceDiff / p.marketPrice) * 100;
        
        return {
          ...p,
          priceDiff,
          priceDiffPct,
          convergence: stats?.convergenceRate || 0,
          volatility: stats ? stats.std / stats.mean : 0
        };
      })
      .sort((a, b) => Math.abs(b.priceDiff) - Math.abs(a.priceDiff))
      .slice(0, 15);
  }, [players, kalmanFilter]);

  const getTrendIcon = (trend?: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up': return '↗️';
      case 'down': return '↘️';
      case 'stable': return '→';
      default: return '•';
    }
  };

  const getTrendColor = (trend?: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up': return 'text-green-400';
      case 'down': return 'text-red-400';
      case 'stable': return 'text-yellow-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <h2 className="text-xl font-bold text-blue-400 mb-4">
        Real-Time Market Tracking (Kalman Filter)
      </h2>

      {/* Market Summary */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-gray-700 rounded p-3">
          <div className="text-xs text-gray-400">Rising</div>
          <div className="text-2xl font-bold text-green-400">
            {trackedPlayers.filter(p => p.kalmanTrend === 'up').length}
          </div>
        </div>
        <div className="bg-gray-700 rounded p-3">
          <div className="text-xs text-gray-400">Stable</div>
          <div className="text-2xl font-bold text-yellow-400">
            {trackedPlayers.filter(p => p.kalmanTrend === 'stable').length}
          </div>
        </div>
        <div className="bg-gray-700 rounded p-3">
          <div className="text-xs text-gray-400">Falling</div>
          <div className="text-2xl font-bold text-red-400">
            {trackedPlayers.filter(p => p.kalmanTrend === 'down').length}
          </div>
        </div>
      </div>

      {/* Tracked Players */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 border-b border-gray-700">
              <th className="text-left py-2">Player</th>
              <th className="text-center">Trend</th>
              <th className="text-right">Market</th>
              <th className="text-right">Kalman</th>
              <th className="text-right">Diff</th>
              <th className="text-right">Conv</th>
            </tr>
          </thead>
          <tbody>
            {trackedPlayers.map((player) => (
              <tr key={player.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                <td className="py-2">
                  <div className="text-white font-medium">{player.name}</div>
                  <div className="text-xs text-gray-400">
                    {player.position} - {player.team}
                  </div>
                </td>
                <td className="text-center">
                  <span className={`text-lg ${getTrendColor(player.kalmanTrend)}`}>
                    {getTrendIcon(player.kalmanTrend)}
                  </span>
                </td>
                <td className="text-right text-gray-300">
                  ${player.marketPrice.toFixed(0)}
                </td>
                <td className="text-right text-white font-medium">
                  ${player.kalmanPrice?.toFixed(0)}
                </td>
                <td className={`text-right font-medium ${
                  player.priceDiff > 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {player.priceDiff > 0 ? '+' : ''}{player.priceDiffPct.toFixed(1)}%
                </td>
                <td className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <div className="w-12 bg-gray-600 rounded-full h-1.5">
                      <div 
                        className="bg-blue-400 h-1.5 rounded-full"
                        style={{ width: `${player.convergence * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-400">
                      {(player.convergence * 100).toFixed(0)}%
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Market Insights */}
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="bg-gray-700 rounded p-3">
          <h4 className="text-sm font-semibold text-gray-300 mb-2">
            Biggest Risers
          </h4>
          <div className="space-y-1">
            {trackedPlayers
              .filter(p => p.priceDiff > 0)
              .slice(0, 3)
              .map(p => (
                <div key={p.id} className="flex justify-between text-xs">
                  <span className="text-gray-400">{p.name}</span>
                  <span className="text-green-400">+${p.priceDiff.toFixed(0)}</span>
                </div>
              ))}
          </div>
        </div>
        <div className="bg-gray-700 rounded p-3">
          <h4 className="text-sm font-semibold text-gray-300 mb-2">
            Biggest Fallers
          </h4>
          <div className="space-y-1">
            {trackedPlayers
              .filter(p => p.priceDiff < 0)
              .slice(0, 3)
              .map(p => (
                <div key={p.id} className="flex justify-between text-xs">
                  <span className="text-gray-400">{p.name}</span>
                  <span className="text-red-400">${p.priceDiff.toFixed(0)}</span>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Volatility Alert */}
      <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-700 rounded">
        <div className="text-sm text-yellow-400">
          ⚠️ High Volatility Players:
        </div>
        <div className="text-xs text-gray-300 mt-1">
          {trackedPlayers
            .filter(p => p.volatility > 0.3)
            .slice(0, 3)
            .map(p => p.name)
            .join(', ') || 'None detected'}
        </div>
      </div>
    </div>
  );
};

export default MarketTracker;