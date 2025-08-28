import React, { useMemo } from 'react';
import { DynamicAuctionAllocator } from '@/lib/dynamicAuctionAllocator';
import { UltraPlayerValuation } from '@/AppV3';
import type { Team, Position } from '@/types';

interface Props {
  allocator: DynamicAuctionAllocator;
  strategy: 'balanced' | 'stars_and_scrubs' | 'zero_rb' | 'hero_rb' | 'robust_rb';
  onStrategyChange: (strategy: any) => void;
  team: Team;
  players: UltraPlayerValuation[];
}

const AuctionStrategyPanel: React.FC<Props> = ({ 
  allocator, 
  strategy, 
  onStrategyChange,
  team,
  players 
}) => {
  const marketConditions = useMemo(() => {
    const conditions = new Map<Position, number>();
    const positions: Position[] = ['QB', 'RB', 'WR', 'TE'];
    
    positions.forEach(pos => {
      const posPlayers = players.filter(p => p.position === pos);
      if (posPlayers.length > 0) {
        const avgMarket = posPlayers.reduce((sum, p) => sum + p.marketPrice, 0) / posPlayers.length;
        const avgValue = posPlayers.reduce((sum, p) => sum + p.intrinsicValue, 0) / posPlayers.length;
        conditions.set(pos, avgMarket / Math.max(1, avgValue));
      }
    });
    
    return conditions;
  }, [players]);

  const allocation = useMemo(() => {
    return allocator.allocateBudget(strategy, marketConditions, team);
  }, [allocator, strategy, marketConditions, team]);

  const recommendedStrategy = useMemo(() => {
    const marketPrices = new Map(players.map(p => [p.id, p.marketPrice]));
    return allocator.recommendStrategy(players, marketPrices);
  }, [allocator, players]);

  const strategyDescriptions = {
    balanced: 'Spread budget evenly across all positions',
    stars_and_scrubs: 'Target 2-3 elite players, fill with $1 players',
    zero_rb: 'Focus on elite WR/TE, punt RB position',
    hero_rb: 'One elite RB, load up on WRs',
    robust_rb: 'Heavy RB investment early'
  };

  const getPositionColor = (position: Position) => {
    const colors = {
      QB: 'text-red-400',
      RB: 'text-green-400',
      WR: 'text-blue-400',
      TE: 'text-yellow-400'
    };
    return colors[position] || 'text-gray-400';
  };

  const getMarketConditionLabel = (value: number) => {
    if (value < 0.9) return { label: 'Undervalued', color: 'text-green-400' };
    if (value > 1.1) return { label: 'Overvalued', color: 'text-red-400' };
    return { label: 'Fair Value', color: 'text-yellow-400' };
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <h2 className="text-xl font-bold text-blue-400 mb-4">
        Auction Strategy Manager
      </h2>

      {/* Strategy Selection */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-300 mb-3">Select Strategy</h3>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.entries(strategyDescriptions).map(([key, desc]) => (
            <button
              key={key}
              onClick={() => onStrategyChange(key)}
              className={`p-3 rounded border text-left transition-colors ${
                strategy === key
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
              }`}
            >
              <div className="font-semibold capitalize">
                {key.replace('_', ' ')}
              </div>
              <div className="text-xs mt-1 opacity-80">{desc}</div>
              {recommendedStrategy === key && (
                <div className="text-xs mt-2 text-green-400">
                  ⭐ Recommended
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Market Conditions */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-300 mb-3">Market Conditions</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from(marketConditions.entries()).map(([position, value]) => {
            const condition = getMarketConditionLabel(value);
            return (
              <div key={position} className="bg-gray-700 rounded p-3">
                <div className={`font-semibold ${getPositionColor(position)}`}>
                  {position}
                </div>
                <div className={`text-sm mt-1 ${condition.color}`}>
                  {condition.label}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {(value * 100).toFixed(0)}% of value
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Budget Allocation */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-300 mb-3">
          Budget Allocation - {strategy.replace('_', ' ').toUpperCase()}
        </h3>
        <div className="space-y-3">
          {allocation.allocations
            .sort((a, b) => b.targetSpend - a.targetSpend)
            .map((alloc) => {
              const spent = team.roster
                .filter(p => p.player.position === alloc.position)
                .reduce((sum, p) => sum + p.price, 0);
              const remaining = alloc.targetSpend - spent;
              const percentSpent = alloc.targetSpend > 0 ? spent / alloc.targetSpend : 0;
              
              return (
                <div key={alloc.position} className="bg-gray-700 rounded p-3">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`font-semibold ${getPositionColor(alloc.position)}`}>
                        {alloc.position}
                      </span>
                      <span className="text-xs text-gray-400">
                        Priority: {alloc.priority}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-white">${alloc.targetSpend}</div>
                      <div className="text-xs text-gray-400">
                        {alloc.targetCount} players
                      </div>
                    </div>
                  </div>
                  
                  {/* Progress bar */}
                  <div className="w-full bg-gray-600 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        percentSpent > 1.2 ? 'bg-red-500' :
                        percentSpent > 1 ? 'bg-yellow-500' :
                        'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(100, percentSpent * 100)}%` }}
                    />
                  </div>
                  
                  <div className="flex justify-between mt-2 text-xs">
                    <span className="text-gray-400">
                      Spent: ${spent}
                    </span>
                    <span className={remaining < 0 ? 'text-red-400' : 'text-green-400'}>
                      {remaining >= 0 ? 'Remaining' : 'Over'}: ${Math.abs(remaining)}
                    </span>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Strategy Adjustments */}
      <div className="bg-gray-700 rounded p-4">
        <h3 className="text-sm font-semibold text-gray-300 mb-2">
          Dynamic Adjustments
        </h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-400">Market Adjustment:</span>
            <span className={`ml-2 ${
              allocation.marketAdjustment > 1.05 ? 'text-red-400' :
              allocation.marketAdjustment < 0.95 ? 'text-green-400' :
              'text-yellow-400'
            }`}>
              {((allocation.marketAdjustment - 1) * 100).toFixed(1)}%
            </span>
          </div>
          <div>
            <span className="text-gray-400">FLEX Adjustment:</span>
            <span className={`ml-2 ${
              allocation.flexAdjustment > 1.05 ? 'text-green-400' :
              allocation.flexAdjustment < 0.95 ? 'text-red-400' :
              'text-yellow-400'
            }`}>
              {((allocation.flexAdjustment - 1) * 100).toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* Remaining Budget */}
      <div className="mt-4 p-4 bg-gray-900 rounded">
        <div className="flex justify-between items-center">
          <span className="text-gray-300">Total Budget Remaining:</span>
          <span className="text-2xl font-bold text-green-400">
            ${allocation.totalBudget}
          </span>
        </div>
        <div className="text-xs text-gray-400 mt-1">
          Min per slot: ${Math.max(1, 16 - team.roster.length)}
        </div>
      </div>
    </div>
  );
};

export default AuctionStrategyPanel;