import { useEffect, useState } from 'react';
import { dataService } from '@/lib/dataService';
import { pprScoringService } from '@/lib/pprScoringService';

export function PPRDebugPanel() {
  const [debugInfo, setDebugInfo] = useState<any>(null);
  
  useEffect(() => {
    const checkPPRData = async () => {
      try {
        const data = await dataService.getData();
        
        // Check if playerAdvanced data exists
        const advancedMapSize = data.playerAdvanced?.size || 0;
        const sampleKeys = data.playerAdvanced ? 
          Array.from(data.playerAdvanced.keys()).slice(0, 5) : [];
        
        // Check specific players
        const checkPlayer = (name: string, position: string) => {
          const key = `${name.toLowerCase()}_${position.toLowerCase()}`;
          const hasPlayer = data.playerAdvanced?.has(key);
          const playerData = data.playerAdvanced?.get(key);
          
          // Find in projections
          const projection = data.projections.find(p => 
            p.name.toLowerCase() === name.toLowerCase() && 
            p.position === position
          );
          
          // Calculate PPR score - use advanced data if available, otherwise projection
          let pprScore = null;
          if (playerData) {
            // Create a mock player with advanced stats
            const mockPlayer = {
              position,
              targets: playerData.targets,
              receptions: playerData.receptions,
              targetShare: playerData.targetShare,
              catchRate: playerData.catchRate,
              yardsPerRouteRun: playerData.yardsPerRouteRun,
              redZoneTargets: playerData.redZoneTargets,
              receivingYards: playerData.receivingYards,
              games: 17
            };
            pprScore = pprScoringService.calculatePPRScore(mockPlayer as any);
          } else if (projection) {
            pprScore = pprScoringService.calculatePPRScore(projection as any);
          }
          
          return {
            name,
            position,
            key,
            hasAdvancedData: hasPlayer,
            advancedData: playerData ? {
              targets: playerData.targets,
              receptions: playerData.receptions,
              targetShare: playerData.targetShare,
              catchRate: playerData.catchRate,
              redZoneTargets: playerData.redZoneTargets
            } : null,
            projectionData: projection ? {
              targets: projection.targets,
              receptions: projection.receptions,
              targetShare: projection.targetShare
            } : null,
            pprScore
          };
        };
        
        const testPlayers = [
          checkPlayer("ja'marr chase", "WR"),
          checkPlayer("ceedee lamb", "WR"),
          checkPlayer("breece hall", "RB")
        ];
        
        setDebugInfo({
          advancedMapSize,
          sampleKeys,
          testPlayers,
          timestamp: new Date().toISOString()
        });
        
      } catch (error) {
        console.error('[PPRDebugPanel] Error:', error);
        setDebugInfo({ error: String(error) });
      }
    };
    
    checkPPRData();
  }, []);
  
  if (!debugInfo) return <div>Loading PPR debug info...</div>;
  
  return (
    <div className="fixed bottom-4 right-4 bg-gray-900 text-white p-4 rounded-lg shadow-lg max-w-md z-50">
      <h3 className="font-bold mb-2">PPR Debug Info</h3>
      <div className="text-xs space-y-1">
        <div>Advanced Map Size: {debugInfo.advancedMapSize}</div>
        <div>Sample Keys: {debugInfo.sampleKeys?.join(', ')}</div>
        <div className="mt-2">Test Players:</div>
        {debugInfo.testPlayers?.map((player: any, i: number) => (
          <div key={i} className="ml-2 border-l pl-2">
            <div>{player.name} ({player.position})</div>
            <div>Key: {player.key}</div>
            <div>Has Advanced: {String(player.hasAdvancedData)}</div>
            <div>PPR Score: {player.pprScore?.score || 'N/A'}</div>
            {player.projectionData && (
              <div>Proj Targets: {player.projectionData.targets || 0}</div>
            )}
            {player.advancedData && (
              <div className="text-green-400">
                <div>Adv Targets: {player.advancedData.targets || 0}</div>
                <div>Adv Recs: {player.advancedData.receptions || 0}</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}