import React, { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, Check, Eye, Plus, Minus, X } from 'lucide-react';
import type { ValuationResult } from '@/lib/calibratedValuationService';
import { useDraftStore } from '@/store/draftStore';

interface PlayerDataTableProps {
  players: ValuationResult[];
  onPlayerSelect?: (player: ValuationResult) => void;
  onPlayerDraft?: (player: ValuationResult) => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

type SortField = 'position' | 'team' | 'tier' | 'playerRank' | 'maxBid' | 'intrinsicValue' | 
                 'marketValue' | 'edge' | 'edgePercent' | 'vorp' | 'adp' | 'projectedPoints' | 'byeWeek' | 'sos' | 'ppr';
type SortDirection = 'asc' | 'desc';

const PlayerDataTable: React.FC<PlayerDataTableProps> = ({ 
  players, 
  onPlayerSelect,
  onPlayerDraft,
  searchQuery: externalSearchQuery,
  onSearchChange 
}) => {
  const { draftHistory } = useDraftStore();
  const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>('adp');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [displayCount, setDisplayCount] = useState<number>(600); // Show all players by default
  const [internalSearchQuery, setInternalSearchQuery] = useState<string>('');
  const [positionFilter, setPositionFilter] = useState<string>('ALL');
  
  // Use external search if provided, otherwise use internal
  const searchQuery = externalSearchQuery !== undefined ? externalSearchQuery : internalSearchQuery;
  const setSearchQuery = onSearchChange || setInternalSearchQuery;
  
  // Debug: Log when players prop changes
  React.useEffect(() => {
    if (players.length > 0) {
      const samplePlayer = players.find(p => p.playerName === 'Bijan Robinson') || players[0];
      console.log('[PlayerDataTable] Players updated:', {
        totalPlayers: players.length,
        samplePlayer: samplePlayer.playerName,
        sampleValue: samplePlayer.auctionValue,
        timestamp: new Date().toISOString()
      });
    }
  }, [players]);

  // Tier order for sorting (higher number = better tier)
  const tierOrder: Record<string, number> = {
    'elite': 5,
    'tier1': 4,
    'tier2': 3,
    'tier3': 2,
    'replacement': 1,
    'repl': 1,
  };

  // Sorting logic
  const sortedPlayers = useMemo(() => {
    const sorted = [...players].sort((a, b) => {
      let aValue: any = a[sortField as keyof ValuationResult];
      let bValue: any = b[sortField as keyof ValuationResult];

      // Special handling for certain fields
      if (sortField === 'tier') {
        // Convert tier names to numeric values for proper sorting
        const aTier = a.tier || 'replacement';
        const bTier = b.tier || 'replacement';
        aValue = tierOrder[aTier] || 1;
        bValue = tierOrder[bTier] || 1;
      } else if (sortField === 'playerRank') {
        aValue = a.rank || 999;
        bValue = b.rank || 999;
      } else if (sortField === 'maxBid') {
        aValue = a.value || 0;
        bValue = b.value || 0;
      } else if (sortField === 'edgePercent') {
        aValue = a.edge && a.marketValue ? (a.edge / a.marketValue) * 100 : 0;
        bValue = b.edge && b.marketValue ? (b.edge / b.marketValue) * 100 : 0;
      } else if (sortField === 'vorp') {
        aValue = a.vbd || 0;
        bValue = b.vbd || 0;
      } else if (sortField === 'projectedPoints') {
        aValue = a.points || 0;
        bValue = b.points || 0;
      } else if (sortField === 'sos') {
        aValue = a.teamSeasonSOS || 0;
        bValue = b.teamSeasonSOS || 0;
      } else if (sortField === 'ppr') {
        aValue = a.pprMetrics?.score || 0;
        bValue = b.pprMetrics?.score || 0;
      }

      // Handle null/undefined values
      if (aValue === null || aValue === undefined) aValue = 0;
      if (bValue === null || bValue === undefined) bValue = 0;

      // Compare
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [players, sortField, sortDirection]);

  // Filter players by search query and position
  const filteredPlayers = useMemo(() => {
    let filtered = sortedPlayers;
    
    // Filter out drafted players
    const draftedIds = new Set(draftHistory.map(pick => pick.player?.id));
    filtered = filtered.filter(player => !draftedIds.has(player.playerId));
    
    // Apply position filter
    if (positionFilter !== 'ALL') {
      filtered = filtered.filter(player => player.position === positionFilter);
    }
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(player => 
        player.name?.toLowerCase().includes(query) ||
        player.team?.toLowerCase().includes(query) ||
        player.position?.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [sortedPlayers, searchQuery, positionFilter, draftHistory]);

  // Limited players to display
  const displayedPlayers = useMemo(() => {
    return filteredPlayers.slice(0, displayCount);
  }, [filteredPlayers, displayCount]);

  // Toggle sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Toggle selection
  const toggleSelection = (playerKey: string) => {
    const newSelection = new Set(selectedPlayers);
    if (newSelection.has(playerKey)) {
      newSelection.delete(playerKey);
    } else {
      newSelection.add(playerKey);
    }
    setSelectedPlayers(newSelection);
  };

  // Tier label mapping
  const getTierLabel = (tier?: string) => {
    switch(tier) {
      case 'elite': return 'S+';
      case 'tier1': return 'S';
      case 'tier2': return 'A';
      case 'tier3': return 'B';
      case 'replacement': return 'C';
      case 'repl': return 'C';  // Handle abbreviated version
      default: return 'C';  // Default to C for replacement level
    }
  };

  // Color functions
  const getTierColor = (tier?: string) => {
    // Green = best tier, Red = worst tier
    switch(tier) {
      case 'elite': return 'text-green-500 font-bold';
      case 'tier1': return 'text-green-400';
      case 'tier2': return 'text-yellow-400';
      case 'tier3': return 'text-orange-400';
      default: return 'text-red-400';
    }
  };

  const getRankColor = (rank?: number) => {
    // Green = best rank (low number), Red = worst rank (high number)
    if (!rank) return 'text-gray-500';
    if (rank <= 10) return 'text-green-500 font-bold';
    if (rank <= 30) return 'text-green-400';
    if (rank <= 60) return 'text-yellow-400';
    if (rank <= 100) return 'text-orange-400';
    return 'text-red-400';
  };

  const getValueColor = (value: number) => {
    // Green = low price (cheap), Red = high price (expensive)
    if (value >= 50) return 'text-red-400 font-bold';
    if (value >= 30) return 'text-orange-400 font-semibold';
    if (value >= 15) return 'text-yellow-400';
    if (value >= 5) return 'text-green-400';
    return 'text-green-500 font-bold';  // Very cheap
  };

  const getEdgeColor = (edge: number) => {
    if (edge >= 20) return 'text-green-400 font-bold';
    if (edge >= 10) return 'text-green-300 font-semibold';
    if (edge >= 5) return 'text-yellow-400';
    if (edge >= 0) return 'text-gray-300';
    if (edge >= -5) return 'text-orange-400';
    return 'text-red-400';
  };

  const getEdgePercentColor = (percent: number) => {
    if (percent >= 50) return 'text-green-400 font-bold';
    if (percent >= 25) return 'text-green-300 font-semibold';
    if (percent >= 10) return 'text-yellow-400';
    if (percent >= 0) return 'text-gray-300';
    if (percent >= -10) return 'text-orange-400';
    return 'text-red-400';
  };

  const getVorpColor = (vorp: number) => {
    // Green = high VORP, Red = low VORP
    if (vorp >= 100) return 'text-green-500 font-bold';
    if (vorp >= 50) return 'text-green-400';
    if (vorp >= 20) return 'text-yellow-400';
    if (vorp >= 0) return 'text-orange-400';
    return 'text-red-400';
  };

  const getAdpColor = (adp?: number) => {
    // Green = low ADP (early picks), Red = high ADP (late picks)
    if (!adp) return 'text-gray-500';
    if (adp <= 12) return 'text-green-500 font-bold';
    if (adp <= 36) return 'text-green-400';
    if (adp <= 72) return 'text-yellow-400';
    if (adp <= 120) return 'text-orange-400';
    return 'text-red-400';
  };

  const getPointsColor = (points?: number) => {
    // Green = high points, Red = low points
    if (!points) return 'text-gray-400';
    if (points >= 300) return 'text-green-500 font-bold';
    if (points >= 250) return 'text-green-400';
    if (points >= 200) return 'text-yellow-400';
    if (points >= 150) return 'text-orange-400';
    return 'text-red-400';
  };

  const getByeWeekColor = (bye?: number) => {
    if (!bye) return 'text-gray-500';
    // Optimal bye weeks in fantasy football:
    // Best: Weeks 9-11 (mid-season, avoid early/late season crucial games)
    // Good: Weeks 7-8, 12 (still reasonable timing)
    // Moderate: Week 6, 13 (getting less ideal)
    // Poor: Weeks 5, 14 (too early or too late)
    // No byes: Weeks 1-4, 15-18
    
    if (bye >= 9 && bye <= 11) return 'text-green-500 font-semibold';  // Optimal bye weeks
    if (bye === 7 || bye === 8 || bye === 12) return 'text-green-400'; // Good bye weeks
    if (bye === 6 || bye === 13) return 'text-yellow-400';             // Moderate bye weeks
    if (bye === 5 || bye === 14) return 'text-orange-400';             // Poor bye weeks
    return 'text-red-400';  // Should not happen (weeks 1-4, 15-18 don't have byes)
  };

  const getSosColor = (sos?: number) => {
    if (!sos && sos !== 0) return 'text-gray-500';
    // SOS ranges from 0 (easiest) to 10 (hardest)
    if (sos >= 8) return 'text-red-500 font-semibold';    // Very hard schedule
    if (sos >= 6) return 'text-red-400';                  // Hard schedule
    if (sos >= 4) return 'text-orange-400';               // Moderate-hard schedule
    if (sos >= 2) return 'text-yellow-400';               // Moderate schedule
    if (sos >= 1) return 'text-green-400';                // Easy schedule
    return 'text-green-500 font-semibold';                // Very easy schedule (< 1)
  };

  const getPositionColor = (position: string) => {
    const colors: Record<string, string> = {
      QB: 'text-red-400',
      RB: 'text-green-400',
      WR: 'text-blue-400',
      TE: 'text-orange-400',
      DST: 'text-purple-400',
      K: 'text-yellow-400'
    };
    return colors[position] || 'text-gray-400';
  };

  // Sort icon component
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <div className="w-4 h-4 opacity-30">⇅</div>;
    }
    return sortDirection === 'asc' 
      ? <ChevronUp className="w-4 h-4 text-blue-400" />
      : <ChevronDown className="w-4 h-4 text-blue-400" />;
  };

  return (
    <div className="w-full bg-gray-900 rounded-lg overflow-hidden">
      {/* Table wrapper with horizontal scroll and sticky header */}
      <div className="overflow-x-auto overflow-y-hidden relative" style={{ scrollbarWidth: 'thin' }}>
        <table className="w-full min-w-[1200px] relative">
          <thead className="sticky top-0 z-30" style={{ backgroundColor: '#1f2937', boxShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
            <tr className="border-b border-gray-700">
              {/* Checkbox and Action columns with Position Filter */}
              <th className="px-1 py-2 text-center" colSpan={2} style={{ maxWidth: '80px', width: '80px' }}>
                <select
                  value={positionFilter}
                  onChange={(e) => setPositionFilter(e.target.value)}
                  className="w-full px-1 py-1 text-xs bg-gray-700 border border-gray-600 rounded text-gray-200 focus:outline-none focus:border-blue-400"
                >
                  <option value="ALL">All</option>
                  <option value="QB">QB</option>
                  <option value="RB">RB</option>
                  <option value="WR">WR</option>
                  <option value="TE">TE</option>
                  <option value="DST">DST</option>
                  <option value="K">K</option>
                </select>
              </th>

              {/* Name with Search - Hide if using external search */}
              <th className="px-2 py-1 text-left text-xs font-medium min-w-[100px]" style={{ position: 'sticky', left: 0, backgroundColor: '#1f2937', zIndex: 40 }}>
                {externalSearchQuery === undefined ? (
                  <div className="relative">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search..."
                      className="w-full px-2 py-1 pr-6 text-xs bg-gray-700 border border-gray-600 rounded text-gray-200 placeholder-gray-400 focus:outline-none focus:border-blue-400"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-1 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ) : (
                  <span className="text-gray-400">Name</span>
                )}
              </th>

              {/* Sortable columns */}
              <th 
                className="px-2 py-2 text-center text-xs font-medium text-gray-400 cursor-pointer hover:text-white"
                onClick={() => handleSort('position')}
              >
                <div className="flex items-center justify-center gap-1">
                  Pos <SortIcon field="position" />
                </div>
              </th>

              <th 
                className="px-2 py-2 text-center text-xs font-medium text-gray-400 cursor-pointer hover:text-white"
                onClick={() => handleSort('team')}
              >
                <div className="flex items-center justify-center gap-1">
                  Team <SortIcon field="team" />
                </div>
              </th>

              <th 
                className="px-2 py-2 text-center text-xs font-medium text-gray-400 cursor-pointer hover:text-white"
                onClick={() => handleSort('tier')}
              >
                <div className="flex items-center justify-center gap-1">
                  Tier <SortIcon field="tier" />
                </div>
              </th>

              <th 
                className="px-2 py-2 text-center text-xs font-medium text-gray-400 cursor-pointer hover:text-white"
                onClick={() => handleSort('playerRank')}
              >
                <div className="flex items-center justify-center gap-1">
                  Rank <SortIcon field="playerRank" />
                </div>
              </th>

              <th 
                className="px-2 py-2 text-center text-xs font-medium text-gray-400 cursor-pointer hover:text-white"
                onClick={() => handleSort('maxBid')}
              >
                <div className="flex items-center justify-center gap-1">
                  Max Bid <SortIcon field="maxBid" />
                </div>
              </th>

              <th 
                className="px-2 py-2 text-center text-xs font-medium text-gray-400 cursor-pointer hover:text-white"
                onClick={() => handleSort('intrinsicValue')}
              >
                <div className="flex items-center justify-center gap-1">
                  Intrinsic <SortIcon field="intrinsicValue" />
                </div>
              </th>

              <th 
                className="px-2 py-2 text-center text-xs font-medium text-gray-400 cursor-pointer hover:text-white"
                onClick={() => handleSort('marketValue')}
              >
                <div className="flex items-center justify-center gap-1">
                  Market <SortIcon field="marketValue" />
                </div>
              </th>

              <th 
                className="px-2 py-2 text-center text-xs font-medium text-gray-400 cursor-pointer hover:text-white"
                onClick={() => handleSort('edge')}
              >
                <div className="flex items-center justify-center gap-1">
                  Edge <SortIcon field="edge" />
                </div>
              </th>

              <th 
                className="px-2 py-2 text-center text-xs font-medium text-gray-400 cursor-pointer hover:text-white"
                onClick={() => handleSort('edgePercent')}
              >
                <div className="flex items-center justify-center gap-1">
                  Edge% <SortIcon field="edgePercent" />
                </div>
              </th>

              <th 
                className="px-2 py-2 text-center text-xs font-medium text-gray-400 cursor-pointer hover:text-white"
                onClick={() => handleSort('vorp')}
              >
                <div className="flex items-center justify-center gap-1">
                  VORP <SortIcon field="vorp" />
                </div>
              </th>

              <th 
                className="px-2 py-2 text-center text-xs font-medium text-gray-400 cursor-pointer hover:text-white"
                onClick={() => handleSort('adp')}
              >
                <div className="flex items-center justify-center gap-1">
                  ADP <SortIcon field="adp" />
                </div>
              </th>

              <th 
                className="px-2 py-2 text-center text-xs font-medium text-gray-400 cursor-pointer hover:text-white"
                onClick={() => handleSort('projectedPoints')}
              >
                <div className="flex items-center justify-center gap-1">
                  Proj Pts <SortIcon field="projectedPoints" />
                </div>
              </th>

              <th 
                className="px-2 py-2 text-center text-xs font-medium text-gray-400 cursor-pointer hover:text-white"
                onClick={() => handleSort('byeWeek')}
              >
                <div className="flex items-center justify-center gap-1">
                  Bye <SortIcon field="byeWeek" />
                </div>
              </th>

              <th 
                className="px-2 py-2 text-center text-xs font-medium text-gray-400 cursor-pointer hover:text-white"
                onClick={() => handleSort('sos')}
              >
                <div className="flex items-center justify-center gap-1">
                  SOS <SortIcon field="sos" />
                </div>
              </th>
              <th 
                className="px-2 py-2 text-center text-xs font-medium text-gray-400 cursor-pointer hover:text-white"
                onClick={() => handleSort('ppr')}
              >
                <div className="flex items-center justify-center gap-1">
                  PPR <SortIcon field="ppr" />
                </div>
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-800">
            {displayedPlayers.map((player, index) => {
              const edge = player.edge || 0;
              const marketValue = player.marketValue || 1; // Avoid division by zero
              const edgePercent = marketValue > 0 ? (edge / marketValue) * 100 : 0;
              
              // Create a unique key using multiple fields to ensure uniqueness
              const uniqueKey = player.id || `${player.name}_${player.team}_${player.position}_${index}`;

              return (
                <tr
                  key={uniqueKey}
                  className="hover:bg-gray-800/50 transition-colors"
                >
                  {/* Checkbox */}
                  <td className="px-1 py-1 text-center" style={{ maxWidth: '30px', width: '30px' }}>
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded bg-gray-700 border-gray-600"
                      checked={selectedPlayers.has(uniqueKey)}
                      onChange={() => toggleSelection(uniqueKey)}
                    />
                  </td>

                  {/* Action Button */}
                  <td className="px-1 py-1 text-center" style={{ maxWidth: '30px', width: '30px' }}>
                    <button
                      onClick={() => {
                        if (onPlayerSelect) {
                          onPlayerSelect(player);
                        }
                      }}
                      className="p-0.5 hover:bg-gray-700 rounded transition-colors"
                      title="View Details"
                    >
                      <Eye className="w-3 h-3 text-gray-400 hover:text-white" />
                    </button>
                  </td>

                  {/* Name */}
                  <td className="px-2 py-1 min-w-[100px]" style={{ position: 'sticky', left: 0, backgroundColor: '#111827', zIndex: 20 }}>
                    <div style={{ color: 'white', fontWeight: '500' }} className="hover:text-blue-400 cursor-pointer truncate text-left">
                      {(() => {
                        const displayName = player.name || player.playerName || 'Unknown';
                        if (index === 0) {
                          console.log('First player name rendering:', displayName);
                          console.log('First player object keys:', Object.keys(player));
                          console.log('First player intrinsicValue:', player.intrinsicValue);
                          console.log('First player auctionValue:', player.auctionValue);
                          console.log('First player marketValue:', player.marketValue);
                        }
                        return displayName;
                      })()}
                    </div>
                  </td>

                  {/* Position */}
                  <td className="px-1 py-1 text-center">
                    <span className={`font-semibold ${getPositionColor(player.position)}`}>
                      {player.position}
                    </span>
                  </td>

                  {/* Team */}
                  <td className="px-1 py-1 text-gray-300 text-center">
                    {(() => {
                      const teamDisplay = player.team || 'FA';
                      if (index === 0) {
                        console.log('First player team:', player.team, 'from player:', player);
                      }
                      return teamDisplay;
                    })()}
                  </td>

                  {/* Tier */}
                  <td className="px-1 py-1 text-center">
                    <span className={getTierColor(player.tier)}>
                      {getTierLabel(player.tier)}
                    </span>
                  </td>

                  {/* Player Rank */}
                  <td className="px-1 py-1 text-center">
                    <span className={getRankColor(player.rank)}>
                      {player.rank || '-'}
                    </span>
                  </td>

                  {/* Max Bid */}
                  <td className="px-2 py-1 text-center">
                    <span className="text-white">
                      ${player.value || 0}
                      {/* Show (D) if value is different in dynamic mode */}
                      {player.dynamicValue && player.dynamicValue !== player.value && (
                        <span className="text-xs text-purple-400 ml-1" title="Dynamic adjustment applied">
                          *
                        </span>
                      )}
                    </span>
                  </td>

                  {/* Intrinsic Value */}
                  <td className="px-2 py-1 text-center">
                    <span className={getValueColor(player.intrinsicValue || 0)}>
                      ${(() => {
                        const intrinsicVal = player.intrinsicValue || 0;
                        if (player.name === 'Bijan Robinson' || player.playerName === 'Bijan Robinson') {
                          console.log('[PlayerDataTable] Intrinsic value for Bijan:', intrinsicVal, 'Full player:', player);
                        }
                        return intrinsicVal.toFixed(0);
                      })()}
                    </span>
                  </td>

                  {/* Market Value */}
                  <td className="px-2 py-1 text-center">
                    <span className={getValueColor(player.marketValue || 0)}>
                      ${player.marketValue || 0}
                    </span>
                  </td>

                  {/* Edge */}
                  <td className="px-2 py-1 text-center">
                    <span className={getEdgeColor(edge)}>
                      {edge > 0 ? '+' : ''}${Math.abs(edge).toFixed(0)}
                    </span>
                  </td>

                  {/* Edge% */}
                  <td className="px-2 py-1 text-center">
                    <span className={getEdgePercentColor(edgePercent)}>
                      {edgePercent > 0 ? '+' : ''}{edgePercent.toFixed(0)}%
                    </span>
                  </td>

                  {/* VORP */}
                  <td className="px-2 py-1 text-center">
                    <span className={getVorpColor(player.vbd || 0)}>
                      {player.vbd?.toFixed(0) || '0'}
                    </span>
                  </td>

                  {/* ADP */}
                  <td className="px-2 py-1 text-center">
                    <span className={getAdpColor(player.adp)}>
                      {player.adp?.toFixed(1) || '-'}
                    </span>
                  </td>

                  {/* Projected Points */}
                  <td className="px-2 py-1 text-center">
                    <span className={getPointsColor(player.points || 0)}>
                      {(player.points || 0).toFixed(0)}
                    </span>
                  </td>

                  {/* Bye Week */}
                  <td className="px-2 py-1 text-center">
                    <span className={getByeWeekColor(player.byeWeek)}>
                      {player.byeWeek || '-'}
                    </span>
                  </td>

                  {/* SOS */}
                  <td className="px-2 py-1 text-center">
                    <span className={getSosColor(player.teamSeasonSOS)}>
                      {player.teamSeasonSOS?.toFixed(2) || '-'}
                    </span>
                  </td>

                  {/* PPR Score */}
                  <td className="px-2 py-1 text-center">
                    {player.pprMetrics ? (
                      <div className="flex items-center justify-center gap-1">
                        <span 
                          className={`font-semibold ${player.pprMetrics.color}`}
                          title={`PPR Score: ${player.pprMetrics.score.toFixed(1)}/100`}
                        >
                          {player.pprMetrics.score.toFixed(0)}
                        </span>
                        <div 
                          className="w-8 h-1.5 bg-gray-700 rounded-full overflow-hidden"
                        >
                          <div 
                            className="h-full transition-all duration-300"
                            style={{ 
                              width: `${player.pprMetrics.score}%`,
                              backgroundColor: player.pprMetrics.hexColor 
                            }}
                          />
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-600">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Show More/Less Controls */}
      <div className="bg-gray-800 border-t border-gray-700 px-4 py-3 flex items-center justify-between">
        <div className="text-sm text-gray-400">
          Showing {displayedPlayers.length} of {sortedPlayers.length} players
        </div>
        <div className="flex gap-2">
          {displayCount > 50 && (
            <button
              onClick={() => setDisplayCount(Math.max(50, displayCount - 50))}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg flex items-center gap-2 transition-colors"
            >
              <Minus className="w-4 h-4" />
              Show 50 Less
            </button>
          )}
          {displayCount < filteredPlayers.length && (
            <button
              onClick={() => setDisplayCount(Math.min(filteredPlayers.length, displayCount + 50))}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Show 50 More
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlayerDataTable;