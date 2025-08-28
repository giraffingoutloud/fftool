import React from 'react';
import { UltraPlayerValuation } from '@/AppV3';

interface Props {
  player: UltraPlayerValuation;
}

const AdvancedMetricsPanel: React.FC<Props> = ({ player }) => {
  const formatNumber = (num: number | undefined, decimals = 2) => {
    if (num === undefined) return 'N/A';
    return num.toFixed(decimals);
  };

  const formatPercent = (num: number | undefined) => {
    if (num === undefined) return 'N/A';
    return `${(num * 100).toFixed(1)}%`;
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <h3 className="text-lg font-bold text-blue-400 mb-3">
        Advanced Metrics: {player.name}
      </h3>

      {/* BEER+ Metrics */}
      {player.beer !== undefined && (
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-gray-400 mb-2">BEER+ Analysis</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">BEER:</span>
              <span className={player.beer > 0 ? 'text-green-400' : 'text-red-400'}>
                ${formatNumber(player.beer)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">VOLS:</span>
              <span className="text-white">{formatNumber(player.vols)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Sharpe:</span>
              <span className={player.sharpeRatio! > 1 ? 'text-green-400' : 'text-yellow-400'}>
                {formatNumber(player.sharpeRatio)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Monte Carlo Stats */}
      {player.monteCarloStats && (
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-gray-400 mb-2">Monte Carlo Projection</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Mean:</span>
              <span className="text-white">{formatNumber(player.monteCarloStats.mean)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Median:</span>
              <span className="text-white">{formatNumber(player.monteCarloStats.median)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">95th %ile:</span>
              <span className="text-green-400">
                {formatNumber(player.monteCarloStats.percentiles.p95)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">5th %ile:</span>
              <span className="text-red-400">
                {formatNumber(player.monteCarloStats.percentiles.p5)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Market Tracking */}
      {player.kalmanPrice !== undefined && (
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-gray-400 mb-2">Market Tracking</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Kalman Price:</span>
              <span className="text-white">${formatNumber(player.kalmanPrice)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Trend:</span>
              <span className={
                player.kalmanTrend === 'up' ? 'text-green-400' : 
                player.kalmanTrend === 'down' ? 'text-red-400' : 
                'text-yellow-400'
              }>
                {player.kalmanTrend?.toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Bayesian Prediction */}
      {player.bayesianPrediction && (
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-gray-400 mb-2">Bayesian Projection</h4>
          <div className="grid grid-cols-1 gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Expected Points:</span>
              <span className="text-white">
                {formatNumber(player.bayesianPrediction.mean)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">95% CI:</span>
              <span className="text-gray-400">
                [{formatNumber(player.bayesianPrediction.credibleInterval.lower)} - 
                 {formatNumber(player.bayesianPrediction.credibleInterval.upper)}]
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Portfolio & Allocation */}
      <div className="mb-4">
        <h4 className="text-sm font-semibold text-gray-400 mb-2">Portfolio Analysis</h4>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Weight:</span>
            <span className="text-white">
              {formatPercent(player.portfolioWeight)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Priority:</span>
            <span className="text-white">
              {player.allocationPriority || 'N/A'}
            </span>
          </div>
        </div>
      </div>

      {/* Advanced Stats */}
      {(player.targetShare || player.catchRate || player.yardsAfterCatch) && (
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-gray-400 mb-2">Usage Metrics</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {player.targetShare && (
              <div className="flex justify-between">
                <span className="text-gray-500">Target Share:</span>
                <span className="text-white">{formatPercent(player.targetShare)}</span>
              </div>
            )}
            {player.catchRate && (
              <div className="flex justify-between">
                <span className="text-gray-500">Catch Rate:</span>
                <span className="text-white">{formatPercent(player.catchRate)}</span>
              </div>
            )}
            {player.yardsAfterCatch && (
              <div className="flex justify-between">
                <span className="text-gray-500">YAC:</span>
                <span className="text-white">{formatNumber(player.yardsAfterCatch, 1)}</span>
              </div>
            )}
            {player.touchesPerGame && (
              <div className="flex justify-between">
                <span className="text-gray-500">Touches/G:</span>
                <span className="text-white">{formatNumber(player.touchesPerGame, 1)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confidence Score */}
      <div className="mt-4 pt-3 border-t border-gray-700">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-500">Overall Confidence:</span>
          <div className="flex items-center gap-2">
            <div className="w-24 bg-gray-700 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 h-2 rounded-full"
                style={{ width: `${(player.confidence || 0.5) * 100}%` }}
              />
            </div>
            <span className="text-sm text-white">
              {formatPercent(player.confidence)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdvancedMetricsPanel;