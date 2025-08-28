import React, { useState } from 'react';
import { X, TrendingUp, Award, BarChart3, DollarSign, Users } from 'lucide-react';
import { useDraftStore } from '@/store/draftStore';
import type { ValuationResult } from '@/lib/calibratedValuationService';

interface PlayerProfileModalProps {
  player: ValuationResult;
  isOpen: boolean;
  onClose: () => void;
}

const PlayerProfileModal: React.FC<PlayerProfileModalProps> = ({ player, isOpen, onClose }) => {
  const { completeAuction, teams, myTeamId } = useDraftStore();
  const [selectedTeam, setSelectedTeam] = useState<string>('My Team');
  const [purchasePrice, setPurchasePrice] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'stats' | 'projections' | 'analysis'>('stats');

  if (!isOpen) return null;

  const handleDraft = () => {
    const price = parseInt(purchasePrice) || 0;
    if (price <= 0) {
      alert('Please enter a valid purchase price');
      return;
    }

    // Map team selection to team ID
    // Team 2 -> team_1, Team 3 -> team_2, etc.
    const teamId = selectedTeam === 'My Team' ? myTeamId : `team_${parseInt(selectedTeam.replace('Team ', '')) - 1}`;
    
    const playerData = {
      id: player.playerId,
      name: player.playerName,
      position: player.position,
      team: player.team,
      projectedPoints: player.projectedPoints,
      value: player.auctionValue,
      tier: player.tier || 'replacement'
    };

    completeAuction(playerData, price, teamId);
    onClose();
  };

  // Position color classes
  const getPositionColor = () => {
    const colors: Record<string, string> = {
      QB: 'from-red-500 to-red-700',
      RB: 'from-green-500 to-green-700',
      WR: 'from-blue-500 to-blue-700',
      TE: 'from-orange-500 to-orange-700',
      DST: 'from-purple-500 to-purple-700',
      K: 'from-yellow-500 to-yellow-700'
    };
    return colors[player.position] || 'from-gray-500 to-gray-700';
  };

  const getTierLabel = (tier?: string) => {
    const labels: Record<string, string> = {
      'elite': 'S+',
      'tier1': 'S',
      'tier2': 'A',
      'tier3': 'B',
      'replacement': 'C'
    };
    return labels[tier || 'replacement'] || 'C';
  };

  const getTierColor = (tier?: string) => {
    switch(tier) {
      case 'elite': return 'text-purple-400';
      case 'tier1': return 'text-blue-400';
      case 'tier2': return 'text-green-400';
      case 'tier3': return 'text-yellow-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className={`bg-gradient-to-r ${getPositionColor()} p-6 relative`}>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white hover:text-gray-200 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-3xl font-bold text-white mb-2">{player.playerName}</h2>
              <div className="flex items-center gap-4 text-white/90">
                <span className="font-semibold">{player.position}</span>
                <span>{player.team}</span>
                <span className={`px-2 py-1 rounded ${getTierColor(player.tier)} font-bold`}>
                  Tier {getTierLabel(player.tier)}
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-white">
                ${player.auctionValue}
              </div>
              <div className="text-sm text-white/80">Recommended Value</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700">
          <button
            onClick={() => setActiveTab('stats')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'stats' 
                ? 'text-blue-400 border-b-2 border-blue-400' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Stats & Metrics
          </button>
          <button
            onClick={() => setActiveTab('projections')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'projections' 
                ? 'text-blue-400 border-b-2 border-blue-400' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Projections
          </button>
          <button
            onClick={() => setActiveTab('analysis')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'analysis' 
                ? 'text-blue-400 border-b-2 border-blue-400' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Analysis
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 300px)' }}>
          {activeTab === 'stats' && (
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <div className="text-gray-400 text-sm mb-1">Projected Points</div>
                  <div className="text-2xl font-bold text-white">
                    {player.projectedPoints.toFixed(1)}
                  </div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm mb-1">VORP</div>
                  <div className="text-xl font-semibold text-green-400">
                    {player.vorp.toFixed(1)}
                  </div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm mb-1">Overall Rank</div>
                  <div className="text-xl font-semibold text-white">
                    #{player.rank}
                  </div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm mb-1">Position Rank</div>
                  <div className="text-xl font-semibold text-white">
                    {player.position}{player.positionRank}
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <div className="text-gray-400 text-sm mb-1">ADP</div>
                  <div className="text-xl font-semibold text-white">
                    {player.adp ? player.adp.toFixed(1) : 'N/A'}
                  </div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm mb-1">Market Value</div>
                  <div className="text-xl font-semibold text-yellow-400">
                    ${player.marketValue}
                  </div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm mb-1">Edge vs Market</div>
                  <div className={`text-xl font-semibold ${player.edge >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {player.edge > 0 ? '+' : ''}${player.edge.toFixed(0)}
                  </div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm mb-1">Bye Week</div>
                  <div className="text-xl font-semibold text-white">
                    {player.byeWeek || 'N/A'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'projections' && (
            <div className="space-y-4">
              {player.position === 'QB' && (
                <>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <div className="text-gray-400 text-sm mb-1">Pass Yards</div>
                      <div className="text-lg font-semibold text-white">
                        {player.passYds || 0}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-400 text-sm mb-1">Pass TDs</div>
                      <div className="text-lg font-semibold text-white">
                        {player.passTd || 0}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-400 text-sm mb-1">INTs</div>
                      <div className="text-lg font-semibold text-white">
                        {player.passInt || 0}
                      </div>
                    </div>
                  </div>
                </>
              )}
              
              {(player.position === 'RB' || player.position === 'WR' || player.position === 'TE') && (
                <>
                  {(player.position === 'RB') && (
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <div className="text-gray-400 text-sm mb-1">Rush Yards</div>
                        <div className="text-lg font-semibold text-white">
                          {player.rushYds || 0}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-400 text-sm mb-1">Rush TDs</div>
                        <div className="text-lg font-semibold text-white">
                          {player.rushTd || 0}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-400 text-sm mb-1">Rush Att</div>
                        <div className="text-lg font-semibold text-white">
                          {player.rushAtt || 0}
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-4 mt-4">
                    <div>
                      <div className="text-gray-400 text-sm mb-1">Receptions</div>
                      <div className="text-lg font-semibold text-white">
                        {player.recvReceptions || 0}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-400 text-sm mb-1">Rec Yards</div>
                      <div className="text-lg font-semibold text-white">
                        {player.recvYds || 0}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-400 text-sm mb-1">Rec TDs</div>
                      <div className="text-lg font-semibold text-white">
                        {player.recvTd || 0}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'analysis' && (
            <div className="space-y-4">
              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-400" />
                  Value Analysis
                </h3>
                <p className="text-gray-300 text-sm">
                  {player.edge >= 10 
                    ? `Excellent value! Projected ${player.edge} points above market price.`
                    : player.edge >= 0
                    ? `Fair value with slight edge of ${player.edge} points.`
                    : `Potentially overvalued by ${Math.abs(player.edge)} points.`}
                </p>
              </div>
              
              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
                  <Award className="w-4 h-4 text-yellow-400" />
                  Tier Analysis
                </h3>
                <p className="text-gray-300 text-sm">
                  {player.tier === 'elite' 
                    ? 'Elite tier player - a potential league winner.'
                    : player.tier === 'tier1'
                    ? 'Top tier starter with consistent production.'
                    : player.tier === 'tier2'
                    ? 'Solid starter with good upside.'
                    : player.tier === 'tier3'
                    ? 'Flex option or depth player.'
                    : 'Replacement level - consider for late rounds only.'}
                </p>
              </div>
              
              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-green-400" />
                  SOS Analysis
                </h3>
                <p className="text-gray-300 text-sm">
                  Strength of Schedule: {player.teamSeasonSOS ? player.teamSeasonSOS.toFixed(1) : 'N/A'}
                  {player.teamSeasonSOS && player.teamSeasonSOS < 5 
                    ? ' - Easy schedule could boost production.'
                    : player.teamSeasonSOS && player.teamSeasonSOS > 5
                    ? ' - Difficult schedule may limit upside.'
                    : ' - Average difficulty schedule.'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Draft Controls */}
        <div className="border-t border-gray-700 p-6 bg-gray-800/50">
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Select Team
              </label>
              <select
                value={selectedTeam}
                onChange={(e) => setSelectedTeam(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-400"
              >
                <option>My Team</option>
                <option>Team 2</option>
                <option>Team 3</option>
                <option>Team 4</option>
                <option>Team 5</option>
                <option>Team 6</option>
                <option>Team 7</option>
                <option>Team 8</option>
                <option>Team 9</option>
                <option>Team 10</option>
                <option>Team 11</option>
                <option>Team 12</option>
              </select>
            </div>
            
            <div className="w-32">
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Price ($)
              </label>
              <input
                type="number"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                placeholder="0"
                min="0"
                max="200"
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-400"
              />
            </div>
            
            <button
              onClick={handleDraft}
              disabled={!purchasePrice || parseInt(purchasePrice) <= 0}
              className="px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-600 disabled:to-gray-700 text-white rounded-lg font-semibold transition-colors"
            >
              Draft Player
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerProfileModal;