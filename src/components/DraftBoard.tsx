import { useState } from 'react';
import { useDraftStore } from '@/store/draftStore';
import { Gavel, TrendingUp, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function DraftBoard() {
  const { 
    currentNomination, 
    currentBid, 
    currentBidder,
    myTeamId,
    teams,
    nominatePlayer,
    placeBid,
    completeAuction,
    availablePlayers
  } = useDraftStore();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [bidAmount, setBidAmount] = useState(1);
  
  const myTeam = teams.find(t => t.id === myTeamId);
  const currentTeam = teams.find(t => t.id === currentBidder);
  
  const filteredPlayers = availablePlayers
    .filter(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.team.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .slice(0, 5);
  
  const handleNominate = (player: any) => {
    nominatePlayer(player);
    setSearchQuery('');
    setBidAmount(player.marketPrice || 1);
  };
  
  const handleBid = () => {
    if (!currentNomination) {
      toast.error('No player nominated');
      return;
    }
    
    if (bidAmount <= currentBid) {
      toast.error('Bid must be higher than current bid');
      return;
    }
    
    if (myTeam && myTeam.budget - myTeam.spent < bidAmount) {
      toast.error('Insufficient budget');
      return;
    }
    
    placeBid(bidAmount, myTeamId);
    setBidAmount(bidAmount + 1);
    toast.success(`Bid placed: $${bidAmount}`);
  };
  
  const handleComplete = () => {
    if (!currentNomination || !currentBidder) {
      toast.error('No active auction');
      return;
    }
    
    completeAuction(currentNomination, currentBid, currentBidder);
    toast.success(`${currentNomination.name} sold for $${currentBid}`);
    setBidAmount(1);
  };
  
  return (
    <div className="card p-6">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <Gavel className="text-primary" />
        Auction Board
      </h2>
      
      {!currentNomination ? (
        <div>
          <label className="block text-sm font-medium mb-2">
            Search and Nominate Player
          </label>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search player name or team..."
            className="input w-full mb-3"
          />
          
          {searchQuery && filteredPlayers.length > 0 && (
            <div className="space-y-2">
              {filteredPlayers.map(player => (
                <div
                  key={player.id}
                  className="flex items-center justify-between p-3 bg-gray-800 rounded-lg hover:bg-gray-700 cursor-pointer transition-colors"
                  onClick={() => handleNominate(player)}
                >
                  <div>
                    <span className="font-medium">{player.name}</span>
                    <span className="ml-2 text-sm text-gray-400">
                      {player.position} - {player.team}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-primary font-semibold">
                      ${player.marketPrice}
                    </div>
                    <div className={`text-xs ${
                      player.edge > 0 ? 'text-green-500' : 'text-red-500'
                    }`}>
                      Edge: ${player.edge.toFixed(0)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-lg font-semibold">
                  {currentNomination.name}
                </h3>
                <p className="text-sm text-gray-400">
                  {currentNomination.position} - {currentNomination.team}
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-primary">
                  ${currentBid}
                </div>
                {currentTeam && (
                  <p className="text-sm text-gray-400">
                    {currentTeam.name}
                  </p>
                )}
              </div>
            </div>
            
            {currentNomination && (
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="bg-gray-900 rounded p-2">
                  <div className="text-gray-400 text-xs">Market Price</div>
                  <div className="font-semibold">
                    ${(currentNomination as any).marketPrice || 0}
                  </div>
                </div>
                <div className="bg-gray-900 rounded p-2">
                  <div className="text-gray-400 text-xs">Value</div>
                  <div className="font-semibold">
                    ${(currentNomination as any).intrinsicValue || 0}
                  </div>
                </div>
                <div className="bg-gray-900 rounded p-2">
                  <div className="text-gray-400 text-xs">Recommendation</div>
                  <div className={`font-semibold text-xs ${
                    (currentNomination as any).recommendation === 'STRONG_BUY' ? 'text-green-500' :
                    (currentNomination as any).recommendation === 'BUY' ? 'text-green-400' :
                    (currentNomination as any).recommendation === 'FAIR' ? 'text-yellow-400' :
                    'text-red-400'
                  }`}>
                    {(currentNomination as any).recommendation || 'FAIR'}
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">
                Your Bid
              </label>
              <input
                type="number"
                value={bidAmount}
                onChange={(e) => setBidAmount(Number(e.target.value))}
                className="input w-full"
                min={currentBid + 1}
                max={myTeam?.budget ? myTeam.budget - myTeam.spent : 200}
              />
            </div>
            <button
              onClick={handleBid}
              className="btn-primary mt-6"
              disabled={currentBidder === myTeamId}
            >
              Place Bid
            </button>
            <button
              onClick={handleComplete}
              className="btn-secondary mt-6"
            >
              Complete
            </button>
          </div>
          
          {currentBidder === myTeamId && (
            <div className="flex items-center gap-2 p-3 bg-green-900/20 border border-green-700 rounded-lg">
              <TrendingUp className="text-green-500 w-5 h-5" />
              <span className="text-green-400">You have the current high bid!</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}