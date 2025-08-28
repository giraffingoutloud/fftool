/**
 * Simple test app to verify basic functionality
 */

import { useState, useEffect } from 'react';
import { calibratedValuationService } from '@/lib/calibratedValuationService';
import { dataService } from '@/lib/dataService';

function AppSimple() {
  const [status, setStatus] = useState('Loading...');
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setStatus('Loading data from dataService...');
      const rawData = await dataService.getData();
      
      setStatus('Processing with calibrated valuation model...');
      const { valuations, summary } = calibratedValuationService.processPlayers(
        rawData.projections,
        rawData.adpData
      );
      
      setData({
        projections: rawData.projections.length,
        valuations: valuations.length,
        budgetPercentage: summary.budgetPercentage.toFixed(1),
        topPlayer: valuations[0]
      });
      
      setStatus('Data loaded successfully!');
    } catch (err) {
      console.error('Error loading data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStatus('Error loading data');
    }
  };

  return (
    <div style={{ 
      padding: '20px', 
      fontFamily: 'monospace',
      backgroundColor: '#1a1a1a',
      color: '#ffffff',
      minHeight: '100vh'
    }}>
      <h1>Fantasy Football Tool - Calibrated Model Test</h1>
      <p>Status: {status}</p>
      
      {error && (
        <div style={{ color: 'red', marginTop: '10px' }}>
          Error: {error}
        </div>
      )}
      
      {data && (
        <div style={{ marginTop: '20px' }}>
          <h2>Data Loaded Successfully!</h2>
          <ul>
            <li>Projections: {data.projections} players</li>
            <li>Valuations: {data.valuations} players</li>
            <li>Budget Percentage: {data.budgetPercentage}%</li>
            {data.topPlayer && (
              <li>
                Top Player: {data.topPlayer.playerName} - ${data.topPlayer.auctionValue}
              </li>
            )}
          </ul>
          
          <button 
            onClick={() => window.location.href = '/'} 
            style={{
              marginTop: '20px',
              padding: '10px 20px',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            Go to Full App
          </button>
        </div>
      )}
    </div>
  );
}

export default AppSimple;