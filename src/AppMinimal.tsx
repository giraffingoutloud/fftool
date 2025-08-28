import { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { useDraftStore } from '@/store/draftStore';
import { dataService } from '@/lib/dataService';
import { AuctionValuationModel } from '@/lib/auctionValuationModel';
import DraftSetup from '@/components/DraftSetup';
import PlayerTable from '@/components/PlayerTable';
import DraftBoard from '@/components/DraftBoard';
import TeamRoster from '@/components/TeamRoster';
import DraftHistory from '@/components/DraftHistory';
import type { PlayerValuation } from '@/types';

function AppMinimal() {
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [playerValuations, setPlayerValuations] = useState<PlayerValuation[]>([]);
  
  const { 
    isDraftActive,
    updatePlayerValuations 
  } = useDraftStore();

  useEffect(() => {
    loadBasicData();
  }, []);

  const loadBasicData = async () => {
    try {
      setLoading(true);
      console.log('Starting minimal data load...');
      
      const data = await dataService.getData();
      
      console.log('Data loaded, creating basic valuations...');
      console.log('Total projections loaded:', data.projections.length);
      console.log('Total ADP entries loaded:', data.adpData.length);
      
      // Data quality check
      const pointsDistribution: {[key: string]: number} = {};
      data.projections.forEach(p => {
        const range = p.projectedPoints > 400 ? '400+' :
                     p.projectedPoints > 300 ? '300-400' :
                     p.projectedPoints > 200 ? '200-300' :
                     p.projectedPoints > 100 ? '100-200' :
                     p.projectedPoints > 50 ? '50-100' :
                     p.projectedPoints > 0 ? '1-50' : '0';
        pointsDistribution[range] = (pointsDistribution[range] || 0) + 1;
      });
      console.log('Points distribution:', pointsDistribution);
      
      // Check for duplicates
      const namePositionCounts = new Map<string, number>();
      data.projections.forEach(p => {
        const key = `${p.name}_${p.position}`;
        namePositionCounts.set(key, (namePositionCounts.get(key) || 0) + 1);
      });
      const duplicates = Array.from(namePositionCounts.entries())
        .filter(([_, count]) => count > 1)
        .map(([key, count]) => `${key}: ${count}`);
      if (duplicates.length > 0) {
        console.warn('Found duplicate name/position combinations:', duplicates.slice(0, 10));
      }
      
      // Sample data
      if (data.projections.length > 0) {
        console.log('Top 5 by points:', data.projections
          .sort((a, b) => (b.projectedPoints || 0) - (a.projectedPoints || 0))
          .slice(0, 5)
          .map(p => ({
            name: p.name,
            position: p.position,
            team: p.team,
            projectedPoints: p.projectedPoints
          })));
      }
      
      // Initialize auction valuation model
      const valuationModel = new AuctionValuationModel();
      
      // Log ADP distribution
      const adpDistribution: {[key: string]: number} = {};
      
      const basicValuations: PlayerValuation[] = data.projections.map(proj => {
        // Use actual ADP data if available - match by normalized name and position
        // First try exact match, then try without team
        let adpEntry = data.adpData.find(adp => 
          adp.name?.toLowerCase().replace(/[^a-z]/g, '') === proj.name?.toLowerCase().replace(/[^a-z]/g, '') &&
          adp.position === proj.position
        );
        
        // If no match found, try just name without position (for flex players)
        if (!adpEntry) {
          adpEntry = data.adpData.find(adp => 
            adp.name?.toLowerCase().replace(/[^a-z]/g, '') === proj.name?.toLowerCase().replace(/[^a-z]/g, '')
          );
        }
        const adpValue = adpEntry?.adp || 250;  // Default to 250 if no ADP
        
        // Track ADP ranges for debugging
        const adpRange = adpValue <= 30 ? '1-30' : 
                        adpValue <= 60 ? '31-60' :
                        adpValue <= 120 ? '61-120' :
                        adpValue <= 200 ? '121-200' : '200+';
        adpDistribution[adpRange] = (adpDistribution[adpRange] || 0) + 1;
        
        // Use theoretically grounded auction valuation model
        const valuation = valuationModel.calculateValue({
          projection: proj,
          adp: adpValue,
          auctionValue: adpEntry?.auctionValue,
          leagueSettings: {
            budget: 200,
            teams: 12,
            rosterSize: 15,
            starters: {
              QB: 1,
              RB: 2,
              WR: 3,
              TE: 1,
              FLEX: 1,
              DST: 1,
              K: 1
            }
          }
        });
        
        const intrinsicValue = valuation.intrinsicValue;
        const marketPrice = valuation.marketPrice;
        const edge = valuation.edge;
        
        // Calculate VORP using proper baselines
        const points = proj.projectedPoints || 0;
        const replacementLevel = {
          QB: 220,  // QB12 in 12-team league
          RB: 100,  // RB30 (with flex)
          WR: 95,   // WR42 (with flex)
          TE: 80,   // TE14
          DST: 70,  // DST12
          K: 110    // K12
        }[proj.position] || 90;
        const vorp = Math.max(0, points - replacementLevel);
        
        return {
          id: proj.id || `${proj.name}_${proj.position}`,
          name: proj.name,
          position: proj.position,
          team: proj.team || 'FA',
          age: adpEntry?.age || proj.age, // Get age from ADP data or projection
          points: points,
          projectedPoints: points, // Using projectedPoints from the projection data
          vorp: vorp,
          intrinsicValue: intrinsicValue,
          marketPrice: marketPrice,
          adp: adpValue,
          confidence: valuation.confidence,
          injuryStatus: adpEntry?.injuryStatus || proj.injuryStatus || null, // Use real injury status
          // Add fields that PlayerTable expects
          edge: edge,
          recommendation: valuation.recommendation,
          maxBid: Math.max(1, Math.round(intrinsicValue * 1.2)),
          minBid: Math.max(1, Math.round(intrinsicValue * 0.8)),
          replacementLevel: replacementLevel // Add this missing field
        };
      }).filter(p => p.projectedPoints > 0); // Filter out players with no projections
      
      setPlayerValuations(basicValuations);
      updatePlayerValuations(basicValuations);
      
      console.log('Loaded', basicValuations.length, 'players');
      
      // Log age data integration status
      const playersWithAge = basicValuations.filter(p => p.age !== undefined && p.age !== null);
      console.log('Age data integration:', {
        totalPlayers: basicValuations.length,
        playersWithAge: playersWithAge.length,
        percentage: ((playersWithAge.length / basicValuations.length) * 100).toFixed(1) + '%',
        sample: playersWithAge.slice(0, 5).map(p => `${p.name} (age ${p.age})`)
      });
      
      setDataError(null);
    } catch (error) {
      console.error('Failed to load:', error);
      setDataError('Failed to load data. Please refresh.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <div className="text-white text-xl">Loading Minimal App...</div>
        </div>
      </div>
    );
  }

  if (dataError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="bg-red-900/20 border border-red-500 rounded-lg p-6 max-w-md">
          <h2 className="text-red-400 text-xl font-bold mb-2">Error</h2>
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

  console.log('Rendering with isDraftActive:', isDraftActive);
  console.log('Player valuations count:', playerValuations.length);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Toaster position="top-right" />
      
      <div className="container mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-blue-400 mb-6">
          FF Tool - Minimal Version
        </h1>
        
        {!isDraftActive ? (
          <DraftSetup />
        ) : (
          <div>
            <p className="text-white mb-4">Draft Active - Players: {playerValuations.length}</p>
            {playerValuations.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <DraftBoard />
                  <div className="mt-6">
                    <PlayerTable players={playerValuations} />
                  </div>
                </div>
                <div className="space-y-6">
                  <TeamRoster />
                  <DraftHistory />
                </div>
              </div>
            ) : (
              <p className="text-yellow-400">No players loaded yet...</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default AppMinimal;