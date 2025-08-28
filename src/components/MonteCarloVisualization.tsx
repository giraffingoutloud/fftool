import React, { useMemo } from 'react';
import { UltraPlayerValuation } from '@/AppV3';

interface Props {
  players: UltraPlayerValuation[];
}

const MonteCarloVisualization: React.FC<Props> = ({ players }) => {
  const topPlayers = useMemo(() => {
    return players
      .filter(p => p.monteCarloStats)
      .sort((a, b) => (b.monteCarloStats?.mean || 0) - (a.monteCarloStats?.mean || 0))
      .slice(0, 10);
  }, [players]);

  const getBarWidth = (value: number, max: number) => {
    return `${(value / max) * 100}%`;
  };

  const maxPoints = Math.max(...topPlayers.map(p => p.monteCarloStats?.percentiles.p95 || 0));

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <h2 className="text-xl font-bold text-blue-400 mb-4">
        Monte Carlo Projections - Top 10 Players
      </h2>

      <div className="space-y-4">
        {topPlayers.map((player) => {
          const stats = player.monteCarloStats!;
          return (
            <div key={player.id} className="border-b border-gray-700 pb-3">
              <div className="flex justify-between items-center mb-2">
                <div>
                  <span className="font-medium text-white">{player.name}</span>
                  <span className="ml-2 text-sm text-gray-400">
                    {player.position} - {player.team}
                  </span>
                </div>
                <span className="text-sm text-gray-400">
                  Mean: {stats.mean.toFixed(1)} pts
                </span>
              </div>

              {/* Visualization of distribution */}
              <div className="relative h-6 bg-gray-900 rounded overflow-hidden">
                {/* 5th to 95th percentile range */}
                <div 
                  className="absolute h-full bg-blue-900/30"
                  style={{
                    left: getBarWidth(stats.percentiles.p5, maxPoints),
                    width: getBarWidth(stats.percentiles.p95 - stats.percentiles.p5, maxPoints)
                  }}
                />
                
                {/* 25th to 75th percentile range */}
                <div 
                  className="absolute h-full bg-blue-600/50"
                  style={{
                    left: getBarWidth(stats.percentiles.p25, maxPoints),
                    width: getBarWidth(stats.percentiles.p75 - stats.percentiles.p25, maxPoints)
                  }}
                />
                
                {/* Median line */}
                <div 
                  className="absolute h-full w-1 bg-yellow-400"
                  style={{ left: getBarWidth(stats.median, maxPoints) }}
                />
                
                {/* Mean line */}
                <div 
                  className="absolute h-full w-1 bg-green-400"
                  style={{ left: getBarWidth(stats.mean, maxPoints) }}
                />
              </div>

              <div className="flex justify-between mt-2 text-xs text-gray-500">
                <span>P5: {stats.percentiles.p5.toFixed(0)}</span>
                <span>P25: {stats.percentiles.p25.toFixed(0)}</span>
                <span className="text-yellow-400">Med: {stats.median.toFixed(0)}</span>
                <span>P75: {stats.percentiles.p75.toFixed(0)}</span>
                <span>P95: {stats.percentiles.p95.toFixed(0)}</span>
              </div>

              {/* Risk indicators */}
              <div className="flex gap-4 mt-2 text-xs">
                <span className="text-gray-400">
                  Skew: <span className={stats.skewness > 0 ? 'text-green-400' : 'text-red-400'}>
                    {stats.skewness.toFixed(2)}
                  </span>
                </span>
                <span className="text-gray-400">
                  Kurt: <span className={Math.abs(stats.kurtosis) < 1 ? 'text-green-400' : 'text-yellow-400'}>
                    {stats.kurtosis.toFixed(2)}
                  </span>
                </span>
                <span className="text-gray-400">
                  Risk: <span className={
                    (stats.percentiles.p75 - stats.percentiles.p25) / stats.median < 0.3 ? 
                    'text-green-400' : 'text-yellow-400'
                  }>
                    {((stats.percentiles.p75 - stats.percentiles.p25) / stats.median * 100).toFixed(0)}%
                  </span>
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-700">
        <div className="flex items-center gap-4 text-xs text-gray-400">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-900/30" />
            <span>90% Range</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-600/50" />
            <span>50% Range</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-1 bg-yellow-400" />
            <span>Median</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-1 bg-green-400" />
            <span>Mean</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MonteCarloVisualization;