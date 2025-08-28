import { useState, useEffect, useCallback } from 'react';
import { Toaster } from 'react-hot-toast';
import { useDraftStore } from '@/store/draftStore';

// Data Loaders
import { dataService } from '@/lib/dataService';
import type { ComprehensiveData } from '@/types';
import { SleeperAPI } from '@/lib/sleeperApi';

// Core Engines (existing)
import { IntrinsicValueEngine } from '@/lib/intrinsicValueEngine';
import { AdvancedMetricsEngineV2 } from '@/lib/advancedMetricsEngineV2';
import { MarketPriceModel } from '@/lib/marketPriceModel';
import { EdgeCalculator } from '@/lib/edgeCalculator';

// New Advanced Engines
import { EnhancedVORPEngine } from '@/lib/enhancedVORPEngine';
import { AdvancedMonteCarloEngine } from '@/lib/advancedMonteCarloEngine';
import { EnsembleKalmanFilter } from '@/lib/ensembleKalmanFilter';
import { DynamicAuctionAllocator } from '@/lib/dynamicAuctionAllocator';
import { BayesianHierarchicalModel } from '@/lib/bayesianHierarchicalModel';
import { PortfolioOptimizer } from '@/lib/portfolioOptimizer';
import { ParallelCompute } from '@/lib/parallelCompute';
import { AuctionStateMachine } from '@/lib/auctionStateMachine';

// UI Components (existing)
import DraftSetup from '@/components/DraftSetup';
import DraftBoard from '@/components/DraftBoard';
import PlayerTable from '@/components/PlayerTable';
import TeamRoster from '@/components/TeamRoster';
import DraftHistory from '@/components/DraftHistory';

// New UI Components
import AdvancedMetricsPanel from '@/components/AdvancedMetricsPanel';
import MonteCarloVisualization from '@/components/MonteCarloVisualization';
import AuctionStrategyPanel from '@/components/AuctionStrategyPanel';
import PortfolioAnalysis from '@/components/PortfolioAnalysis';
import MarketTracker from '@/components/MarketTracker';
import BayesianInsights from '@/components/BayesianInsights';

import type { 
  PlayerValuation, 
  MetricsAdjustmentV2,
  Position,
  Team,
  PlayerProjection
} from '@/types';

// Ultra-enhanced player valuation with all features
export interface UltraPlayerValuation extends PlayerValuation {
  // Existing enhancements
  metricsAdjustment?: MetricsAdjustmentV2;
  targetShare?: number;
  catchRate?: number;
  yardsAfterCatch?: number;
  touchesPerGame?: number;
  depthRole?: 'starter' | 'backup' | 'depth';
  depthOrder?: number;
  ecr?: number;
  teamOffenseRank?: number;
  teamPaceRank?: number;
  teamRedZoneRank?: number;
  projectionConfidence?: number;
  adjustmentFactors?: string[];
  
  // New advanced features
  beer?: number; // Best Expected Excess Return
  vols?: number; // Value Over Last Starter
  sharpeRatio?: number;
  monteCarloStats?: {
    mean: number;
    median: number;
    percentiles: { p5: number; p25: number; p50: number; p75: number; p95: number };
    skewness: number;
    kurtosis: number;
  };
  kalmanPrice?: number;
  kalmanTrend?: 'up' | 'down' | 'stable';
  bayesianPrediction?: {
    mean: number;
    credibleInterval: { lower: number; upper: number };
  };
  portfolioWeight?: number;
  allocationPriority?: number;
}

function AppV3() {
  // State
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [comprehensiveData, setComprehensiveData] = useState<ComprehensiveData | null>(null);
  const [playerValuations, setPlayerValuations] = useState<UltraPlayerValuation[]>([]);
  const [computingAdvanced, setComputingAdvanced] = useState(false);
  
  // UI State
  const [activeView, setActiveView] = useState<'draft' | 'analysis' | 'strategy'>('draft');
  const [selectedPlayer, setSelectedPlayer] = useState<UltraPlayerValuation | null>(null);
  const [auctionStrategy, setAuctionStrategy] = useState<'balanced' | 'stars_and_scrubs' | 'zero_rb' | 'hero_rb' | 'robust_rb'>('balanced');
  
  // Store
  const { 
    isDraftActive, 
    leagueSettings, 
    teams, 
    myTeamId,
    draftHistory,
    updatePlayerValuations 
  } = useDraftStore();

  // Core Engines
  const [valueEngine, setValueEngine] = useState<IntrinsicValueEngine | null>(null);
  const [advancedEngine, setAdvancedEngine] = useState<AdvancedMetricsEngineV2 | null>(null);
  const [priceModel] = useState(() => new MarketPriceModel());
  const [edgeCalc] = useState(() => new EdgeCalculator(leagueSettings));
  const [sleeperAPI] = useState(() => new SleeperAPI());
  
  // New Advanced Engines
  const [vorpEngine] = useState(() => new EnhancedVORPEngine(leagueSettings));
  const [monteCarloEngine] = useState(() => new AdvancedMonteCarloEngine(100)); // Reduced for performance
  const [kalmanFilter] = useState(() => new EnsembleKalmanFilter(100));
  const [auctionAllocator] = useState(() => new DynamicAuctionAllocator(leagueSettings, 200));
  const [bayesianModel] = useState(() => new BayesianHierarchicalModel(5000));
  const [portfolioOptimizer] = useState(() => new PortfolioOptimizer());
  const [parallelCompute] = useState(() => new ParallelCompute());
  const [auctionStateMachine, setAuctionStateMachine] = useState<AuctionStateMachine | null>(null);

  // Initialize
  useEffect(() => {
    let mounted = true;
    const loadTimeout = setTimeout(() => {
      if (mounted && loading) {
        console.error('Loading timeout - failed to load data');
        setLoading(false);
        setDataError('Loading timeout. Please refresh the page.');
      }
    }, 30000); // 30 second timeout
    
    if (mounted) {
      loadInitialData();
    }
    
    return () => {
      mounted = false;
      clearTimeout(loadTimeout);
      // parallelCompute.terminate(); // Disabled for now
    };
  }, []);

  // Initialize auction state machine when teams are loaded
  useEffect(() => {
    if (teams && teams.length > 0 && !auctionStateMachine) {
      const budgets = new Map(teams.map(t => [t.id, t.budget]));
      setAuctionStateMachine(new AuctionStateMachine(budgets));
    }
  }, [teams, auctionStateMachine]);

  // Update on draft changes
  useEffect(() => {
    if (isDraftActive && comprehensiveData) {
      recalculateValuations();
    }
  }, [draftHistory, isDraftActive]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      console.log('Loading data...');
      
      // Load comprehensive data
      const data = await dataService.getData();
      setComprehensiveData(data);
      console.log('Data loaded:', data);
      
      // Initialize advanced metrics engine V2
      const metricsEngine = new AdvancedMetricsEngineV2(
        data.playerAdvanced,
        data.playerStats,
        data.teamComposites,
        data.depthCharts.byPlayer
      );
      setAdvancedEngine(metricsEngine);
      console.log('Metrics engine initialized');
      
      // Initialize value engine
      const engine = new IntrinsicValueEngine(leagueSettings, metricsEngine as any);
      setValueEngine(engine);
      console.log('Value engine initialized');
      
      // Calculate comprehensive valuations with ALL features
      try {
        const valuations = await calculateUltraValuations(data, engine, metricsEngine);
        
        setPlayerValuations(valuations);
        updatePlayerValuations(valuations);
        console.log('Valuations calculated:', valuations.length);
      } catch (err) {
        console.error('Failed to calculate valuations:', err);
        // Use basic valuations as fallback
        const basicValuations = engine.calculateIntrinsicValues(
          data.projections,
          teams,
          []
        );
        setPlayerValuations(basicValuations as any);
        updatePlayerValuations(basicValuations);
      }
      
      // Skip heavy computations for now
      console.log('Skipping Kalman filter and Bayesian model for debugging');
      // kalmanFilter.initialize(data.projections);
      // await bayesianModel.fit(data.projections);
      
      // Load injury updates
      try {
        const sleeperUpdates = await sleeperAPI.getPlayerUpdates(data.players);
        console.log(`Loaded ${sleeperUpdates.size} injury updates`);
      } catch (err) {
        console.warn('Failed to load Sleeper updates:', err);
      }
      
      setDataError(null);
    } catch (error) {
      console.error('Failed to load data:', error);
      setDataError('Failed to load player data. Please refresh and try again.');
    } finally {
      setLoading(false);
    }
  };

  const calculateUltraValuations = async (
    data: ComprehensiveData,
    engine: IntrinsicValueEngine,
    metricsEngine: AdvancedMetricsEngineV2
  ): Promise<UltraPlayerValuation[]> => {
    setComputingAdvanced(true);
    
    const draftedIds = draftHistory.map(p => p.player.id);
    
    // Calculate base valuations
    console.log('Calculating base valuations with teams:', teams.length);
    const baseValuations = engine.calculateIntrinsicValues(
      data.projections,
      teams.length > 0 ? teams : [{ id: 'temp', name: 'Temp Team', budget: 200, spent: 0, roster: [] }],
      draftedIds
    );
    
    // Build market prices map
    const marketPrices = new Map<string, number>();
    baseValuations.forEach(p => marketPrices.set(p.id, p.marketPrice));
    
    // Temporarily disable heavy computations for debugging
    console.log('Skipping heavy computations for now...');
    
    // Calculate BEER+ with Enhanced VORP
    // const beerResults = vorpEngine.calculateBEERPlus(
    //   data.projections,
    //   data.depthCharts.byPlayer,
    //   marketPrices
    // );
    const beerResults = new Map(); // Empty for now
    
    // Skip Monte Carlo for now
    const monteCarloResults = new Map(); // Empty for now
    
    // Skip portfolio optimization for now
    const portfolio = { portfolio: [] };
    
    // Calculate market conditions for auction allocation
    const marketConditions = new Map<Position, number>();
    ['QB', 'RB', 'WR', 'TE'].forEach(pos => {
      const posPlayers = baseValuations.filter(p => p.position === pos as Position);
      const avgMarket = posPlayers.reduce((sum, p) => sum + p.marketPrice, 0) / posPlayers.length;
      const avgValue = posPlayers.reduce((sum, p) => sum + p.intrinsicValue, 0) / posPlayers.length;
      marketConditions.set(pos as Position, avgMarket / avgValue);
    });
    
    // Get auction allocation
    const myTeam = teams.find(t => t.id === myTeamId)!;
    const allocation = auctionAllocator.allocateBudget(
      auctionStrategy,
      marketConditions,
      myTeam
    );
    
    // Enhance each player with ALL features
    const enhanced = baseValuations.map(player => {
      const enhancedPlayer: UltraPlayerValuation = { ...player };
      
      // Existing enhancements (from AppV2)
      const metricsAdjustment = metricsEngine.getPlayerAdjustment(
        player.name,
        player.position,
        player.team
      );
      enhancedPlayer.metricsAdjustment = metricsAdjustment;
      enhancedPlayer.adjustmentFactors = metricsAdjustment.factors;
      enhancedPlayer.projectionConfidence = metricsAdjustment.confidence;
      
      // Add player advanced stats
      const playerKey = `${player.name.toLowerCase().trim()}_${player.position}`;
      const advanced = data.playerAdvanced.get(playerKey);
      if (advanced) {
        if ('targetShare' in advanced) enhancedPlayer.targetShare = advanced.targetShare;
        if ('catchRate' in advanced) enhancedPlayer.catchRate = advanced.catchRate;
        if ('yardsAfterCatch' in advanced) enhancedPlayer.yardsAfterCatch = advanced.yardsAfterCatch;
        if ('touchesPerGame' in advanced) enhancedPlayer.touchesPerGame = advanced.touchesPerGame;
      }
      
      // Add depth chart info
      const depthInfo = data.depthCharts.byPlayer.get(playerKey);
      if (depthInfo) {
        enhancedPlayer.ecr = depthInfo.ecr;
        enhancedPlayer.depthOrder = depthInfo.depthOrder;
        enhancedPlayer.depthRole = depthInfo.depthOrder === 1 ? 'starter' : 
                                 depthInfo.depthOrder <= 3 ? 'backup' : 'depth';
      }
      
      // Add team metrics
      const teamComposite = data.teamComposites.get(player.team);
      if (teamComposite) {
        const allTeams = Array.from(data.teamComposites.values());
        enhancedPlayer.teamOffenseRank = allTeams.filter(
          t => t.offenseQualityIndex > teamComposite.offenseQualityIndex
        ).length + 1;
        enhancedPlayer.teamPaceRank = allTeams.filter(
          t => t.paceIndex > teamComposite.paceIndex
        ).length + 1;
        enhancedPlayer.teamRedZoneRank = allTeams.filter(
          t => t.redZoneIndex > teamComposite.redZoneIndex
        ).length + 1;
      }
      
      // NEW: Add BEER+ metrics
      const beer = beerResults.get(player.id);
      if (beer) {
        enhancedPlayer.beer = beer.beer;
        enhancedPlayer.vols = beer.vols;
        enhancedPlayer.sharpeRatio = beer.sharpeRatio;
      }
      
      // NEW: Add Monte Carlo results
      const monteCarlo = monteCarloResults.get(player.id);
      if (monteCarlo) {
        enhancedPlayer.monteCarloStats = {
          mean: monteCarlo.mean,
          median: monteCarlo.median,
          percentiles: monteCarlo.percentiles,
          skewness: monteCarlo.skewness,
          kurtosis: monteCarlo.kurtosis
        };
      }
      
      // NEW: Add Kalman filter prediction - SKIPPED FOR NOW
      // const kalmanPred = kalmanFilter.getPrediction(player.id);
      // if (kalmanPred) {
      //   enhancedPlayer.kalmanPrice = kalmanPred.price;
      //   enhancedPlayer.kalmanTrend = kalmanPred.trend;
      // }
      
      // NEW: Add Bayesian prediction - SKIPPED FOR NOW
      // const bayesianPred = bayesianModel.predict(player.id);
      // if (bayesianPred) {
      //   enhancedPlayer.bayesianPrediction = {
      //     mean: bayesianPred.mean,
      //     credibleInterval: bayesianPred.credibleInterval
      //   };
      // }
      
      // NEW: Add portfolio weight
      const portfolioAsset = portfolio.portfolio.find(a => a.playerId === player.id);
      if (portfolioAsset) {
        enhancedPlayer.portfolioWeight = portfolioAsset.weight;
      }
      
      // NEW: Add allocation priority
      const posAllocation = allocation.allocations.find(a => a.position === player.position);
      if (posAllocation) {
        enhancedPlayer.allocationPriority = posAllocation.priority;
      }
      
      return enhancedPlayer;
    });
    
    // Calculate edges with ultra-enhanced data
    if (myTeam) {
      const edges = edgeCalc.calculateEdges(enhanced, myTeam, teams, enhanced);
      
      return enhanced.map(player => {
        const edge = edges.get(player.id);
        if (edge) {
          return {
            ...player,
            edge: edge.finalEdge,
            recommendation: edge.recommendation,
            maxBid: edge.bidRange.max,
            minBid: edge.bidRange.min
          };
        }
        return player;
      });
    }
    
    setComputingAdvanced(false);
    return enhanced;
  };

  const recalculateValuations = useCallback(async () => {
    if (!comprehensiveData || !valueEngine || !advancedEngine) return;
    
    const valuations = await calculateUltraValuations(
      comprehensiveData,
      valueEngine,
      advancedEngine
    );
    
    setPlayerValuations(valuations);
    updatePlayerValuations(valuations);
  }, [comprehensiveData, valueEngine, advancedEngine, draftHistory]);

  const handlePlayerNominated = (player: UltraPlayerValuation) => {
    if (auctionStateMachine) {
      auctionStateMachine.transition('NOMINATE_PLAYER', {
        player,
        nominator: myTeamId
      });
    }
  };

  const handleBidPlaced = (amount: number) => {
    if (auctionStateMachine) {
      auctionStateMachine.transition('PLACE_BID', {
        bid: amount,
        bidder: myTeamId
      });
    }
    
    // Update Kalman filter with new market observation
    if (selectedPlayer) {
      kalmanFilter.update(selectedPlayer.id, amount);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <div className="text-white text-xl">Loading Ultra-Advanced Analytics...</div>
        </div>
      </div>
    );
  }

  if (dataError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="bg-red-900/20 border border-red-500 rounded-lg p-6 max-w-md">
          <h2 className="text-red-400 text-xl font-bold mb-2">Data Load Error</h2>
          <p className="text-gray-300">{dataError}</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Toaster position="top-right" />
      
      {/* Navigation */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between py-3">
            <h1 className="text-2xl font-bold text-blue-400">FF Tool Ultra</h1>
            <div className="flex gap-2">
              <button
                onClick={() => setActiveView('draft')}
                className={`px-4 py-2 rounded ${
                  activeView === 'draft' ? 'bg-blue-600' : 'bg-gray-700'
                }`}
              >
                Draft Board
              </button>
              <button
                onClick={() => setActiveView('analysis')}
                className={`px-4 py-2 rounded ${
                  activeView === 'analysis' ? 'bg-blue-600' : 'bg-gray-700'
                }`}
              >
                Advanced Analysis
              </button>
              <button
                onClick={() => setActiveView('strategy')}
                className={`px-4 py-2 rounded ${
                  activeView === 'strategy' ? 'bg-blue-600' : 'bg-gray-700'
                }`}
              >
                Auction Strategy
              </button>
            </div>
            {computingAdvanced && (
              <div className="text-yellow-400 animate-pulse">
                Computing advanced metrics...
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {!isDraftActive ? (
          <DraftSetup />
        ) : (
          <>
            {activeView === 'draft' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <DraftBoard />
                  <div className="mt-6">
                    <PlayerTable
                      players={playerValuations}
                      onPlayerSelect={setSelectedPlayer}
                      onPlayerNominate={handlePlayerNominated}
                    />
                  </div>
                </div>
                <div className="space-y-6">
                  <TeamRoster />
                  <DraftHistory />
                  {selectedPlayer && (
                    <AdvancedMetricsPanel player={selectedPlayer} />
                  )}
                </div>
              </div>
            )}

            {activeView === 'analysis' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <MonteCarloVisualization players={playerValuations.slice(0, 50)} />
                <PortfolioAnalysis players={playerValuations} teams={teams} />
                <MarketTracker 
                  players={playerValuations}
                  kalmanFilter={kalmanFilter}
                />
                <BayesianInsights 
                  players={playerValuations}
                  bayesianModel={bayesianModel}
                />
              </div>
            )}

            {activeView === 'strategy' && (
              <AuctionStrategyPanel
                allocator={auctionAllocator}
                strategy={auctionStrategy}
                onStrategyChange={setAuctionStrategy}
                team={teams.find(t => t.id === myTeamId)!}
                players={playerValuations}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default AppV3;