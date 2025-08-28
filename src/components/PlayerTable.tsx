import { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, Star, AlertTriangle } from 'lucide-react';
import type { PlayerValuation } from '@/types';

interface PlayerTableProps {
  players: PlayerValuation[];
}

export default function PlayerTable({ players }: PlayerTableProps) {
  const [sortField, setSortField] = useState<keyof PlayerValuation>('edge');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [positionFilter, setPositionFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  
  const handleSort = (field: keyof PlayerValuation) => {
    if (field === sortField) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };
  
  const filteredAndSortedPlayers = useMemo(() => {
    let filtered = players.filter(p => {
      const matchesPosition = positionFilter === 'ALL' || p.position === positionFilter;
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           p.team.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesPosition && matchesSearch;
    });
    
    filtered.sort((a, b) => {
      const aVal = a[sortField] ?? 0;
      const bVal = b[sortField] ?? 0;
      
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
      
      const aStr = String(aVal);
      const bStr = String(bVal);
      return sortDirection === 'asc' 
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr);
    });
    
    return filtered.slice(0, 50);
  }, [players, sortField, sortDirection, positionFilter, searchQuery]);
  
  const getRecommendationColor = (rec: string) => {
    switch (rec) {
      case 'STRONG_BUY': return 'text-green-500';
      case 'BUY': return 'text-green-400';
      case 'FAIR': return 'text-yellow-400';
      case 'PASS': return 'text-orange-400';
      case 'AVOID': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };
  
  const SortIcon = ({ field }: { field: keyof PlayerValuation }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' 
      ? <ChevronUp className="w-4 h-4 inline" />
      : <ChevronDown className="w-4 h-4 inline" />;
  };
  
  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Available Players</h2>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input"
          />
          <select
            value={positionFilter}
            onChange={(e) => setPositionFilter(e.target.value)}
            className="input"
          >
            <option value="ALL">All Positions</option>
            <option value="QB">QB</option>
            <option value="RB">RB</option>
            <option value="WR">WR</option>
            <option value="TE">TE</option>
            <option value="DST">DST</option>
            <option value="K">K</option>
          </select>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left py-2 px-2">
                <button 
                  onClick={() => handleSort('name')}
                  className="hover:text-primary"
                >
                  Player <SortIcon field="name" />
                </button>
              </th>
              <th className="text-left py-2 px-2">Pos</th>
              <th className="text-left py-2 px-2">Team</th>
              <th className="text-right py-2 px-2">
                <button 
                  onClick={() => handleSort('projectedPoints')}
                  className="hover:text-primary"
                >
                  Proj <SortIcon field="projectedPoints" />
                </button>
              </th>
              <th className="text-right py-2 px-2">
                <button 
                  onClick={() => handleSort('vorp')}
                  className="hover:text-primary"
                >
                  VORP <SortIcon field="vorp" />
                </button>
              </th>
              <th className="text-right py-2 px-2">
                <button 
                  onClick={() => handleSort('intrinsicValue')}
                  className="hover:text-primary"
                >
                  Value <SortIcon field="intrinsicValue" />
                </button>
              </th>
              <th className="text-right py-2 px-2">
                <button 
                  onClick={() => handleSort('marketPrice')}
                  className="hover:text-primary"
                >
                  Market <SortIcon field="marketPrice" />
                </button>
              </th>
              <th className="text-right py-2 px-2">
                <button 
                  onClick={() => handleSort('edge')}
                  className="hover:text-primary"
                >
                  Edge <SortIcon field="edge" />
                </button>
              </th>
              <th className="text-center py-2 px-2">Rec</th>
              <th className="text-right py-2 px-2">Bid Range</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedPlayers.map(player => (
              <tr 
                key={player.id}
                className="border-b border-gray-900 hover:bg-gray-900/50 transition-colors"
              >
                <td className="py-2 px-2 font-medium">
                  <div className="flex items-center gap-1">
                    {player.recommendation === 'STRONG_BUY' && (
                      <Star className="w-4 h-4 text-yellow-500" />
                    )}
                    {player.injuryStatus && (
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                    )}
                    {player.name}
                  </div>
                </td>
                <td className="py-2 px-2 text-gray-400">{player.position}</td>
                <td className="py-2 px-2 text-gray-400">{player.team}</td>
                <td className="py-2 px-2 text-right">
                  {(player.projectedPoints || player.points || 0).toFixed(1)}
                </td>
                <td className="py-2 px-2 text-right">
                  {(player.vorp || 0).toFixed(1)}
                </td>
                <td className="py-2 px-2 text-right font-medium">
                  ${(player.intrinsicValue || 0).toFixed(0)}
                </td>
                <td className="py-2 px-2 text-right">
                  ${(player.marketPrice || 0).toFixed(0)}
                </td>
                <td className={`py-2 px-2 text-right font-medium ${
                  player.edge > 0 ? 'text-green-500' : 'text-red-500'
                }`}>
                  ${(player.edge || 0).toFixed(0)}
                </td>
                <td className="py-2 px-2 text-center">
                  <span className={`text-xs font-semibold ${
                    getRecommendationColor(player.recommendation)
                  }`}>
                    {player.recommendation.replace('_', ' ')}
                  </span>
                </td>
                <td className="py-2 px-2 text-right text-gray-400 text-xs">
                  ${player.minBid}-${player.maxBid}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}