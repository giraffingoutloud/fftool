import { useDraftStore } from '@/store/draftStore';
import { Users, TrendingUp, AlertCircle } from 'lucide-react';

interface TeamRosterProps {
  teamId: string;
}

export default function TeamRoster({ teamId }: TeamRosterProps) {
  const { teams, leagueSettings } = useDraftStore();
  const team = teams.find(t => t.id === teamId);
  
  if (!team) return null;
  
  const positionCounts = new Map<string, number>();
  const flexEligible: any[] = [];
  
  team.roster.forEach(pick => {
    const pos = pick.player.position;
    positionCounts.set(pos, (positionCounts.get(pos) || 0) + 1);
    
    if (['RB', 'WR', 'TE'].includes(pos)) {
      flexEligible.push(pick);
    }
  });
  
  const getRosterStatus = () => {
    const statuses = [];
    
    for (const slot of leagueSettings.rosterPositions) {
      if (slot.position === 'BE') continue;
      
      const current = positionCounts.get(slot.position) || 0;
      
      if (slot.position === 'FLEX') {
        const rbCount = positionCounts.get('RB') || 0;
        const wrCount = positionCounts.get('WR') || 0;
        const teCount = positionCounts.get('TE') || 0;
        
        const rbNeeded = leagueSettings.rosterPositions
          .find(s => s.position === 'RB')?.required || 0;
        const wrNeeded = leagueSettings.rosterPositions
          .find(s => s.position === 'WR')?.required || 0;
        const teNeeded = leagueSettings.rosterPositions
          .find(s => s.position === 'TE')?.required || 0;
        
        const flexAvailable = 
          Math.max(0, rbCount - rbNeeded) +
          Math.max(0, wrCount - wrNeeded) +
          Math.max(0, teCount - teNeeded);
        
        if (flexAvailable < slot.required) {
          statuses.push({ position: 'FLEX', needed: slot.required - flexAvailable });
        }
      } else {
        if (current < slot.required) {
          statuses.push({ position: slot.position, needed: slot.required - current });
        }
      }
    }
    
    return statuses;
  };
  
  const rosterNeeds = getRosterStatus();
  const remainingBudget = team.budget - team.spent;
  const remainingSlots = 16 - team.roster.length;
  const avgPerSlot = remainingSlots > 0 ? remainingBudget / remainingSlots : 0;
  
  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Users className="text-primary" />
          {team.name}
        </h2>
        <div className="text-right">
          <div className="text-sm text-gray-400">Remaining</div>
          <div className="text-2xl font-bold text-primary">${remainingBudget}</div>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
        <div className="bg-gray-800 rounded p-2">
          <div className="text-gray-400 text-xs">Max Bid</div>
          <div className="font-semibold">${team.maxBid}</div>
        </div>
        <div className="bg-gray-800 rounded p-2">
          <div className="text-gray-400 text-xs">Avg/Slot</div>
          <div className="font-semibold">${avgPerSlot.toFixed(1)}</div>
        </div>
      </div>
      
      {rosterNeeds.length > 0 && (
        <div className="mb-4 p-3 bg-yellow-900/20 border border-yellow-700 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="text-yellow-500 w-4 h-4" />
            <span className="text-sm font-medium text-yellow-400">Roster Needs</span>
          </div>
          <div className="space-y-1">
            {rosterNeeds.map(need => (
              <div key={need.position} className="text-xs text-yellow-300">
                {need.position}: {need.needed} more needed
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div className="space-y-2">
        {['QB', 'RB', 'WR', 'TE', 'FLEX', 'DST', 'K', 'BE'].map(pos => {
          const picks = team.roster.filter(p => {
            if (pos === 'FLEX') {
              return ['RB', 'WR', 'TE'].includes(p.player.position);
            }
            if (pos === 'BE') {
              return true;
            }
            return p.player.position === pos;
          });
          
          const required = leagueSettings.rosterPositions
            .find(s => s.position === pos)?.required || 0;
          
          return (
            <div key={pos}>
              <div className="text-xs font-semibold text-gray-400 mb-1">
                {pos} ({picks.length}/{required})
              </div>
              {picks.length > 0 ? (
                <div className="space-y-1">
                  {picks.map((pick, idx) => (
                    <div 
                      key={`${pick.player.id}_${idx}`}
                      className="flex items-center justify-between text-sm bg-gray-800 rounded px-2 py-1"
                    >
                      <span>{pick.player.name}</span>
                      <span className="text-primary">${pick.price}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-gray-600 italic">Empty</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}