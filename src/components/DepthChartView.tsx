import React, { useState } from 'react';
import { DepthChartEntry, DepthChartTeam } from '@/types';
import { Users, ChevronDown, ChevronUp } from 'lucide-react';

interface DepthChartViewProps {
  depthCharts: {
    teams: DepthChartTeam[];
    byPlayer: Map<string, DepthChartEntry>;
    byTeam: Map<string, DepthChartTeam>;
  };
  onPlayerSelect?: (player: DepthChartEntry) => void;
}

const DepthChartView: React.FC<DepthChartViewProps> = ({ depthCharts, onPlayerSelect }) => {
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<'ALL' | 'QB' | 'RB' | 'WR' | 'TE'>('ALL');

  const getRoleColor = (depthOrder: number, position: string) => {
    if (depthOrder === 1) return 'text-green-400 bg-green-500/10';
    if (position === 'RB' && depthOrder <= 2) return 'text-yellow-400 bg-yellow-500/10';
    if (position === 'WR' && depthOrder <= 3) return 'text-yellow-400 bg-yellow-500/10';
    if (position === 'TE' && depthOrder === 2) return 'text-yellow-400 bg-yellow-500/10';
    return 'text-gray-400 bg-gray-500/10';
  };

  const getECRColor = (ecr: number) => {
    if (ecr <= 30) return 'text-purple-400';
    if (ecr <= 60) return 'text-blue-400';
    if (ecr <= 100) return 'text-green-400';
    if (ecr <= 150) return 'text-yellow-400';
    return 'text-gray-400';
  };

  const filteredTeams = depthCharts.teams.filter(team => {
    if (selectedPosition === 'ALL') return true;
    return team[selectedPosition] && team[selectedPosition].length > 0;
  });

  return (
    <div className="bg-gray-900 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          NFL Depth Charts
        </h2>
        
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">Filter:</span>
          <select
            value={selectedPosition}
            onChange={(e) => setSelectedPosition(e.target.value as any)}
            className="bg-gray-800 text-white px-3 py-1 rounded text-sm"
          >
            <option value="ALL">All Positions</option>
            <option value="QB">Quarterbacks</option>
            <option value="RB">Running Backs</option>
            <option value="WR">Wide Receivers</option>
            <option value="TE">Tight Ends</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-h-96 overflow-y-auto">
        {filteredTeams.map((team) => (
          <div key={team.team} className="bg-gray-800 rounded-lg overflow-hidden">
            <button
              className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-650 transition-colors flex items-center justify-between"
              onClick={() => setExpandedTeam(expandedTeam === team.team ? null : team.team)}
            >
              <span className="font-semibold">{team.team}</span>
              {expandedTeam === team.team ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
            
            {expandedTeam === team.team && (
              <div className="p-3 space-y-3">
                {/* QB Section */}
                {(selectedPosition === 'ALL' || selectedPosition === 'QB') && team.QB.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-400 mb-2">QUARTERBACKS</h4>
                    {team.QB.map((player) => (
                      <button
                        key={player.name}
                        onClick={() => onPlayerSelect?.(player)}
                        className="w-full text-left px-2 py-1 hover:bg-gray-700 rounded transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-sm ${getRoleColor(player.depthOrder, 'QB')} px-2 py-0.5 rounded`}>
                            {player.depthOrder}. {player.name}
                          </span>
                          <span className={`text-xs ${getECRColor(player.ecr)}`}>
                            ECR: {player.ecr}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* RB Section */}
                {(selectedPosition === 'ALL' || selectedPosition === 'RB') && team.RB.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-400 mb-2">RUNNING BACKS</h4>
                    {team.RB.map((player) => (
                      <button
                        key={player.name}
                        onClick={() => onPlayerSelect?.(player)}
                        className="w-full text-left px-2 py-1 hover:bg-gray-700 rounded transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-sm ${getRoleColor(player.depthOrder, 'RB')} px-2 py-0.5 rounded`}>
                            {player.depthOrder}. {player.name}
                          </span>
                          <span className={`text-xs ${getECRColor(player.ecr)}`}>
                            ECR: {player.ecr}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* WR Section */}
                {(selectedPosition === 'ALL' || selectedPosition === 'WR') && team.WR.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-400 mb-2">WIDE RECEIVERS</h4>
                    {team.WR.slice(0, 5).map((player) => (
                      <button
                        key={player.name}
                        onClick={() => onPlayerSelect?.(player)}
                        className="w-full text-left px-2 py-1 hover:bg-gray-700 rounded transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-sm ${getRoleColor(player.depthOrder, 'WR')} px-2 py-0.5 rounded`}>
                            {player.depthOrder}. {player.name}
                          </span>
                          <span className={`text-xs ${getECRColor(player.ecr)}`}>
                            ECR: {player.ecr}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* TE Section */}
                {(selectedPosition === 'ALL' || selectedPosition === 'TE') && team.TE.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-400 mb-2">TIGHT ENDS</h4>
                    {team.TE.map((player) => (
                      <button
                        key={player.name}
                        onClick={() => onPlayerSelect?.(player)}
                        className="w-full text-left px-2 py-1 hover:bg-gray-700 rounded transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-sm ${getRoleColor(player.depthOrder, 'TE')} px-2 py-0.5 rounded`}>
                            {player.depthOrder}. {player.name}
                          </span>
                          <span className={`text-xs ${getECRColor(player.ecr)}`}>
                            ECR: {player.ecr}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-4 pt-4 border-t border-gray-800">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-4">
            <span className="text-gray-500">Depth:</span>
            <span className="text-green-400">Starter</span>
            <span className="text-yellow-400">Key Backup</span>
            <span className="text-gray-400">Depth</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-gray-500">ECR:</span>
            <span className="text-purple-400">Elite (1-30)</span>
            <span className="text-blue-400">Great (31-60)</span>
            <span className="text-green-400">Good (61-100)</span>
            <span className="text-yellow-400">Average (101-150)</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DepthChartView;