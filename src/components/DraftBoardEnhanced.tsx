/**
 * Enhanced Draft Board with Team Tracking and Budget Visualization
 * Shows all teams, their rosters, remaining budgets, and needs
 */

import React, { useState, useMemo } from 'react';
import { Users, DollarSign, Target, AlertTriangle, TrendingUp, Package } from 'lucide-react';
import type { ValuationResult } from '@/lib/calibratedValuationService';

interface Team {
  id: string;
  name: string;
  budget: number;
  spent: number;
  roster: any[];
  maxBid: number;
}

interface Props {
  teams: Team[];
  myTeamId: string;
  valuations: ValuationResult[];
  draftHistory: any[];
  onNominatePlayer?: (player: ValuationResult) => void;
}

const ROSTER_REQUIREMENTS = {
  QB: 1,
  RB: 2,
  WR: 2,
  TE: 1,
  FLEX: 1,
  DST: 1,
  K: 1,
  BENCH: 7
};

const POSITION_COLORS_BG = {
  QB: 'bg-red-900/30',
  RB: 'bg-green-900/30',
  WR: 'bg-blue-900/30',
  TE: 'bg-orange-900/30',
  DST: 'bg-purple-900/30',
  K: 'bg-yellow-900/30'
};

const DraftBoardEnhanced: React.FC<Props> = ({
  teams,
  myTeamId,
  valuations,
  draftHistory,
  onNominatePlayer
}) => {
  const [selectedTeam, setSelectedTeam] = useState<string | null>(myTeamId);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Calculate team stats
  const teamStats = useMemo(() => {
    return teams.map(team => {
      // Get drafted players for this team
      const teamPicks = draftHistory.filter(pick => pick.teamId === team.id);
      const rosterByPosition: Record<string, number> = {};
      let totalSpent = 0;
      
      teamPicks.forEach(pick => {
        if (pick.player) {
          const pos = pick.player.position;
          rosterByPosition[pos] = (rosterByPosition[pos] || 0) + 1;
          totalSpent += pick.price || 0;
        }
      });

      const remaining = team.budget - totalSpent;
      const spotsLeft = 16 - teamPicks.length; // Total roster spots
      const maxBid = spotsLeft > 1 ? remaining - (spotsLeft - 1) : remaining;

      // Calculate needs
      const needs: string[] = [];
      if ((rosterByPosition.QB || 0) < ROSTER_REQUIREMENTS.QB) needs.push('QB');
      if ((rosterByPosition.RB || 0) < ROSTER_REQUIREMENTS.RB) needs.push('RB');
      if ((rosterByPosition.WR || 0) < ROSTER_REQUIREMENTS.WR) needs.push('WR');
      if ((rosterByPosition.TE || 0) < ROSTER_REQUIREMENTS.TE) needs.push('TE');
      if ((rosterByPosition.DST || 0) < ROSTER_REQUIREMENTS.DST) needs.push('DST');
      if ((rosterByPosition.K || 0) < ROSTER_REQUIREMENTS.K) needs.push('K');

      // Calculate average price paid
      const avgPrice = teamPicks.length > 0 ? totalSpent / teamPicks.length : 0;

      return {
        team,
        rosterByPosition,
        totalSpent,
        remaining,
        maxBid,
        needs,
        avgPrice,
        rosterCount: teamPicks.length,
        spotsLeft,
        teamPicks
      };
    });
  }, [teams, draftHistory]);

  // Sort teams by different criteria
  const sortedTeams = useMemo(() => {
    return [...teamStats].sort((a, b) => {
      // Put my team first
      if (a.team.id === myTeamId) return -1;
      if (b.team.id === myTeamId) return 1;
      // Then sort by remaining budget
      return b.remaining - a.remaining;
    });
  }, [teamStats, myTeamId]);

  const getBudgetColor = (remaining: number, spotsLeft: number) => {
    const avgPerSpot = remaining / Math.max(spotsLeft, 1);
    if (avgPerSpot < 3) return 'text-red-400';
    if (avgPerSpot < 7) return 'text-yellow-400';
    return 'text-green-400';
  };

  const getNeedColor = (needs: string[]) => {
    if (needs.length === 0) return 'text-green-400';
    if (needs.length <= 2) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="bg-gray-900/50 backdrop-blur-sm rounded-xl p-4 border border-gray-800">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-400" />
          Draft Board
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('grid')}
            className={`px-3 py-1 rounded-lg text-xs ${
              viewMode === 'grid' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Grid
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1 rounded-lg text-xs ${
              viewMode === 'list' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            List
          </button>
        </div>
      </div>

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {sortedTeams.map(({ team, remaining, maxBid, needs, rosterCount, spotsLeft, rosterByPosition }) => (
            <div
              key={team.id}
              className={`p-3 rounded-lg border transition-all cursor-pointer ${
                team.id === myTeamId
                  ? 'bg-blue-900/20 border-blue-500'
                  : selectedTeam === team.id
                  ? 'bg-gray-800/50 border-gray-600'
                  : 'bg-gray-800/30 border-gray-700 hover:border-gray-600'
              }`}
              onClick={() => setSelectedTeam(team.id)}
            >
              {/* Team Header */}
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="font-bold text-white text-sm">
                    {team.name}
                    {team.id === myTeamId && (
                      <span className="ml-2 text-xs text-blue-400">(You)</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400">
                    {rosterCount}/16 spots filled
                  </div>
                </div>
                <div className="text-right">
                  <div className={`font-bold ${getBudgetColor(remaining, spotsLeft)}`}>
                    ${remaining}
                  </div>
                  <div className="text-xs text-gray-500">
                    Max: ${maxBid}
                  </div>
                </div>
              </div>

              {/* Position Counts */}
              <div className="grid grid-cols-6 gap-1 mb-2">
                {['QB', 'RB', 'WR', 'TE', 'DST', 'K'].map(pos => (
                  <div 
                    key={pos} 
                    className={`text-center py-1 rounded text-xs ${
                      (rosterByPosition[pos] || 0) >= ROSTER_REQUIREMENTS[pos as keyof typeof ROSTER_REQUIREMENTS]
                        ? 'bg-green-900/30 text-green-400'
                        : needs.includes(pos)
                        ? 'bg-red-900/30 text-red-400'
                        : 'bg-gray-800 text-gray-400'
                    }`}
                  >
                    <div className="font-bold">{pos}</div>
                    <div>{rosterByPosition[pos] || 0}</div>
                  </div>
                ))}
              </div>

              {/* Needs */}
              {needs.length > 0 && (
                <div className="flex items-center gap-1 text-xs">
                  <Target className="w-3 h-3 text-gray-500" />
                  <span className={getNeedColor(needs)}>
                    Needs: {needs.join(', ')}
                  </span>
                </div>
              )}

              {/* Warning if low budget */}
              {remaining < 20 && spotsLeft > 3 && (
                <div className="mt-2 flex items-center gap-1 text-xs text-yellow-400">
                  <AlertTriangle className="w-3 h-3" />
                  Budget tight!
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {sortedTeams.map(({ team, remaining, maxBid, needs, rosterCount, spotsLeft, teamPicks, avgPrice }) => (
            <div
              key={team.id}
              className={`p-3 rounded-lg border ${
                team.id === myTeamId
                  ? 'bg-blue-900/20 border-blue-500'
                  : 'bg-gray-800/30 border-gray-700'
              }`}
            >
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-3">
                  <div>
                    <div className="font-bold text-white">
                      {team.name}
                      {team.id === myTeamId && (
                        <span className="ml-2 text-xs text-blue-400">(You)</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400">
                      {rosterCount}/16 • Avg: ${avgPrice.toFixed(0)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div>
                    <div className={`font-bold ${getBudgetColor(remaining, spotsLeft)}`}>
                      ${remaining} left
                    </div>
                    <div className="text-xs text-gray-500">
                      Max bid: ${maxBid}
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent picks */}
              {teamPicks.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {teamPicks.slice(-5).map((pick, idx) => (
                    <span
                      key={idx}
                      className={`px-2 py-1 rounded text-xs ${
                        POSITION_COLORS_BG[pick.player.position as keyof typeof POSITION_COLORS_BG] || 'bg-gray-800'
                      }`}
                    >
                      {pick.player.name} ${pick.price}
                    </span>
                  ))}
                  {teamPicks.length > 5 && (
                    <span className="px-2 py-1 text-xs text-gray-500">
                      +{teamPicks.length - 5} more
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Selected Team Detail */}
      {selectedTeam && viewMode === 'grid' && (
        <div className="mt-4 p-3 bg-gray-800/50 rounded-lg border border-gray-700">
          <div className="text-sm font-bold text-white mb-2">
            {teamStats.find(t => t.team.id === selectedTeam)?.team.name} Roster
          </div>
          <div className="space-y-1">
            {teamStats.find(t => t.team.id === selectedTeam)?.teamPicks.map((pick, idx) => (
              <div key={idx} className="flex justify-between text-xs">
                <span className="text-gray-300">
                  {pick.player.name} ({pick.player.position})
                </span>
                <span className="text-gray-400">${pick.price}</span>
              </div>
            )) || <div className="text-xs text-gray-500">No players drafted yet</div>}
          </div>
        </div>
      )}
    </div>
  );
};

export default DraftBoardEnhanced;