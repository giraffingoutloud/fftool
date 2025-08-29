import React, { useState, useEffect } from 'react';
import { runSimulations, type SimulationResult } from '../lib/draftSimulator';
import { testSimulations } from '../testSimulations';
import { runDetailedSimulations } from '../runDetailedSimulations';

export const SimulationTester: React.FC = () => {
  const [results, setResults] = useState<SimulationResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Make test functions available globally for console testing
    (window as any).testSimulations = testSimulations;
    (window as any).runDetailedSimulations = runDetailedSimulations;
    console.log('Test functions available:');
    console.log('• testSimulations() - Run 3 simulations with analysis');
    console.log('• runDetailedSimulations() - Run 2 simulations with full rosters');
  }, []);

  const runSims = async () => {
    setLoading(true);
    try {
      // Run the detailed simulations
      await runDetailedSimulations();
      
      // Also get results for UI display
      const simResults = await runSimulations(2);
      setResults(simResults);
    } catch (error) {
      console.error('Simulation failed:', error);
    }
    setLoading(false);
  };

  return (
    <div className="p-4 bg-gray-900 text-white rounded-lg">
      <h2 className="text-2xl font-bold mb-4">Draft Simulation Tester</h2>
      
      <button
        onClick={runSims}
        disabled={loading}
        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
      >
        {loading ? 'Running Simulations...' : 'Run 2 Detailed Simulations (Check Console)'}
      </button>
      
      <div className="mt-4 text-sm text-gray-400">
        <p>📝 Press F12 to open the console and see detailed roster output</p>
        <p>📊 Full 16-player rosters will be displayed with position breakdown</p>
      </div>

      {results.length > 0 && (
        <div className="mt-6 space-y-6">
          <h3 className="text-xl font-bold">Strategy Guidelines Comparison</h3>
          
          <div className="bg-gray-800 p-4 rounded">
            <h4 className="font-bold mb-2">Target from strat.md:</h4>
            <ul className="text-sm space-y-1">
              <li>✓ 50-60% budget on 2-3 elite RBs (70-80% on top 3-4 players)</li>
              <li>✓ 1 Tier 1 elite RB ($45-52)</li>
              <li>✓ 1 Tier 2 high-end RB ($35-43)</li>
              <li>✓ Total: 5-6 RBs, 6-7 WRs</li>
              <li>✓ Spend 95%+ of budget ($190+)</li>
            </ul>
          </div>

          {results.map((result, idx) => (
            <div key={idx} className="bg-gray-800 p-4 rounded">
              <h4 className="text-lg font-bold mb-3">Simulation {idx + 1}</h4>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <span className="text-gray-400">Budget Spent:</span>
                  <span className={`ml-2 ${result.analysis.budgetEfficient ? 'text-green-400' : 'text-red-400'}`}>
                    ${result.analysis.totalSpent}/200
                  </span>
                </div>
                <div>
                  <span className="text-gray-400">RB Spend:</span>
                  <span className={`ml-2 ${result.analysis.rbHeavy ? 'text-green-400' : 'text-red-400'}`}>
                    ${result.analysis.rbSpend} ({result.analysis.rbSpendPercent.toFixed(1)}%)
                  </span>
                </div>
                <div>
                  <span className="text-gray-400">Elite RBs:</span>
                  <span className={`ml-2 ${result.analysis.eliteRBCount >= 2 ? 'text-green-400' : 'text-yellow-400'}`}>
                    {result.analysis.eliteRBCount}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400">League Rank:</span>
                  <span className={`ml-2 ${result.analysis.leagueRank <= 3 ? 'text-green-400' : 'text-yellow-400'}`}>
                    #{result.analysis.leagueRank}/12
                  </span>
                </div>
              </div>

              <div className="text-sm">
                <div className="mb-2">
                  <span className="text-gray-400">Position Counts:</span>
                  <div className="ml-4">
                    QB: {result.analysis.positionCounts.QB || 0} | 
                    RB: {result.analysis.positionCounts.RB || 0} | 
                    WR: {result.analysis.positionCounts.WR || 0} | 
                    TE: {result.analysis.positionCounts.TE || 0} | 
                    DST: {result.analysis.positionCounts.DST || 0} | 
                    K: {result.analysis.positionCounts.K || 0}
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <span className={result.analysis.meetsRequirements ? 'text-green-400' : 'text-red-400'}>
                    {result.analysis.meetsRequirements ? '✓' : '✗'} Meets Requirements
                  </span>
                  <span className={result.analysis.budgetEfficient ? 'text-green-400' : 'text-red-400'}>
                    {result.analysis.budgetEfficient ? '✓' : '✗'} Budget Efficient
                  </span>
                  <span className={result.analysis.rbHeavy ? 'text-green-400' : 'text-red-400'}>
                    {result.analysis.rbHeavy ? '✓' : '✗'} RB Heavy (50%+)
                  </span>
                </div>
              </div>

              <details className="mt-3">
                <summary className="cursor-pointer text-blue-400 hover:text-blue-300">
                  View Full Roster
                </summary>
                <div className="mt-2 text-xs space-y-1">
                  {result.userTeam.roster
                    .sort((a, b) => {
                      const pickA = result.draftHistory.find(d => d.player.id === a.id);
                      const pickB = result.draftHistory.find(d => d.player.id === b.id);
                      return (pickB?.price || 0) - (pickA?.price || 0);
                    })
                    .map(p => {
                      const pick = result.draftHistory.find(d => d.player.id === p.id);
                      return (
                        <div key={p.id}>
                          {p.name} ({p.position}/{p.tier}) - ${pick?.price || 0}
                        </div>
                      );
                    })}
                </div>
              </details>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};