import React, { useState } from 'react';
import { Filter, X } from 'lucide-react';

interface AdvancedFiltersProps {
  onFilterChange: (filters: any) => void;
  teamList: string[];
}

const AdvancedFilters: React.FC<AdvancedFiltersProps> = ({ onFilterChange, teamList }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [filters, setFilters] = useState({
    position: '',
    team: '',
    role: '',
    minConfidence: 0,
    recommendation: '',
    minProjectedPoints: 0,
    maxPrice: 200,
    showOnlyAvailable: true
  });

  const updateFilter = (key: string, value: any) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    
    // Clean up empty values before sending
    const cleanFilters = Object.entries(newFilters).reduce((acc, [k, v]) => {
      if (v !== '' && v !== 0 && v !== false && v !== 200) {
        acc[k] = v;
      }
      return acc;
    }, {} as any);
    
    onFilterChange(cleanFilters);
  };

  const resetFilters = () => {
    const defaultFilters = {
      position: '',
      team: '',
      role: '',
      minConfidence: 0,
      recommendation: '',
      minProjectedPoints: 0,
      maxPrice: 200,
      showOnlyAvailable: true
    };
    setFilters(defaultFilters);
    onFilterChange({ showOnlyAvailable: true });
  };

  const activeFilterCount = Object.entries(filters).filter(([key, value]) => {
    if (key === 'showOnlyAvailable') return false;
    if (key === 'maxPrice' && value === 200) return false;
    return value !== '' && value !== 0;
  }).length;

  return (
    <div className="bg-gray-900 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors"
        >
          <Filter className="w-4 h-4" />
          Advanced Filters
          {activeFilterCount > 0 && (
            <span className="px-2 py-0.5 bg-primary text-black rounded-full text-xs">
              {activeFilterCount}
            </span>
          )}
        </button>
        
        {activeFilterCount > 0 && (
          <button
            onClick={resetFilters}
            className="text-xs text-gray-400 hover:text-white flex items-center gap-1"
          >
            <X className="w-3 h-3" />
            Clear All
          </button>
        )}
      </div>

      {isExpanded && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {/* Position Filter */}
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Position</label>
            <select
              value={filters.position}
              onChange={(e) => updateFilter('position', e.target.value)}
              className="w-full bg-gray-800 text-white px-3 py-1.5 rounded text-sm"
            >
              <option value="">All Positions</option>
              <option value="QB">QB</option>
              <option value="RB">RB</option>
              <option value="WR">WR</option>
              <option value="TE">TE</option>
              <option value="DST">DST</option>
              <option value="K">K</option>
            </select>
          </div>

          {/* Team Filter */}
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Team</label>
            <select
              value={filters.team}
              onChange={(e) => updateFilter('team', e.target.value)}
              className="w-full bg-gray-800 text-white px-3 py-1.5 rounded text-sm"
            >
              <option value="">All Teams</option>
              {teamList.map(team => (
                <option key={team} value={team}>{team}</option>
              ))}
            </select>
          </div>

          {/* Role Filter */}
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Depth Role</label>
            <select
              value={filters.role}
              onChange={(e) => updateFilter('role', e.target.value)}
              className="w-full bg-gray-800 text-white px-3 py-1.5 rounded text-sm"
            >
              <option value="">All Roles</option>
              <option value="starter">Starters</option>
              <option value="backup">Backups</option>
              <option value="depth">Depth Players</option>
            </select>
          </div>

          {/* Recommendation Filter */}
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Recommendation</label>
            <select
              value={filters.recommendation}
              onChange={(e) => updateFilter('recommendation', e.target.value)}
              className="w-full bg-gray-800 text-white px-3 py-1.5 rounded text-sm"
            >
              <option value="">All</option>
              <option value="STRONG_BUY">Strong Buy</option>
              <option value="BUY">Buy</option>
              <option value="FAIR">Fair Value</option>
              <option value="PASS">Pass</option>
              <option value="AVOID">Avoid</option>
            </select>
          </div>

          {/* Min Confidence */}
          <div>
            <label className="text-xs text-gray-400 mb-1 block">
              Min Confidence: {Math.round(filters.minConfidence * 100)}%
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={filters.minConfidence}
              onChange={(e) => updateFilter('minConfidence', parseFloat(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Min Projected Points */}
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Min Points</label>
            <input
              type="number"
              min="0"
              max="500"
              value={filters.minProjectedPoints}
              onChange={(e) => updateFilter('minProjectedPoints', parseInt(e.target.value) || 0)}
              className="w-full bg-gray-800 text-white px-3 py-1.5 rounded text-sm"
              placeholder="0"
            />
          </div>

          {/* Max Price */}
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Max Price</label>
            <input
              type="number"
              min="1"
              max="200"
              value={filters.maxPrice}
              onChange={(e) => updateFilter('maxPrice', parseInt(e.target.value) || 200)}
              className="w-full bg-gray-800 text-white px-3 py-1.5 rounded text-sm"
              placeholder="200"
            />
          </div>

          {/* Available Only */}
          <div className="flex items-center">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.showOnlyAvailable}
                onChange={(e) => updateFilter('showOnlyAvailable', e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">Available Only</span>
            </label>
          </div>
        </div>
      )}

      {/* Quick Filters */}
      {!isExpanded && activeFilterCount === 0 && (
        <div className="flex gap-2 mt-2">
          <button
            onClick={() => updateFilter('position', 'RB')}
            className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded text-xs"
          >
            RBs
          </button>
          <button
            onClick={() => updateFilter('position', 'WR')}
            className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded text-xs"
          >
            WRs
          </button>
          <button
            onClick={() => updateFilter('recommendation', 'STRONG_BUY')}
            className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded text-xs"
          >
            Strong Buys
          </button>
          <button
            onClick={() => updateFilter('role', 'starter')}
            className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded text-xs"
          >
            Starters Only
          </button>
        </div>
      )}
    </div>
  );
};

export default AdvancedFilters;