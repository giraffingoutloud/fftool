/**
 * Enhanced Fantasy Football Auction Tool with Calibrated Valuation Model
 * Features comprehensive UI with dark theme and professional aesthetics
 */

import { useState, useEffect, useMemo } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { 
  TrendingUp, 
  DollarSign, 
  Target, 
  Users, 
  Trophy,
  AlertTriangle,
  BarChart3,
  Zap,
  Brain,
  Download,
  RefreshCw,
  Calculator,
  Settings
} from 'lucide-react';
import { useDraftStore } from '@/store/draftStore';
import { dataService } from '@/lib/dataService';
import { calibratedValuationService, type ValuationResult, type ValuationSummary } from '@/lib/calibratedValuationService';
import { DataIntegrityChecker } from '@/lib/dataIntegrityChecker';

// Import components
import TeamRoster from '@/components/TeamRoster';
import DraftHistory from '@/components/DraftHistory';
import MarketTrackerCalibrated from '@/components/MarketTrackerCalibrated';
import DraftBoardEnhanced from '@/components/DraftBoardEnhanced';
import BudgetAllocator from '@/components/BudgetAllocator';
import TeamStrengthAnalyzer from '@/components/TeamStrengthAnalyzer';
import CompactDashboardPanel from '@/components/CompactDashboardPanel';
import PlayerDataTable from '@/components/PlayerDataTable';
import CalculationsExplainerModal from '@/components/CalculationsExplainerModal';
import SettingsModal from '@/components/SettingsModal';
import OtherTeamsRosters from '@/components/OtherTeamsRosters';

// Position colors for consistency
const POSITION_COLORS = {
  QB: 'from-red-500 to-red-700',
  RB: 'from-green-500 to-green-700',
  WR: 'from-blue-500 to-blue-700',
  TE: 'from-orange-500 to-orange-700',
  DST: 'from-purple-500 to-purple-700',
  K: 'from-yellow-500 to-yellow-700'
};

// Tier colors
const TIER_COLORS = {
  elite: 'bg-gradient-to-r from-purple-600 to-pink-600 text-white',
  tier1: 'bg-gradient-to-r from-blue-600 to-purple-600 text-white',
  tier2: 'bg-gradient-to-r from-blue-500 to-blue-600 text-white',
  tier3: 'bg-gray-700 text-gray-200',
  replacement: 'bg-gray-800 text-gray-400'
};

function AppCalibrated() {
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [valuations, setValuations] = useState<ValuationResult[]>([]);
  const [summary, setSummary] = useState<ValuationSummary | null>(null);
  const [positionFilter, setPositionFilter] = useState<string>('ALL');
  const [tierFilter, setTierFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'value' | 'vbd' | 'points' | 'edge'>('value');
  const [showCalculationsModal, setShowCalculationsModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
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
    teams,
    myTeamId
  } = useDraftStore();

  useEffect(() => {
    loadData();
  }, []);

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
      const uniqueProjectionTeams = new Set(data.projections.map(p => p.team).filter(Boolean));
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
      setSummary(sum);
      updatePlayerValuations(vals as any);
      
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
  
  const handleSettingsApply = async (config: any) => {
    // Reload data with new configuration
    await loadData();
  };

  // Filtered and sorted players
  const displayPlayers = useMemo(() => {
    let filtered = valuations;

    // Position filter
    if (positionFilter !== 'ALL') {
      filtered = filtered.filter(p => p.position === positionFilter);
    }

    // Tier filter
    if (tierFilter !== 'ALL') {
      filtered = filtered.filter(p => p.tier === tierFilter);
    }

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(p => 
        p.playerName.toLowerCase().includes(term) ||
        p.team.toLowerCase().includes(term)
      );
    }

    // Filter out drafted players
    const draftedIds = new Set(draftHistory.map((pick: any) => pick.player?.id));
    filtered = filtered.filter(p => !draftedIds.has(p.playerId));

    // Sort
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'value':
          return b.auctionValue - a.auctionValue;
        case 'vbd':
          return b.vbd - a.vbd;
        case 'points':
          return b.projectedPoints - a.projectedPoints;
        case 'edge':
          return b.edge - a.edge;
        default:
          return 0;
      }
    });
  }, [valuations, positionFilter, tierFilter, searchTerm, sortBy, draftHistory]);

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
                  onPlayerDraft={(player) => {
                    console.log('Player drafted:', player);
                    // Draft logic here
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
