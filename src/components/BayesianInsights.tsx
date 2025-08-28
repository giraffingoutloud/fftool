import React, { useMemo } from 'react';
import { UltraPlayerValuation } from '@/AppV3';
import { BayesianHierarchicalModel } from '@/lib/bayesianHierarchicalModel';

interface Props {
  players: UltraPlayerValuation[];
  bayesianModel: BayesianHierarchicalModel;
}

const BayesianInsights: React.FC<Props> = ({ players, bayesianModel }) => {
  const insights = useMemo(() => {
    const withPredictions = players
      .filter(p => p.bayesianPrediction)
      .map(p => {
        const pred = p.bayesianPrediction!;
        const ciWidth = pred.credibleInterval.upper - pred.credibleInterval.lower;
        const uncertainty = ciWidth / pred.mean;
        const uplift = ((pred.mean - p.points) / p.points) * 100;
        
        return {
          ...p,
          bayesianMean: pred.mean,
          ciLower: pred.credibleInterval.lower,
          ciUpper: pred.credibleInterval.upper,
          uncertainty,
          uplift,
          ciWidth
        };
      });
    
    // Group by position
    const byPosition = new Map();
    ['QB', 'RB', 'WR', 'TE'].forEach(pos => {
      const posPlayers = withPredictions.filter(p => p.position === pos);
      if (posPlayers.length > 0) {
        const avgUplift = posPlayers.reduce((sum, p) => sum + p.uplift, 0) / posPlayers.length;
        const avgUncertainty = posPlayers.reduce((sum, p) => sum + p.uncertainty, 0) / posPlayers.length;
        byPosition.set(pos, { avgUplift, avgUncertainty, count: posPlayers.length });
      }
    });
    
    // Find outliers
    const highUpside = withPredictions
      .filter(p => p.uplift > 20)
      .sort((a, b) => b.uplift - a.uplift)
      .slice(0, 5);
    
    const highCertainty = withPredictions
      .filter(p => p.uncertainty < 0.2)
      .sort((a, b) => a.uncertainty - b.uncertainty)
      .slice(0, 5);
    
    const risky = withPredictions
      .filter(p => p.uncertainty > 0.5)
      .sort((a, b) => b.uncertainty - a.uncertainty)
      .slice(0, 5);
    
    return {
      withPredictions: withPredictions.slice(0, 10),
      byPosition,
      highUpside,
      highCertainty,
      risky
    };
  }, [players, bayesianModel]);

  const getUpliftColor = (uplift: number) => {
    if (uplift > 10) return 'text-green-400';
    if (uplift > 0) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getUncertaintyColor = (uncertainty: number) => {
    if (uncertainty < 0.2) return 'text-green-400';
    if (uncertainty < 0.4) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <h2 className="text-xl font-bold text-blue-400 mb-4">
        Bayesian Hierarchical Projections
      </h2>

      {/* Position Summary */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-300 mb-3">Position Analysis</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from(insights.byPosition.entries()).map(([position, stats]) => (
            <div key={position} className="bg-gray-700 rounded p-3">
              <div className="text-sm font-semibold text-gray-300">{position}</div>
              <div className="mt-2 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-400">Avg Uplift:</span>
                  <span className={getUpliftColor(stats.avgUplift)}>
                    {stats.avgUplift > 0 ? '+' : ''}{stats.avgUplift.toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Uncertainty:</span>
                  <span className={getUncertaintyColor(stats.avgUncertainty)}>
                    {(stats.avgUncertainty * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Sample:</span>
                  <span className="text-gray-300">{stats.count}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Key Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* High Upside */}
        <div className="bg-gray-700 rounded p-4">
          <h4 className="text-sm font-semibold text-green-400 mb-3">
            🚀 Highest Upside
          </h4>
          <div className="space-y-2">
            {insights.highUpside.map(p => (
              <div key={p.id} className="text-xs">
                <div className="flex justify-between">
                  <span className="text-white truncate">{p.name}</span>
                  <span className="text-green-400 font-medium">
                    +{p.uplift.toFixed(0)}%
                  </span>
                </div>
                <div className="text-gray-400">
                  {p.position} • {p.bayesianMean.toFixed(0)} pts
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Most Certain */}
        <div className="bg-gray-700 rounded p-4">
          <h4 className="text-sm font-semibold text-blue-400 mb-3">
            🎯 Most Certain
          </h4>
          <div className="space-y-2">
            {insights.highCertainty.map(p => (
              <div key={p.id} className="text-xs">
                <div className="flex justify-between">
                  <span className="text-white truncate">{p.name}</span>
                  <span className="text-blue-400 font-medium">
                    ±{(p.uncertainty * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="text-gray-400">
                  {p.position} • {p.bayesianMean.toFixed(0)} pts
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* High Risk */}
        <div className="bg-gray-700 rounded p-4">
          <h4 className="text-sm font-semibold text-red-400 mb-3">
            ⚠️ High Risk
          </h4>
          <div className="space-y-2">
            {insights.risky.map(p => (
              <div key={p.id} className="text-xs">
                <div className="flex justify-between">
                  <span className="text-white truncate">{p.name}</span>
                  <span className="text-red-400 font-medium">
                    ±{(p.uncertainty * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="text-gray-400">
                  {p.position} • CI: {p.ciWidth.toFixed(0)} pts
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Detailed Predictions */}
      <div>
        <h3 className="text-lg font-semibold text-gray-300 mb-3">Bayesian Predictions</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left py-2">Player</th>
                <th className="text-right">Base</th>
                <th className="text-right">Bayesian</th>
                <th className="text-right">95% CI</th>
                <th className="text-right">Uplift</th>
                <th className="text-right">Certainty</th>
              </tr>
            </thead>
            <tbody>
              {insights.withPredictions.map((player) => (
                <tr key={player.id} className="border-b border-gray-700/50">
                  <td className="py-2">
                    <div className="text-white">{player.name}</div>
                    <div className="text-xs text-gray-400">
                      {player.position} - {player.team}
                    </div>
                  </td>
                  <td className="text-right text-gray-300">
                    {player.points.toFixed(0)}
                  </td>
                  <td className="text-right text-white font-medium">
                    {player.bayesianMean.toFixed(0)}
                  </td>
                  <td className="text-right text-gray-400 text-xs">
                    [{player.ciLower.toFixed(0)} - {player.ciUpper.toFixed(0)}]
                  </td>
                  <td className={`text-right font-medium ${getUpliftColor(player.uplift)}`}>
                    {player.uplift > 0 ? '+' : ''}{player.uplift.toFixed(1)}%
                  </td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <div className="w-12 bg-gray-600 rounded-full h-1.5">
                        <div 
                          className={`h-1.5 rounded-full ${
                            player.uncertainty < 0.3 ? 'bg-green-400' :
                            player.uncertainty < 0.5 ? 'bg-yellow-400' :
                            'bg-red-400'
                          }`}
                          style={{ width: `${(1 - player.uncertainty) * 100}%` }}
                        />
                      </div>
                      <span className={`text-xs ${getUncertaintyColor(player.uncertainty)}`}>
                        {((1 - player.uncertainty) * 100).toFixed(0)}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Model Info */}
      <div className="mt-4 p-3 bg-gray-900 rounded text-xs text-gray-400">
        <div className="flex items-center gap-2">
          <span className="text-blue-400">ℹ️</span>
          <span>
            Bayesian hierarchical model with 5,000 Gibbs sampling iterations. 
            Position-level priors with player-specific posteriors. 
            95% credible intervals shown.
          </span>
        </div>
      </div>
    </div>
  );
};

export default BayesianInsights;