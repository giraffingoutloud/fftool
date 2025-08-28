import React, { useState } from 'react';
import { Users, Edit2, Check, X } from 'lucide-react';
import { useDraftStore } from '@/store/draftStore';

const OtherTeamsRosters: React.FC = () => {
  const { teams, myTeamId, updateTeamName } = useDraftStore();
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  
  // Get all teams except My Team
  const otherTeams = teams.filter(team => team.id !== myTeamId);
  
  // Position colors
  const getPositionColor = (position: string) => {
    const colors: Record<string, string> = {
      QB: 'text-red-400',
      RB: 'text-green-400',
      WR: 'text-blue-400',
      TE: 'text-orange-400',
      DST: 'text-purple-400',
      K: 'text-yellow-400'
    };
    return colors[position] || 'text-gray-400';
  };
  
  const handleStartEdit = (teamId: string, currentName: string) => {
    setEditingTeamId(teamId);
    setEditingName(currentName);
  };
  
  const handleSaveEdit = () => {
    if (editingTeamId && editingName.trim()) {
      updateTeamName(editingTeamId, editingName.trim());
    }
    setEditingTeamId(null);
    setEditingName('');
  };
  
  const handleCancelEdit = () => {
    setEditingTeamId(null);
    setEditingName('');
  };
  
  return (
    <div className="space-y-4">
      <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-400" />
          Other Teams
        </h2>
        
        <div className="space-y-3 max-h-[calc(100vh-150px)] overflow-y-auto">
          {otherTeams.map(team => (
            <div key={team.id} className="bg-gray-800 rounded-lg p-3">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  {editingTeamId === team.id ? (
                    <>
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEdit();
                          if (e.key === 'Escape') handleCancelEdit();
                        }}
                        className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                        autoFocus
                      />
                      <button
                        onClick={handleSaveEdit}
                        className="text-green-400 hover:text-green-300"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="text-red-400 hover:text-red-300"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <h3 className="font-semibold text-white">{team.name}</h3>
                      <button
                        onClick={() => handleStartEdit(team.id, team.name)}
                        className="text-gray-400 hover:text-white"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                    </>
                  )}
                </div>
                <div className="text-sm">
                  <span className="text-gray-400">Spent: </span>
                  <span className="text-green-400 font-semibold">${team.spent}</span>
                  <span className="text-gray-400"> / ${team.budget}</span>
                </div>
              </div>
              
              {team.roster.length === 0 ? (
                <p className="text-gray-500 text-sm italic">No players drafted</p>
              ) : (
                <div className="space-y-1">
                  {team.roster.map((pick, idx) => (
                    <div key={idx} className="flex justify-between items-center text-sm">
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${getPositionColor(pick.player.position)}`}>
                          {pick.player.position}
                        </span>
                        <span className="text-gray-300 truncate max-w-[150px]">
                          {pick.player.name}
                        </span>
                      </div>
                      <span className="text-gray-400">${pick.price || 0}</span>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="mt-2 pt-2 border-t border-gray-700 flex justify-between text-xs">
                <span className="text-gray-400">
                  Players: {team.roster.length}/16
                </span>
                <span className="text-gray-400">
                  Remaining: ${team.budget - team.spent}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default OtherTeamsRosters;