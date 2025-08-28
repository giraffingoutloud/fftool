import { useState } from 'react';
import { useDraftStore } from '@/store/draftStore';
import { Users, DollarSign, Trophy, Settings } from 'lucide-react';

export default function DraftSetup() {
  const { initializeDraft } = useDraftStore();
  
  const [teams, setTeams] = useState(12);
  const [budget, setBudget] = useState(200);
  const [scoring, setScoring] = useState<'PPR' | 'HALF_PPR' | 'STANDARD'>('PPR');
  
  const handleStartDraft = () => {
    initializeDraft({
      teams,
      budget,
      scoring,
      rosterPositions: [
        { position: 'QB', player: undefined, required: 1 },
        { position: 'RB', player: undefined, required: 2 },
        { position: 'WR', player: undefined, required: 2 },
        { position: 'TE', player: undefined, required: 1 },
        { position: 'FLEX', player: undefined, required: 1 },
        { position: 'DST', player: undefined, required: 1 },
        { position: 'K', player: undefined, required: 1 },
        { position: 'BE', player: undefined, required: 7 }
      ]
    });
  };
  
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="card p-8 max-w-2xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary mb-2">
            Fantasy Football Auction Draft Assistant
          </h1>
          <p className="text-gray-400">
            Configure your ESPN 12-team PPR auction draft settings
          </p>
        </div>
        
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Users className="text-primary w-6 h-6" />
            <div className="flex-1">
              <label className="block text-sm font-medium mb-2">
                Number of Teams
              </label>
              <select 
                value={teams} 
                onChange={(e) => setTeams(Number(e.target.value))}
                className="input w-full"
              >
                {[8, 10, 12, 14, 16].map(n => (
                  <option key={n} value={n}>{n} Teams</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <DollarSign className="text-primary w-6 h-6" />
            <div className="flex-1">
              <label className="block text-sm font-medium mb-2">
                Auction Budget
              </label>
              <input 
                type="number"
                value={budget}
                onChange={(e) => setBudget(Number(e.target.value))}
                className="input w-full"
                min="100"
                max="1000"
                step="50"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <Trophy className="text-primary w-6 h-6" />
            <div className="flex-1">
              <label className="block text-sm font-medium mb-2">
                Scoring System
              </label>
              <select 
                value={scoring}
                onChange={(e) => setScoring(e.target.value as any)}
                className="input w-full"
              >
                <option value="PPR">Full PPR (1.0 per reception)</option>
                <option value="HALF_PPR">Half PPR (0.5 per reception)</option>
                <option value="STANDARD">Standard (no PPR)</option>
              </select>
            </div>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Settings className="text-gray-400 w-5 h-5" />
              <h3 className="font-semibold">Roster Settings (ESPN Standard)</h3>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm text-gray-400">
              <div>1 QB</div>
              <div>2 RB</div>
              <div>2 WR</div>
              <div>1 TE</div>
              <div>1 FLEX (RB/WR/TE)</div>
              <div>1 DST</div>
              <div>1 K</div>
              <div>7 Bench</div>
            </div>
          </div>
          
          <button 
            onClick={handleStartDraft}
            className="btn-primary w-full py-3 text-lg"
          >
            Start Draft Assistant
          </button>
        </div>
      </div>
    </div>
  );
}