/**
 * Budget Allocator Component
 * Shows dynamic budget allocation recommendations based on draft progress
 */

import React, { useState, useMemo } from 'react';
import { DollarSign, TrendingUp, AlertTriangle, Target, Zap } from 'lucide-react';
import { DynamicAuctionAllocator } from '@/lib/dynamicAuctionAllocator';
import type { ValuationResult } from '@/lib/calibratedValuationService';

interface Props {
  remainingBudget: number;
  spotsLeft: number;
  myRoster: any[];
  valuations: ValuationResult[];
  draftHistory: any[];
}

type Strategy = 'stars_and_scrubs' | 'balanced' | 'zero_rb' | 'hero_rb' | 'robust_rb';

const STRATEGY_DESCRIPTIONS = {
  'stars_and_scrubs': 'Spend big on elite players, fill with $1 players',
  'balanced': 'Spread budget evenly across all positions',
  'zero_rb': 'Ignore RBs early, load up on WR/TE',
  'hero_rb': 'One elite RB, then WRs',
  'robust_rb': 'Prioritize RBs heavily'
};

const POSITION_NEEDS = {
  QB: 1,
  RB: 2,
  WR: 2,
  TE: 1,
  DST: 1,
  K: 1,
  FLEX: 1,
  BENCH: 7
};

const BudgetAllocator: React.FC<Props> = ({
  remainingBudget,
  spotsLeft,
  myRoster,
  valuations,
  draftHistory
}) => {
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy>('balanced');
  const [showDetails, setShowDetails] = useState(false);

  // Calculate market conditions from draft history
  const marketConditions = useMemo(() => {
    const conditions = new Map<string, number>();
    const positions = ['QB', 'RB', 'WR', 'TE', 'DST', 'K'];
    
    positions.forEach(pos => {
      const drafted = draftHistory.filter((p: any) => p.player?.position === pos);
      const values = valuations.filter(v => v.position === pos);
      
      if (drafted.length > 0 && values.length > 0) {
        const avgActual = drafted.reduce((sum: number, p: any) => sum + (p.price || 0), 0) / drafted.length;
        const avgPredicted = values.slice(0, drafted.length)
          .reduce((sum, v) => sum + v.auctionValue, 0) / Math.min(drafted.length, values.length);
        
        // Inflation factor: > 1.0 means position is going expensive
        conditions.set(pos, avgActual / Math.max(avgPredicted, 1));
      } else {
        conditions.set(pos, 1.0);
      }
    });
    
    return conditions;
  }, [draftHistory, valuations]);

  // Calculate position needs
  const positionNeeds = useMemo(() => {
    const needs: Record<string, number> = {};
    const filled: Record<string, number> = {};
    
    // Count current roster
    myRoster.forEach((player: any) => {
      const pos = player.position;
      filled[pos] = (filled[pos] || 0) + 1;
    });
    
    // Calculate needs
    Object.entries(POSITION_NEEDS).forEach(([pos, required]) => {
      if (pos === 'FLEX' || pos === 'BENCH') return;
      needs[pos] = Math.max(0, required - (filled[pos] || 0));
    });
    
    // Add flex/bench needs
    const startingSpots = Object.values(needs).reduce((sum, n) => sum + n, 0);
    const totalNeeded = 16 - myRoster.length;
    needs['FLEX/BENCH'] = totalNeeded - startingSpots;
    
    return needs;
  }, [myRoster]);

  // Calculate recommended allocation
  const allocation = useMemo(() => {
    if (spotsLeft === 0) return null;
    
    const avgPerSpot = remainingBudget / spotsLeft;
    const allocations: Record<string, number> = {};
    
    // Simple allocation based on strategy and needs
    if (selectedStrategy === 'stars_and_scrubs') {
      // Spend heavily on next 1-2 picks
      if (spotsLeft <= 2) {
        Object.keys(positionNeeds).forEach(pos => {
          if (positionNeeds[pos] > 0) {
            allocations[pos] = Math.floor(remainingBudget / spotsLeft);
          }
        });
      } else {
        // Save $1 per remaining spot after next 2
        const scrubBudget = Math.max(spotsLeft - 2, 0);
        const starBudget = remainingBudget - scrubBudget;
        
        let starsAllocated = 0;
        ['RB', 'WR'].forEach(pos => {
          if (positionNeeds[pos] > 0 && starsAllocated < 2) {
            allocations[pos] = Math.floor(starBudget / 2);
            starsAllocated++;
          }
        });
      }
    } else if (selectedStrategy === 'balanced') {
      // Spread budget based on typical positional values
      const weights = { QB: 0.8, RB: 1.2, WR: 1.1, TE: 0.7, DST: 0.3, K: 0.2, 'FLEX/BENCH': 0.5 };
      let totalWeight = 0;
      
      Object.entries(positionNeeds).forEach(([pos, need]) => {
        if (need > 0) {
          const weight = weights[pos as keyof typeof weights] || 0.5;
          totalWeight += weight * need;
        }
      });
      
      Object.entries(positionNeeds).forEach(([pos, need]) => {
        if (need > 0) {
          const weight = weights[pos as keyof typeof weights] || 0.5;
          allocations[pos] = Math.floor((weight * need / totalWeight) * remainingBudget);
        }
      });
    } else if (selectedStrategy === 'zero_rb') {
      // Prioritize WR/TE, minimal RB spending
      const rbBudget = positionNeeds['RB'] > 0 ? positionNeeds['RB'] * 2 : 0; // $2 per RB
      const otherBudget = remainingBudget - rbBudget;
      
      ['WR', 'TE', 'QB'].forEach(pos => {
        if (positionNeeds[pos] > 0) {
          allocations[pos] = Math.floor(otherBudget * 0.3);
        }
      });
      if (positionNeeds['RB'] > 0) {
        allocations['RB'] = rbBudget;
      }
    } else if (selectedStrategy === 'hero_rb') {
      // One expensive RB, then WRs
      if (positionNeeds['RB'] > 0) {
        allocations['RB'] = Math.floor(remainingBudget * 0.4); // 40% on one RB
      }
      const remainingAfterRB = remainingBudget - (allocations['RB'] || 0);
      ['WR', 'TE'].forEach(pos => {
        if (positionNeeds[pos] > 0) {
          allocations[pos] = Math.floor(remainingAfterRB * 0.25);
        }
      });
    } else if (selectedStrategy === 'robust_rb') {
      // Heavy RB investment
      if (positionNeeds['RB'] > 0) {
        allocations['RB'] = Math.floor(remainingBudget * 0.5); // 50% on RBs
      }
      const remainingAfterRB = remainingBudget - (allocations['RB'] || 0);
      ['WR', 'QB', 'TE'].forEach(pos => {
        if (positionNeeds[pos] > 0) {
          allocations[pos] = Math.floor(remainingAfterRB * 0.15);
        }
      });
    }
    
    return allocations;
  }, [remainingBudget, spotsLeft, positionNeeds, selectedStrategy]);

  // Get warnings
  const warnings = useMemo(() => {
    const warns: string[] = [];
    
    if (remainingBudget / spotsLeft < 3) {
      warns.push('Budget very tight - may need all $1-2 players');
    }
    
    if (spotsLeft <= 5 && Object.values(positionNeeds).some(n => n > 2)) {
      warns.push('Multiple starters still needed with few spots left');
    }
    
    if (marketConditions.get('RB')! > 1.15 && positionNeeds['RB'] > 0) {
      warns.push('RB market inflated - consider pivoting strategy');
    }
    
    return warns;
  }, [remainingBudget, spotsLeft, positionNeeds, marketConditions]);

  const maxBid = spotsLeft > 1 ? remainingBudget - (spotsLeft - 1) : remainingBudget;

  return (
    <div className="bg-gray-900/50 backdrop-blur-sm rounded-xl p-4 border border-gray-800">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Target className="w-5 h-5 text-green-400" />
          Budget Allocator
        </h3>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-xs text-gray-400 hover:text-white"
        >
          {showDetails ? 'Hide' : 'Show'} Details
        </button>
      </div>

      {/* Budget Overview */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-gray-800/50 rounded-lg p-2 text-center">
          <div className="text-xs text-gray-500">Remaining</div>
          <div className="text-lg font-bold text-green-400">${remainingBudget}</div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-2 text-center">
          <div className="text-xs text-gray-500">Spots Left</div>
          <div className="text-lg font-bold text-blue-400">{spotsLeft}</div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-2 text-center">
          <div className="text-xs text-gray-500">Max Bid</div>
          <div className="text-lg font-bold text-orange-400">${maxBid}</div>
        </div>
      </div>

      {/* Strategy Selector */}
      <div className="mb-4">
        <div className="text-xs text-gray-500 mb-2">Draft Strategy</div>
        <select
          value={selectedStrategy}
          onChange={(e) => setSelectedStrategy(e.target.value as Strategy)}
          className="w-full bg-gray-800 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {Object.entries(STRATEGY_DESCRIPTIONS).map(([key, desc]) => (
            <option key={key} value={key}>
              {key.replace(/_/g, ' ').toUpperCase()} - {desc}
            </option>
          ))}
        </select>
      </div>

      {/* Position Needs & Allocation */}
      <div className="mb-4">
        <div className="text-xs text-gray-500 mb-2">Recommended Allocation</div>
        <div className="space-y-2">
          {Object.entries(positionNeeds).map(([pos, need]) => {
            if (need === 0) return null;
            const suggested = allocation?.[pos] || 0;
            const avgValue = suggested / Math.max(need, 1);
            
            return (
              <div key={pos} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-300">{pos}</span>
                  <span className="text-xs text-gray-500">({need} needed)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-yellow-400">
                    ${suggested}
                  </span>
                  <span className="text-xs text-gray-500">
                    (~${avgValue.toFixed(0)}/player)
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Market Conditions */}
      {showDetails && (
        <div className="mb-4">
          <div className="text-xs text-gray-500 mb-2">Market Conditions</div>
          <div className="grid grid-cols-6 gap-1">
            {Array.from(marketConditions.entries()).map(([pos, factor]) => (
              <div key={pos} className="text-center">
                <div className="text-xs text-gray-400">{pos}</div>
                <div className={`text-sm font-bold ${
                  factor > 1.1 ? 'text-red-400' : 
                  factor < 0.9 ? 'text-green-400' : 
                  'text-gray-400'
                }`}>
                  {factor > 1 ? '+' : ''}{((factor - 1) * 100).toFixed(0)}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="space-y-1">
          {warnings.map((warning, idx) => (
            <div key={idx} className="flex items-center gap-2 text-xs text-yellow-400">
              <AlertTriangle className="w-3 h-3" />
              <span>{warning}</span>
            </div>
          ))}
        </div>
      )}

      {/* Quick Tips */}
      <div className="mt-3 p-2 bg-blue-900/20 border border-blue-700/50 rounded-lg">
        <div className="flex items-center gap-2 text-xs text-blue-400">
          <Zap className="w-3 h-3" />
          <span>
            {spotsLeft <= 3 
              ? "Final picks - prioritize filling starters!"
              : remainingBudget / spotsLeft > 15
              ? "Budget healthy - can target a star"
              : "Stay disciplined - look for values"}
          </span>
        </div>
      </div>
    </div>
  );
};

export default BudgetAllocator;