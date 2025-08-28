/**
 * Team Strength Analyzer
 * Analyzes and visualizes your team's strength/weaknesses during draft
 */

import React, { useMemo } from 'react';
import { Shield, TrendingUp, AlertTriangle, Star, Target } from 'lucide-react';
import type { ValuationResult } from '@/lib/calibratedValuationService';

interface Props {
  myRoster: any[];
  valuations: ValuationResult[];
  remainingBudget: number;
  spotsLeft: number;
}

interface PositionStrength {
  position: string;
  starters: number;
  startersNeeded: number;
  totalValue: number;
  avgValue: number;
  bestPlayer: string | null;
  strength: 'strong' | 'adequate' | 'weak' | 'empty';
}

const POSITION_REQUIREMENTS = {
  QB: 1,
  RB: 2,
  WR: 2,
  TE: 1,
  DST: 1,
  K: 1
};

const TeamStrengthAnalyzer: React.FC<Props> = ({
  myRoster,
  valuations,
  remainingBudget,
  spotsLeft
}) => {
  // Analyze position strengths
  const positionAnalysis = useMemo(() => {
    const analysis: PositionStrength[] = [];
    
    Object.entries(POSITION_REQUIREMENTS).forEach(([pos, required]) => {
      const posPlayers = myRoster.filter((p: any) => p?.position === pos);
      const totalValue = posPlayers.reduce((sum: number, p: any) => {
        const val = valuations.find(v => v.playerId === p.id);
        return sum + (val?.auctionValue || 0);
      }, 0);
      
      const avgValue = posPlayers.length > 0 ? totalValue / posPlayers.length : 0;
      const bestPlayer = posPlayers.length > 0 
        ? posPlayers.sort((a: any, b: any) => {
            const aVal = valuations.find(v => v.playerId === a.id)?.auctionValue || 0;
            const bVal = valuations.find(v => v.playerId === b.id)?.auctionValue || 0;
            return bVal - aVal;
          })[0]?.name || null
        : null;
      
      // Determine strength level
      let strength: PositionStrength['strength'] = 'empty';
      if (posPlayers.length >= required) {
        if (avgValue > 20) strength = 'strong';
        else if (avgValue > 10) strength = 'adequate';
        else strength = 'weak';
      } else if (posPlayers.length > 0) {
        strength = 'weak';
      }
      
      analysis.push({
        position: pos,
        starters: posPlayers.length,
        startersNeeded: required,
        totalValue,
        avgValue,
        bestPlayer,
        strength
      });
    });
    
    return analysis;
  }, [myRoster, valuations]);

  // Calculate team metrics
  const teamMetrics = useMemo(() => {
    const totalSpent = 200 - remainingBudget;
    const avgPrice = myRoster.length > 0 ? totalSpent / myRoster.length : 0;
    
    // Calculate projected points
    const projectedPoints = myRoster.reduce((sum: number, p: any) => {
      const val = valuations.find(v => v.playerId === p?.id);
      return sum + (val?.projectedPoints || 0);
    }, 0);
    
    // Count elite players (top tier)
    const elitePlayers = myRoster.filter((p: any) => {
      const val = valuations.find(v => v.playerId === p?.id);
      return val?.tier === 'elite' || val?.tier === 'tier1';
    }).length;
    
    // Calculate total VBD
    const totalVBD = myRoster.reduce((sum: number, p: any) => {
      const val = valuations.find(v => v.playerId === p?.id);
      return sum + (val?.vbd || 0);
    }, 0);
    
    // Identify biggest weakness
    const weaknesses = positionAnalysis
      .filter(p => p.strength === 'empty' || (p.strength === 'weak' && p.starters < p.startersNeeded))
      .map(p => p.position);
    
    return {
      totalSpent,
      avgPrice,
      projectedPoints,
      elitePlayers,
      totalVBD,
      weaknesses,
      grade: calculateGrade(positionAnalysis, elitePlayers, avgPrice)
    };
  }, [myRoster, remainingBudget, valuations, positionAnalysis]);

  function calculateGrade(
    analysis: PositionStrength[], 
    elites: number, 
    avgPrice: number
  ): string {
    const filledPositions = analysis.filter(p => p.starters >= p.startersNeeded).length;
    const strongPositions = analysis.filter(p => p.strength === 'strong').length;
    
    if (filledPositions === 6 && strongPositions >= 3 && elites >= 2) return 'A+';
    if (filledPositions === 6 && strongPositions >= 2) return 'A';
    if (filledPositions >= 5 && strongPositions >= 2) return 'A-';
    if (filledPositions >= 4 && strongPositions >= 1) return 'B+';
    if (filledPositions >= 3) return 'B';
    if (filledPositions >= 2) return 'B-';
    if (filledPositions >= 1) return 'C';
    return 'D';
  }

  const getStrengthColor = (strength: string) => {
    switch (strength) {
      case 'strong': return 'text-green-400 bg-green-900/30';
      case 'adequate': return 'text-blue-400 bg-blue-900/30';
      case 'weak': return 'text-yellow-400 bg-yellow-900/30';
      case 'empty': return 'text-red-400 bg-red-900/30';
      default: return 'text-gray-400 bg-gray-900/30';
    }
  };

  const getGradeColor = (grade: string) => {
    if (grade.startsWith('A')) return 'text-green-400';
    if (grade.startsWith('B')) return 'text-blue-400';
    if (grade.startsWith('C')) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="bg-gray-900/50 backdrop-blur-sm rounded-xl p-4 border border-gray-800">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Shield className="w-5 h-5 text-purple-400" />
          Team Strength
        </h3>
        <div className={`text-2xl font-bold ${getGradeColor(teamMetrics.grade)}`}>
          {teamMetrics.grade}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-gray-800/50 rounded-lg p-2 text-center">
          <div className="text-xs text-gray-500">Proj Pts</div>
          <div className="text-sm font-bold text-white">
            {teamMetrics.projectedPoints.toFixed(0)}
          </div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-2 text-center">
          <div className="text-xs text-gray-500">Elite</div>
          <div className="text-sm font-bold text-purple-400">
            {teamMetrics.elitePlayers}
          </div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-2 text-center">
          <div className="text-xs text-gray-500">VBD</div>
          <div className="text-sm font-bold text-green-400">
            {teamMetrics.totalVBD.toFixed(0)}
          </div>
        </div>
      </div>

      {/* Position Analysis */}
      <div className="space-y-2 mb-4">
        <div className="text-xs text-gray-500 mb-1">Position Breakdown</div>
        {positionAnalysis.map(pos => (
          <div key={pos.position} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-300 w-8">
                {pos.position}
              </span>
              <div className="flex items-center gap-1">
                {Array.from({ length: pos.startersNeeded }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-2 h-2 rounded-full ${
                      i < pos.starters ? 'bg-green-400' : 'bg-gray-600'
                    }`}
                  />
                ))}
              </div>
              {pos.bestPlayer && (
                <span className="text-xs text-gray-500 truncate max-w-[100px]">
                  {pos.bestPlayer}
                </span>
              )}
            </div>
            <span className={`text-xs px-2 py-1 rounded ${getStrengthColor(pos.strength)}`}>
              {pos.strength}
            </span>
          </div>
        ))}
      </div>

      {/* Flex/Bench */}
      <div className="flex justify-between text-xs mb-3">
        <span className="text-gray-500">Bench Spots</span>
        <span className="text-gray-400">
          {Math.max(0, myRoster.length - Object.values(POSITION_REQUIREMENTS).reduce((a, b) => a + b, 0))} / 7
        </span>
      </div>

      {/* Recommendations */}
      {teamMetrics.weaknesses.length > 0 && (
        <div className="p-2 bg-yellow-900/20 border border-yellow-700/50 rounded-lg">
          <div className="flex items-center gap-2 text-xs text-yellow-400">
            <Target className="w-3 h-3" />
            <span>
              Priority: {teamMetrics.weaknesses.join(', ')}
            </span>
          </div>
        </div>
      )}

      {/* Strategy Tip */}
      {spotsLeft > 0 && (
        <div className="mt-2 p-2 bg-blue-900/20 border border-blue-700/50 rounded-lg">
          <div className="flex items-center gap-2 text-xs text-blue-400">
            <Star className="w-3 h-3" />
            <span>
              {teamMetrics.elitePlayers < 2 && spotsLeft > 5
                ? "Look for elite talent opportunities"
                : teamMetrics.weaknesses.length > 2
                ? "Focus on filling starting positions"
                : spotsLeft <= 3
                ? "Grab best available values"
                : "Balanced approach - mix value and need"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamStrengthAnalyzer;