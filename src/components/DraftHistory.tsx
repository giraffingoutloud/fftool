import { useDraftStore } from '@/store/draftStore';
import { Clock, Undo2 } from 'lucide-react';

export default function DraftHistory() {
  const { draftHistory, teams, undoLastPick } = useDraftStore();
  
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };
  
  const getTeamName = (teamId: string) => {
    return teams.find(t => t.id === teamId)?.name || 'Unknown';
  };
  
  const recentPicks = [...draftHistory].reverse();
  
  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Clock className="text-primary" />
          Draft History
        </h2>
        {draftHistory.length > 0 && (
          <button
            onClick={undoLastPick}
            className="flex items-center gap-1 text-sm text-gray-400 hover:text-primary transition-colors"
          >
            <Undo2 className="w-4 h-4" />
            Undo
          </button>
        )}
      </div>
      
      {recentPicks.length === 0 ? (
        <p className="text-gray-500 text-sm italic">No picks yet</p>
      ) : (
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {recentPicks.map((pick, idx) => (
            <div 
              key={`${pick.player.id}_${pick.timestamp}`}
              className={`flex items-center justify-between p-2 rounded-lg bg-gray-800 
                ${idx === 0 ? 'ring-1 ring-primary' : ''}`}
            >
              <div className="flex-1">
                <div className="font-medium text-sm">
                  {pick.player.name}
                  <span className="ml-2 text-xs text-gray-400">
                    {pick.player.position} - {pick.player.team}
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  {getTeamName(pick.team)} • {formatTime(pick.timestamp)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-primary">
                  ${pick.price}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {draftHistory.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-800">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-gray-400">Total Picks</div>
              <div className="font-semibold">{draftHistory.length}</div>
            </div>
            <div>
              <div className="text-gray-400">Total Spent</div>
              <div className="font-semibold text-primary">
                ${draftHistory.reduce((sum, p) => sum + p.price, 0)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}