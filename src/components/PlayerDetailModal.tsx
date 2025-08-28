import React from 'react';
import { X, TrendingUp, Target, Zap, Shield, AlertCircle } from 'lucide-react';
import { EnhancedPlayerValuation } from '@/AppV2';
import type { ComprehensiveData } from '@/types';

interface PlayerDetailModalProps {
  player: EnhancedPlayerValuation;
  onClose: () => void;
  comprehensiveData: ComprehensiveData | null;
}

const PlayerDetailModal: React.FC<PlayerDetailModalProps> = ({
  player,
  onClose,
  comprehensiveData
}) => {
  const getConfidenceColor = (confidence?: number) => {
    if (!confidence) return 'text-gray-400';
    if (confidence > 0.8) return 'text-green-400';
    if (confidence > 0.6) return 'text-yellow-400';
    return 'text-orange-400';
  };

  const getRecommendationColor = (rec?: string) => {
    switch (rec) {
      case 'STRONG_BUY': return 'text-green-500 bg-green-500/20';
      case 'BUY': return 'text-green-400 bg-green-400/20';
      case 'FAIR': return 'text-yellow-400 bg-yellow-400/20';
      case 'PASS': return 'text-orange-400 bg-orange-400/20';
      case 'AVOID': return 'text-red-400 bg-red-400/20';
      default: return 'text-gray-400 bg-gray-400/20';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
      <div 
        className="bg-gray-900 rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-3">
              {player.name}
              <span className="text-sm px-2 py-1 bg-gray-800 rounded">
                {player.position}
              </span>
              <span className="text-sm px-2 py-1 bg-gray-800 rounded">
                {player.team}
              </span>
              {player.depthRole && (
                <span className={`text-sm px-2 py-1 rounded ${
                  player.depthRole === 'starter' ? 'bg-green-500/20 text-green-400' :
                  player.depthRole === 'backup' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-gray-500/20 text-gray-400'
                }`}>
                  {player.depthRole}
                </span>
              )}
            </h2>
            <div className="flex items-center gap-4 mt-2">
              <span className={`px-3 py-1 rounded text-sm font-medium ${getRecommendationColor(player.recommendation)}`}>
                {player.recommendation}
              </span>
              <span className={`text-sm ${getConfidenceColor(player.projectionConfidence)}`}>
                Confidence: {((player.projectionConfidence || 0) * 100).toFixed(0)}%
              </span>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Valuation Metrics */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              Valuation Metrics
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Projected Points</span>
                <span className="text-white font-medium">{player.projectedPoints.toFixed(1)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Intrinsic Value</span>
                <span className="text-primary font-medium">${player.intrinsicValue}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Market Price</span>
                <span className="text-yellow-400">${player.marketPrice}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Edge</span>
                <span className={player.edge > 0 ? 'text-green-400' : 'text-red-400'}>
                  ${player.edge > 0 ? '+' : ''}{player.edge.toFixed(1)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Bid Range</span>
                <span className="text-white">${player.minBid} - ${player.maxBid}</span>
              </div>
              {player.floorPoints && player.ceilingPoints && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Floor/Ceiling</span>
                  <span className="text-white">
                    {player.floorPoints.toFixed(0)} - {player.ceilingPoints.toFixed(0)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Advanced Metrics */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              Advanced Metrics
            </h3>
            <div className="space-y-2 text-sm">
              {player.targetShare !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Target Share</span>
                  <span className="text-white">{(player.targetShare * 100).toFixed(1)}%</span>
                </div>
              )}
              {player.catchRate !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Catch Rate</span>
                  <span className="text-white">{(player.catchRate * 100).toFixed(1)}%</span>
                </div>
              )}
              {player.yardsAfterCatch !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-400">YAC</span>
                  <span className="text-white">{player.yardsAfterCatch.toFixed(1)}</span>
                </div>
              )}
              {player.touchesPerGame !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Touches/Game</span>
                  <span className="text-white">{player.touchesPerGame.toFixed(1)}</span>
                </div>
              )}
              {player.ecr !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-400">ECR</span>
                  <span className="text-white">#{player.ecr}</span>
                </div>
              )}
              {player.depthOrder !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Depth Chart</span>
                  <span className="text-white">#{player.depthOrder}</span>
                </div>
              )}
            </div>
          </div>

          {/* Team Context */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              Team Context
            </h3>
            <div className="space-y-2 text-sm">
              {player.teamOffenseRank !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Offense Rank</span>
                  <span className={`font-medium ${
                    player.teamOffenseRank <= 10 ? 'text-green-400' :
                    player.teamOffenseRank <= 20 ? 'text-yellow-400' :
                    'text-red-400'
                  }`}>
                    #{player.teamOffenseRank}
                  </span>
                </div>
              )}
              {player.teamPaceRank !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Pace Rank</span>
                  <span className={`font-medium ${
                    player.teamPaceRank <= 10 ? 'text-green-400' :
                    player.teamPaceRank <= 20 ? 'text-yellow-400' :
                    'text-red-400'
                  }`}>
                    #{player.teamPaceRank}
                  </span>
                </div>
              )}
              {player.teamRedZoneRank !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Red Zone Rank</span>
                  <span className={`font-medium ${
                    player.teamRedZoneRank <= 10 ? 'text-green-400' :
                    player.teamRedZoneRank <= 20 ? 'text-yellow-400' :
                    'text-red-400'
                  }`}>
                    #{player.teamRedZoneRank}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Adjustment Factors */}
        {player.metricsAdjustment && (
          <div className="mt-6 bg-gray-800 rounded-lg p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Metrics Adjustment Breakdown
            </h3>
            <div className="grid grid-cols-4 gap-4 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {player.metricsAdjustment.opportunityScore.toFixed(2)}
                </div>
                <div className="text-xs text-gray-400">Opportunity (35%)</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-400">
                  {player.metricsAdjustment.efficiencyScore.toFixed(2)}
                </div>
                <div className="text-xs text-gray-400">Efficiency (25%)</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-400">
                  {player.metricsAdjustment.situationScore.toFixed(2)}
                </div>
                <div className="text-xs text-gray-400">Situation (20%)</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-400">
                  {player.metricsAdjustment.consistencyScore.toFixed(2)}
                </div>
                <div className="text-xs text-gray-400">Consistency (10%)</div>
              </div>
            </div>
            <div className="text-center p-3 bg-gray-900 rounded">
              <div className="text-3xl font-bold text-white">
                {player.metricsAdjustment.totalAdjustment.toFixed(2)}x
              </div>
              <div className="text-sm text-gray-400">Total Adjustment</div>
            </div>
          </div>
        )}

        {/* Key Factors */}
        {player.adjustmentFactors && player.adjustmentFactors.length > 0 && (
          <div className="mt-6 bg-gray-800 rounded-lg p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-primary" />
              Key Factors
            </h3>
            <div className="flex flex-wrap gap-2">
              {player.adjustmentFactors.map((factor, idx) => (
                <span key={idx} className="px-2 py-1 bg-gray-700 rounded text-sm">
                  {factor}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlayerDetailModal;