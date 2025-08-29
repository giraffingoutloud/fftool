/**
 * EXPERIMENTAL VERSION - Fantasy Football Auction Tool
 * This is where we test new features and improvements
 */

import { useState, useEffect } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { 
  AlertTriangle,
  RefreshCw,
  Calculator,
  Settings,
  Zap,
  X
} from 'lucide-react';
import { useDraftStore } from '@/store/draftStore';
import { dataService } from '@/lib/dataService';
import { calibratedValuationService, type ValuationResult, type ValuationSummary } from '@/lib/calibratedValuationService';
import { DataIntegrityChecker } from '@/lib/dataIntegrityChecker';
import { dynamicValuationService, type DraftContext } from '@/lib/dynamicValuationService';
import { pprScoringService } from '@/lib/pprScoringService';

// Import components
import TeamRoster from '@/components/TeamRoster';
import DraftHistory from '@/components/DraftHistory';
import MarketTrackerCalibrated from '@/components/MarketTrackerCalibrated';
import BudgetAllocator from '@/components/BudgetAllocator';
import PlayerDataTable from '@/components/PlayerDataTableExperimental';
import PlayerDetailPanel from '@/components/PlayerDetailPanelCompact';
import CalculationsExplainerModal from '@/components/CalculationsExplainerModal';
import SettingsModal from '@/components/SettingsModal';
import OtherTeamsRosters from '@/components/OtherTeamsRosters';
import NominationStrategy from '@/components/NominationStrategy';
import { SimulationTester } from '@/components/SimulationTester';

