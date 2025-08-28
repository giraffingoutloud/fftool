import React, { useMemo } from 'react';
import { UltraPlayerValuation } from '@/AppV3';
import type { Team, Position } from '@/types';

interface Props {
  players: UltraPlayerValuation[];
  teams: Team[];
}

const PortfolioAnalysis: React.FC<Props> = ({ players, teams }) => {
  const portfolioStats = useMemo(() => {
    const withWeights = players.filter(p => p.portfolioWeight && p.portfolioWeight > 0.01);
    const totalWeight = withWeights.reduce((sum, p) => sum + (p.portfolioWeight || 0), 0);
    
    // Position breakdown
    const positionWeights = new Map<Position, number>();
    const positions: Position[] = ['QB', 'RB', 'WR', 'TE'];
    positions.forEach(pos => {
      const weight = withWeights
        .filter(p => p.position === pos)
        .reduce((sum, p) => sum + (p.portfolioWeight || 0), 0);
      positionWeights.set(pos, weight);
    });
    
    // Top holdings
    const topHoldings = withWeights
      .sort((a, b) => (b.portfolioWeight || 0) - (a.portfolioWeight || 0))
      .slice(0, 10);
    
    // Risk metrics
    const avgSharpe = withWeights.reduce((sum, p) => sum + (p.sharpeRatio || 0), 0) / withWeights.length;
    const avgBeer = withWeights.reduce((sum, p) => sum + (p.beer || 0), 0) / withWeights.length;
    
    return {
      totalWeight,
      positionWeights,
      topHoldings,
      avgSharpe,
      avgBeer,
      count: withWeights.length
    };
  }, [players]);

  const getPositionColor = (position: Position) => {
    const colors = {
      QB: 'bg-red-500',
      RB: 'bg-green-500',
      WR: 'bg-blue-500',
      TE: 'bg-yellow-500'
    };
    return colors[position] || 'bg-gray-500';
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <h2 className="text-xl font-bold text-blue-400 mb-4">
        Portfolio Optimization Analysis
      </h2>

      {/* Portfolio Metrics */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-700 rounded p-3">
          <div className="text-xs text-gray-400">Holdings</div>
          <div className="text-2xl font-bold text-white">{portfolioStats.count}</div>
        </div>
        <div className="bg-gray-700 rounded p-3">
          <div className="text-xs text-gray-400">Avg Sharpe</div>
          <div className="text-2xl font-bold text-green-400">
            {portfolioStats.avgSharpe.toFixed(2)}
          </div>
        </div>
        <div className="bg-gray-700 rounded p-3">
          <div className="text-xs text-gray-400">Avg BEER</div>
          <div className="text-2xl font-bold text-blue-400">
            ${portfolioStats.avgBeer.toFixed(1)}
          </div>
        </div>
      </div>

      {/* Position Allocation */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-300 mb-3">Position Allocation</h3>
        <div className="space-y-2">
          {Array.from(portfolioStats.positionWeights.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([position, weight]) => {
              const percentage = portfolioStats.totalWeight > 0 ? 
                (weight / portfolioStats.totalWeight * 100) : 0;
              
              return (
                <div key={position} className="flex items-center gap-3">
                  <div className="w-12 text-sm font-semibold text-gray-300">
                    {position}
                  </div>
                  <div className="flex-1 bg-gray-700 rounded-full h-6 relative overflow-hidden">
                    <div
                      className={`h-full ${getPositionColor(position)} bg-opacity-70`}
                      style={{ width: `${percentage}%` }}
                    />
                    <div className="absolute inset-0 flex items-center px-2">
                      <span className="text-xs text-white font-medium">
                        {percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Top Holdings */}
      <div>
        <h3 className="text-lg font-semibold text-gray-300 mb-3">Top Portfolio Holdings</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left py-2">Player</th>
                <th className="text-center">Pos</th>
                <th className="text-right">Weight</th>
                <th className="text-right">BEER</th>
                <th className="text-right">Sharpe</th>
                <th className="text-right">Price</th>
              </tr>
            </thead>
            <tbody>
              {portfolioStats.topHoldings.map((player) => (
                <tr key={player.id} className="border-b border-gray-700/50">
                  <td className="py-2 text-white">{player.name}</td>
                  <td className="text-center">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      player.position === 'QB' ? 'bg-red-900 text-red-300' :
                      player.position === 'RB' ? 'bg-green-900 text-green-300' :
                      player.position === 'WR' ? 'bg-blue-900 text-blue-300' :
                      'bg-yellow-900 text-yellow-300'
                    }`}>
                      {player.position}
                    </span>
                  </td>
                  <td className="text-right text-white">
                    {((player.portfolioWeight || 0) * 100).toFixed(1)}%
                  </td>
                  <td className={`text-right ${
                    (player.beer || 0) > 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    ${player.beer?.toFixed(1) || '0.0'}
                  </td>
                  <td className={`text-right ${
                    (player.sharpeRatio || 0) > 1 ? 'text-green-400' : 'text-yellow-400'
                  }`}>
                    {player.sharpeRatio?.toFixed(2) || '0.00'}
                  </td>
                  <td className="text-right text-gray-300">
                    ${player.marketPrice.toFixed(0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Diversification Score */}
      <div className="mt-4 p-4 bg-gray-900 rounded">
        <div className="flex justify-between items-center">
          <span className="text-gray-300">Portfolio Efficiency Score:</span>
          <div className="flex items-center gap-2">
            <div className="w-32 bg-gray-700 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 h-2 rounded-full"
                style={{ width: `${Math.min(100, portfolioStats.avgSharpe * 50)}%` }}
              />
            </div>
            <span className="text-lg font-bold text-white">
              {(portfolioStats.avgSharpe * 50).toFixed(0)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PortfolioAnalysis;