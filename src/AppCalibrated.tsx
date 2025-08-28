/**
 * Enhanced Fantasy Football Auction Tool with Calibrated Valuation Model
 * Features comprehensive UI with dark theme and professional aesthetics
 */

import { useState, useEffect } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { 
  AlertTriangle,
  RefreshCw,
  Calculator,
  Settings,
  Zap
} from 'lucide-react';
import { useDraftStore } from '@/store/draftStore';
import { dataService } from '@/lib/dataService';
import { calibratedValuationService, type ValuationResult, type ValuationSummary } from '@/lib/calibratedValuationService';
import { DataIntegrityChecker } from '@/lib/dataIntegrityChecker';
import { dynamicValuationService, type DraftContext } from '@/lib/dynamicValuationService';

// Import components
import TeamRoster from '@/components/TeamRoster';
import DraftHistory from '@/components/DraftHistory';
import MarketTrackerCalibrated from '@/components/MarketTrackerCalibrated';
import BudgetAllocator from '@/components/BudgetAllocator';
import CompactDashboardPanel from '@/components/CompactDashboardPanel';
import PlayerDataTable from '@/components/PlayerDataTable';
import CalculationsExplainerModal from '@/components/CalculationsExplainerModal';
import SettingsModal from '@/components/SettingsModal';
import OtherTeamsRosters from '@/components/OtherTeamsRosters';
import NominationStrategy from '@/components/NominationStrategy';

function AppCalibrated() {
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [valuations, setValuations] = useState<ValuationResult[]>([]);
  const [baseValuations, setBaseValuations] = useState<ValuationResult[]>([]); // Store original values
  const [summary, setSummary] = useState<ValuationSummary | null>(null);
  const [showCalculationsModal, setShowCalculationsModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [isDynamicMode, setIsDynamicMode] = useState(false); // Start in static mode for testing
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
    teams
  } = useDraftStore();

  useEffect(() => {
    loadData();
  }, []);

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
      
      // Quick check: Are values actually different?
      if (draftHistory.length > 0 && dynamicVals.length > 0) {
        const firstPlayer = dynamicVals[0];
        const baseFirst = baseValuations[0];
        console.log('[Value Comparison]', {
          playerName: firstPlayer.playerName,
          baseValue: baseFirst.value,
          dynamicValue: firstPlayer.value,
          isDifferent: baseFirst.value !== firstPlayer.value
        });
      }
      
      // Check if values actually changed
      const samplePlayer = dynamicVals[0];
      const baseSample = baseValuations[0];
      console.log('[Dynamic Values Set]', {
        playerName: samplePlayer?.playerName,
        dynamicValue: samplePlayer?.value,
        baseValue: baseSample?.value,
        changed: samplePlayer?.value !== baseSample?.value
      });
      
      setValuations(dynamicVals);
      updatePlayerValuations(dynamicVals as any);
    } else {
      console.log('[Static Mode] Using base valuations');
      const baseSample = baseValuations[0];
      console.log('[Static Values Set]', {
        playerName: baseSample?.playerName,
        value: baseSample?.value
      });
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
      console.log('[AppCalibrated] Loading data...');
      
      const data = await dataService.getData();
      
      // Debug: Check teams in raw projections
      const uniqueProjectionTeams = new Set(data.projections.map((p: any) => p.team).filter(Boolean));
      console.log('[AppCalibrated] Data loaded:', {
        projections: data.projections.length,
        adp: data.adpData.length,
        uniqueTeamsInProjections: uniqueProjectionTeams.size,
        teamsInProjections: Array.from(uniqueProjectionTeams).sort()
      });
      
      // Debug Breece Hall
      const breeceAdp = data.adpData.find((a: any) => a.name === 'Breece Hall');
      if (breeceAdp) {
        console.log('[DEBUG] Breece Hall ADP data from dataService:', breeceAdp);
        console.log('[DEBUG] Breece Hall auctionValue specifically:', breeceAdp.auctionValue);
      }
      
      // Debug SOS data for specific teams
      const nyjPlayers = data.projections.filter((p: any) => p.team === 'NYJ').slice(0, 2);
      const sfPlayers = data.projections.filter((p: any) => p.team === 'SF').slice(0, 2);
      console.log('[SOS DEBUG] NYJ players with SOS:', nyjPlayers.map((p: any) => ({ 
        name: p.name, 
        team: p.team, 
        teamSeasonSOS: p.teamSeasonSOS 
      })));
      console.log('[SOS DEBUG] SF players with SOS:', sfPlayers.map((p: any) => ({ 
        name: p.name, 
        team: p.team, 
        teamSeasonSOS: p.teamSeasonSOS 
      })));
      
      // Process with calibrated valuation model
      const { valuations: vals, summary: sum } = calibratedValuationService.processPlayers(
        data.projections,
        data.adpData
      );
      
      // Debug: Check teams in valuations
      const uniqueTeams = new Set(vals.map(v => v.team).filter(Boolean));
      console.log('[AppCalibrated] Valuations calculated:', {
        count: vals.length,
        budgetPercentage: sum.budgetPercentage.toFixed(1) + '%',
        uniqueTeamsCount: uniqueTeams.size,
        teams: Array.from(uniqueTeams).sort()
      });
      
      setValuations(vals);
      setBaseValuations(vals); // Store base valuations
      setSummary(sum);
      updatePlayerValuations(vals as any);
      
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
      
      console.log('[Data Integrity Check]', {
        passed: integrityResult.passed,
        sourceTeams: integrityResult.sourceTeams.size,
        renderedTeams: integrityResult.renderedTeams.size,
        performanceMs: integrityResult.performanceMs.toFixed(2)
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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900">
      <Toaster position="top-right" />
      
      {/* Header */}
      <header className="bg-black/50 backdrop-blur-lg border-b border-blue-500/30 z-50 flex-shrink-0">
        <div className="px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              FFTool
            </h1>


            {/* Draft Status */}
            <div className="flex items-center gap-4">
              {/* Dynamic Mode Toggle */}
              <button
                onClick={() => {
                  console.log('[Toggle Dynamic Mode]', {
                    currentMode: isDynamicMode ? 'Dynamic' : 'Static',
                    switchingTo: !isDynamicMode ? 'Dynamic' : 'Static',
                    draftHistoryLength: draftHistory.length
                  });
                  setIsDynamicMode(!isDynamicMode);
                }}
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
      <main className="px-6 lg:px-8 py-6">
        {summary && (
          <div className="flex flex-col gap-4">
            {/* Compact Dashboard Panel at Top */}
            <CompactDashboardPanel
              summary={summary}
              valuations={valuations}
              isDraftActive={isDraftActive}
              onStartDraft={() => initializeDraft({
                teams: 12,
                budget: 200,
                scoring: 'PPR',
                rosterPositions: []
              })}
            />
            
            {/* Three Column Layout */}
            <div className="grid grid-cols-12 gap-4">
              {/* Left Column - Team & Budget */}
              <div className="col-span-12 lg:col-span-2 space-y-4">
                <TeamRoster teamId={myTeamId} />
                <NominationStrategy valuations={valuations} />
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
              <div className="col-span-12 lg:col-span-8">
                <PlayerDataTable
                  players={valuations}
                  onPlayerSelect={(player) => {
                    console.log('Player selected:', player);
                    // You can add modal or detail view logic here
                  }}
                />
              </div>
              
              {/* Right Column - Market Tracker, Draft History & Other Teams */}
              <div className="col-span-12 lg:col-span-2 space-y-4">
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

      {/* Player Detail Modal - Temporarily removed until fixed */}
    </div>
  );
}

export default AppCalibrated;