function AppExperimental() {
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [valuations, setValuations] = useState<ValuationResult[]>([]);
  const [baseValuations, setBaseValuations] = useState<ValuationResult[]>([]); // Store original values
  const [summary, setSummary] = useState<ValuationSummary | null>(null);
  const [showCalculationsModal, setShowCalculationsModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showSimulationTester, setShowSimulationTester] = useState(false);
  const [isDynamicMode, setIsDynamicMode] = useState(false); // Start in static mode for testing
  const [searchQuery, setSearchQuery] = useState<string>(''); // Shared search state
  const [showDropdown, setShowDropdown] = useState(false); // Dropdown visibility
  const [filteredPlayers, setFilteredPlayers] = useState<ValuationResult[]>([]); // Filtered results
  const [highlightedIndex, setHighlightedIndex] = useState(-1); // Keyboard navigation
  const [integrityStatus, setIntegrityStatus] = useState<{
    checked: boolean;
    passed: boolean;
    message: string;
  }>({ checked: false, passed: false, message: 'Checking...' });

  const { 
    isDraftActive,
    initializeDraft,
    updatePlayerValuations,
    draftHistory,
    myTeamId,
    teams,
    selectedPlayer,
    setSelectedPlayer
  } = useDraftStore();

  useEffect(() => {
    loadData();
    // Expose valuations for simulation testing
    (window as any).__playerValuations = valuations;
  }, []);
  
  useEffect(() => {
    // Update exposed valuations when they change
    (window as any).__playerValuations = valuations;
  }, [valuations]);

  // Update valuations when draft progresses or dynamic mode changes
  useEffect(() => {
    console.log('[Valuation Update Trigger]', {
      baseValuationsCount: baseValuations.length,
      isDynamicMode,
      draftHistoryLength: draftHistory.length,
      loading,
      teamsLength: teams.length
    });
    
    if (!baseValuations.length || loading) {
      console.log('[Valuation Update] Skipping - no base valuations or loading');
      return;
    }
    
    // Toggle dynamic mode in service
    dynamicValuationService.setDynamicMode(isDynamicMode);
    
    if (isDynamicMode) {
      console.log('[Dynamic Mode Active] Building context...', {
        teamsLength: teams.length,
        draftHistoryLength: draftHistory.length
      });
      // Build draft context even if no picks yet
      const draftedIds = new Set(draftHistory.map(pick => pick.player?.id).filter(Boolean));
      
      // Use 12 teams as default if draft not initialized
      const teamCount = teams.length || 12;
      
      // Calculate money spent and remaining
      const totalBudget = teamCount * 200;
      const moneySpent = draftHistory.reduce((sum, pick) => sum + (pick.price || 0), 0);
      const moneyRemaining = totalBudget - moneySpent;
      
      // Calculate positions filled and needed
      const positionsFilled: Record<string, number> = {};
      const positionsNeeded: Record<string, number> = {
        QB: teamCount * 1,
        RB: teamCount * 3,
        WR: teamCount * 3,
        TE: teamCount * 1,
        DST: teamCount * 1,
        K: teamCount * 1
      };
      
      draftHistory.forEach(pick => {
        if (pick.player?.position) {
          positionsFilled[pick.player.position] = (positionsFilled[pick.player.position] || 0) + 1;
          positionsNeeded[pick.player.position] = Math.max(0, (positionsNeeded[pick.player.position] || 0) - 1);
        }
      });
      
      // Build team budgets (use defaults if no teams initialized)
      const teamBudgets = new Map<string, number>();
      if (teams.length > 0) {
        teams.forEach(team => {
          const spent = draftHistory
            .filter(pick => pick.team === team.id)
            .reduce((sum, pick) => sum + (pick.price || 0), 0);
          teamBudgets.set(team.id, 200 - spent);
        });
      } else {
        // Default: all teams have full budget
        for (let i = 0; i < teamCount; i++) {
          teamBudgets.set(`team_${i}`, 200);
        }
      }
      
      // Get recent picks for trend analysis
      const recentPicks = draftHistory.slice(-5).map(pick => {
        const valuation = baseValuations.find(v => v.playerId === pick.player?.id);
        return {
          playerId: pick.player?.id || '',
          actualPrice: pick.price || 0,
          expectedPrice: valuation?.auctionValue || pick.price || 0,
          position: pick.player?.position || ''
        };
      });
      
      const context: DraftContext = {
        totalBudget,
        moneySpent,
        moneyRemaining,
        playersPickedCount: draftHistory.length,
        playersRemainingCount: (teamCount * 16) - draftHistory.length,
        positionsFilled,
        positionsNeeded,
        recentPicks,
        teamBudgets
      };
      
      // Get dynamic valuations (will apply adjustments if picks exist)
      console.log('[Before getDynamicValuations]', {
        contextMoneyRemaining: context.moneyRemaining,
        contextPlayersRemaining: context.playersRemainingCount,
        draftedIdsSize: draftedIds.size,
        isDynamicMode: dynamicValuationService.isDynamic()
      });
      
      const dynamicVals = dynamicValuationService.getDynamicValuations(context, draftedIds);
      
      // Debug: Log a sample player's value change
      if (dynamicVals.length > 0 && baseValuations.length > 0) {
        const samplePlayer = dynamicVals.find(p => p.playerName === 'Bijan Robinson') || dynamicVals[0];
        const basePlayer = baseValuations.find(p => p.playerId === samplePlayer.playerId);
        console.log('[Dynamic Values Update]', {
          player: samplePlayer.playerName,
          baseValue: basePlayer?.value || basePlayer?.auctionValue,
          dynamicValue: samplePlayer.value || samplePlayer.auctionValue,
          samplePlayerObject: samplePlayer,
          inflation: context.moneyRemaining > 0 ? (context.moneyRemaining / (dynamicVals.length * 10)).toFixed(2) : 0,
          draftedCount: draftedIds.size
        });
      } else {
        console.log('[Dynamic Values Update] No values to compare', {
          dynamicValsLength: dynamicVals.length,
          baseValuationsLength: baseValuations.length
        });
      }
      
      
      setValuations(dynamicVals);
      updatePlayerValuations(dynamicVals as any);
    } else {
      // Use base valuations in static mode
      setValuations(baseValuations);
      updatePlayerValuations(baseValuations as any);
    }
  }, [isDynamicMode, draftHistory, baseValuations, teams, loading, updatePlayerValuations]);

  useEffect(() => {
    // Initialize draft automatically after component mounts
    if (!isDraftActive && !loading) {
      try {
        initializeDraft({
          teams: 12,
          budget: 200,
          scoring: 'PPR',
          rosterPositions: [
            { position: 'QB', required: 1 },
            { position: 'RB', required: 2 },
            { position: 'WR', required: 2 },
            { position: 'TE', required: 1 },
            { position: 'FLEX', required: 1 },
            { position: 'DST', required: 1 },
            { position: 'K', required: 1 },
            { position: 'BE', required: 7 }
          ]
        });
      } catch (error) {
        console.error('Failed to initialize draft:', error);
      }
    }
  }, [isDraftActive, loading]);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await dataService.getData();
      
      // Process with calibrated valuation model
      const { valuations: vals, summary: sum } = calibratedValuationService.processPlayers(
        data.projections,
        data.adpData,
        undefined, // sosData - already in projections
        data.playerAdvanced // Pass advanced stats for PPR metrics
      );
      
      // Calculate PPR metrics for each player
      const valsWithPPR = vals.map(player => {
        const pprMetrics = pprScoringService.calculatePPRScore(player);
        return {
          ...player,
          pprMetrics
        };
      });
      
      setValuations(valsWithPPR);
      setBaseValuations(valsWithPPR); // Store base valuations
      setSummary(sum);
      updatePlayerValuations(valsWithPPR as any);
      
      // Initialize dynamic valuation service
      dynamicValuationService.setBaseValuations(vals);
      
      // Run data integrity check
      const integrityResult = DataIntegrityChecker.verifyDataIntegrity(
        data.projections,
        vals
      );
      
      // Integrity check completed - no forced failures
      
      setIntegrityStatus({
        checked: true,
        passed: integrityResult.passed,
        message: integrityResult.passed 
          ? `✓`
          : `⚠`
      });
      
      toast.success('Calibrated valuations loaded successfully!');
    } catch (error) {
      console.error('[AppCalibrated] Error loading data:', error);
      setDataError(error instanceof Error ? error.message : 'Failed to load data');
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };
  
  const handleSettingsApply = async () => {
    // Reload data with new configuration
    await loadData();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-400 mx-auto mb-4"></div>
          <h2 className="text-2xl font-bold text-white">Loading</h2>
        </div>
      </div>
    );
  }

  if (dataError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-red-900 to-gray-900 flex items-center justify-center">
        <div className="bg-red-900/50 border border-red-500 rounded-lg p-6 max-w-md">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Error Loading Data</h2>
          <p className="text-red-200 mb-4">{dataError}</p>
          <button
            onClick={loadData}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 mx-auto"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      <Toaster position="top-right" />
      
      {/* Experimental Banner */}
      <div className="bg-gradient-to-r from-purple-900/50 to-pink-900/50 border-b border-purple-600/30 py-2">
        <div className="flex items-center justify-center gap-3 text-purple-300 text-sm font-medium animate-pulse">
          <span>🧪</span>
          <span>EXPERIMENTAL BUILD</span>
          <span>🚀</span>
        </div>
      </div>
      
      {/* Header */}
      <header className="bg-black/50 backdrop-blur-lg border-b border-purple-500/30 z-50 flex-shrink-0">
        <div className="px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                FFTool
              </h1>
              
              {/* Search Bar */}
              <div className="relative w-64">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    const query = e.target.value;
                    setSearchQuery(query);
                    setHighlightedIndex(-1);
                    
                    if (query.trim()) {
                      const filtered = valuations.filter(player => 
                        player.playerName?.toLowerCase().includes(query.toLowerCase()) ||
                        player.team?.toLowerCase().includes(query.toLowerCase())
                      ).slice(0, 10);
                      setFilteredPlayers(filtered);
                      setShowDropdown(filtered.length > 0);
                    } else {
                      setShowDropdown(false);
                      setFilteredPlayers([]);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (!showDropdown) return;
                    
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setHighlightedIndex(prev => 
                        prev < filteredPlayers.length - 1 ? prev + 1 : prev
                      );
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setHighlightedIndex(prev => prev > 0 ? prev - 1 : -1);
                    } else if (e.key === 'Enter' && highlightedIndex >= 0) {
                      e.preventDefault();
                      const player = filteredPlayers[highlightedIndex];
                      setSelectedPlayer(player);
                      setSearchQuery('');
                      setShowDropdown(false);
                      setFilteredPlayers([]);
                      setHighlightedIndex(-1);
                    } else if (e.key === 'Escape') {
                      setShowDropdown(false);
                      setHighlightedIndex(-1);
                    }
                  }}
                  onFocus={() => {
                    if (searchQuery.trim() && filteredPlayers.length > 0) {
                      setShowDropdown(true);
                    }
                  }}
                  onBlur={() => {
                    setTimeout(() => setShowDropdown(false), 200);
                  }}
                  placeholder="Search players..."
                  className="w-full px-3 py-1.5 pr-8 text-sm bg-gray-800 border border-gray-700 rounded-lg text-gray-200 placeholder-gray-400 focus:outline-none focus:border-blue-400"
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setShowDropdown(false);
                      setFilteredPlayers([]);
                      setHighlightedIndex(-1);
                    }}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white z-10"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
                
                {/* Dropdown */}
                {showDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-80 overflow-y-auto z-50">
                    {filteredPlayers.map((player, index) => {
                      const getPositionColor = () => {
                        const colors: Record<string, string> = {
                          QB: 'text-red-400',
                          RB: 'text-green-400',
                          WR: 'text-blue-400',
                          TE: 'text-orange-400',
                          DST: 'text-purple-400',
                          K: 'text-yellow-400'
                        };
                        return colors[player.position] || 'text-gray-400';
                      };
                      
                      return (
                        <div
                          key={player.playerId}
                          onClick={() => {
                            setSelectedPlayer(player);
                            setSearchQuery('');
                            setShowDropdown(false);
                            setFilteredPlayers([]);
                            setHighlightedIndex(-1);
                          }}
                          className={`px-3 py-2 cursor-pointer transition-colors flex items-center justify-between ${
                            index === highlightedIndex
                              ? 'bg-gray-700'
                              : 'hover:bg-gray-700/50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className={`text-xs font-bold ${getPositionColor()}`}>
                              {player.position}
                            </span>
                            <span className="text-sm font-medium text-white">
                              {player.playerName}
                            </span>
                            <span className="text-xs text-gray-400">
                              {player.team}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs">
                            <span className="text-green-400 font-semibold">
                              ${player.auctionValue}
                            </span>
                            <span className="text-gray-500">
                              Rank #{player.rank || '-'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Draft Status */}
            <div className="flex items-center gap-4">
              {/* Dynamic Mode Toggle */}
              <button
                onClick={() => setIsDynamicMode(!isDynamicMode)}
                className={`px-3 py-1 rounded-lg text-sm flex items-center gap-2 transition-colors ${
                  isDynamicMode 
                    ? 'bg-purple-600 hover:bg-purple-700 text-white' 
                    : 'bg-gray-700 hover:bg-gray-600 text-white'
                }`}
                title={isDynamicMode ? 'Dynamic valuations active' : 'Using static valuations'}
              >
                <Zap className="w-4 h-4" />
                {isDynamicMode ? 'Dynamic' : 'Static'}
                {isDynamicMode && draftHistory.length > 0 && (
                  <span className="text-xs bg-purple-800 px-1 rounded">
                    {draftHistory.length} picks
                  </span>
                )}
              </button>
              
              {/* Settings Button */}
              <button
                onClick={() => setShowSettingsModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg text-sm flex items-center gap-2"
                title="Adjust valuation settings"
              >
                <Settings className="w-4 h-4" />
                Settings
              </button>
              
              {/* Simulation Tester Button */}
              <button
                onClick={() => setShowSimulationTester(true)}
                className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded-lg text-sm flex items-center gap-2"
                title="Run draft simulations"
              >
                <Zap className="w-4 h-4" />
                Test Simulations
              </button>
              
              {/* Calculations Explainer Button */}
              <button
                onClick={() => setShowCalculationsModal(true)}
                className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded-lg text-sm flex items-center gap-2"
                title="Learn how values are calculated"
              >
                <Calculator className="w-4 h-4" />
                Methodology
              </button>
              
              {integrityStatus.checked && (
                <div 
                  className={`px-3 py-1 rounded-lg border ${
                    integrityStatus.passed 
                      ? 'bg-green-900/50 border-green-500' 
                      : 'bg-red-900/50 border-red-500'
                  }`}
                  title={integrityStatus.passed 
                    ? 'Data integrity verified - All teams present' 
                    : 'Data integrity check failed - Some teams missing'}
                >
                  <span className={`text-sm font-medium ${
                    integrityStatus.passed ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {integrityStatus.message}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-2 sm:px-4 md:px-6 lg:px-8 py-4 md:py-6 max-w-full overflow-x-hidden">
        {summary && (
          <div className="flex flex-col gap-4">
            
            {/* Full Width Player Detail Panel */}
            <PlayerDetailPanel 
              player={selectedPlayer}
              allPlayers={valuations}
              onClose={() => setSelectedPlayer(null)}
            />
            
            {/* Three Column Layout - Below Panel */}
            <div className="grid grid-cols-12 gap-2 lg:gap-4">
              {/* Left Column - Team & Budget */}
              <div className="col-span-12 xl:col-span-2 lg:col-span-3 md:col-span-4 space-y-4">
                <TeamRoster teamId={myTeamId} />
                <BudgetAllocator
                  remainingBudget={200 - draftHistory.reduce((sum: number, pick: any) => 
                    pick.team === myTeamId ? sum + (pick.price || 0) : sum, 0)}
                  spotsLeft={16 - draftHistory.filter((pick: any) => pick.team === myTeamId).length}
                  myRoster={draftHistory
                    .filter((pick: any) => pick.team === myTeamId)
                    .map((p: any) => p.player)}
                  valuations={valuations}
                  draftHistory={draftHistory}
                />
              </div>
              
              {/* Middle Column - Player Data Table */}
              <div className="col-span-12 xl:col-span-8 lg:col-span-9 md:col-span-8">
                <div className="w-full overflow-hidden">
                  <PlayerDataTable
                    players={valuations}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    onPlayerSelect={(player) => {
                      console.log('Player selected:', player);
                      setSelectedPlayer(player);
                    }}
                  />
                </div>
              </div>
              
              {/* Right Column - Nomination Strategy, Market Tracker, Draft History & Other Teams */}
              <div className="col-span-12 xl:col-span-2 lg:col-span-12 space-y-4">
                <NominationStrategy valuations={valuations} />
                <MarketTrackerCalibrated 
                  valuations={valuations}
                  draftHistory={draftHistory}
                  onPriceUpdate={(playerId, actualPrice) => {
                    // Update market prices in valuation service
                    calibratedValuationService.updateMarketPrice(playerId, actualPrice);
                  }}
                />
                <DraftHistory />
                <OtherTeamsRosters />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Calculations Explainer Modal */}
      <CalculationsExplainerModal 
        isOpen={showCalculationsModal}
        onClose={() => setShowCalculationsModal(false)}
      />
      
      {/* Settings Modal */}
      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        onApply={handleSettingsApply}
      />
      
      {/* Simulation Tester Modal */}
      {showSimulationTester && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto relative">
            <button
              onClick={() => setShowSimulationTester(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>
            <SimulationTester />
          </div>
        </div>
      )}

      {/* Player Detail Modal - Temporarily removed until fixed */}
    </div>
  );
}

export default AppExperimental;
