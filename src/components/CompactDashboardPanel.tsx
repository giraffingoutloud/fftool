import React from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  Trophy, 
  Users, 
  Target,
  AlertTriangle,
  BarChart3,
  Zap,
  Star,
  Flame
} from 'lucide-react';
import type { ValuationSummary, ValuationResult } from '@/lib/calibratedValuationService';
import { useDraftStore } from '@/store/draftStore';

interface CompactDashboardPanelProps {
  summary: ValuationSummary;
  valuations: ValuationResult[];
  isDraftActive: boolean;
  onStartDraft?: () => void;
}

const CompactDashboardPanel: React.FC<CompactDashboardPanelProps> = ({
  summary,
  valuations,
  isDraftActive,
  onStartDraft
}) => {
  const { draftHistory } = useDraftStore();
  
  // Filter out drafted players
  const draftedIds = new Set(draftHistory.map(pick => pick.player?.id));
  const availableValuations = valuations.filter(p => !draftedIds.has(p.playerId));
  
  // Get best values (highest edge)
  const bestValues = [...availableValuations]
    .sort((a, b) => (b.edge || 0) - (a.edge || 0))
    .slice(0, 4);

  // Get best available RBs by rank
  const bestRBs = availableValuations
    .filter(p => p.position === 'RB')
    .sort((a, b) => (a.rank || 999) - (b.rank || 999))
    .slice(0, 4);

  // Get best available WRs by rank
  const bestWRs = availableValuations
    .filter(p => p.position === 'WR')
    .sort((a, b) => (a.rank || 999) - (b.rank || 999))
    .slice(0, 4);

  // Get breakout candidates (high upside: good points but lower ADP)
  const breakouts = availableValuations
    .filter(p => p.adp && p.adp > 50 && p.points && p.points > 200)
    .sort((a, b) => (b.points || 0) - (a.points || 0))
    .slice(0, 4);

  // Get value QBs (late round QBs with good points)
  const valueQBs = availableValuations
    .filter(p => p.position === 'QB' && p.adp && p.adp > 80)
    .sort((a, b) => (b.points || 0) - (a.points || 0))
    .slice(0, 4);

  // Get best Proj-ADP (high points + high ADP = late round steals)
  const bestProjADP = availableValuations
    .filter(p => p.points && p.points > 150 && p.adp && p.adp > 60)
    .sort((a, b) => {
      // Sort by points-to-ADP ratio (higher is better)
      const ratioA = (a.points || 0) / (a.adp || 1);
      const ratioB = (b.points || 0) / (b.adp || 1);
      return ratioB - ratioA;
    })
    .slice(0, 4);

  const PlayerCard = ({ player, showStat, statLabel, showPosition = false }: { 
    player: ValuationResult, 
    showStat: 'edge' | 'value' | 'points' | 'adp',
    statLabel?: string,
    showPosition?: boolean 
  }) => {
    const statValue = showStat === 'edge' ? player.edge :
                      showStat === 'value' ? player.value :
                      showStat === 'points' ? player.points :
                      player.adp;
    
    const formatStat = () => {
      if (showStat === 'edge' || showStat === 'value') return `$${statValue}`;
      if (showStat === 'adp') return `ADP: ${Math.round(statValue || 0)}`;
      return `${Math.round(statValue || 0)} pts`;
    };

    return (
      <div className="flex justify-between items-center text-xs py-0.5">
        <span className="text-gray-300 truncate flex-1 mr-1">
          {player.name}
          {showPosition && (
            <span className="text-gray-500 ml-1">
              {player.position}
            </span>
          )}
        </span>
        <span className="text-gray-400 text-right whitespace-nowrap">
          {formatStat()}
        </span>
      </div>
    );
  };

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

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 mb-4">
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        
        {/* Best Values */}
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2" title="Players with highest edge (Our Value - Market Price). These are undervalued by the market.">
            <TrendingUp className="w-4 h-4 text-green-400" />
            <span className="text-xs font-semibold text-green-400">LARGEST EDGE</span>
          </div>
          <div className="space-y-0.5">
            {bestValues.map((player, idx) => (
              <PlayerCard key={idx} player={player} showStat="value" showPosition={true} />
            ))}
          </div>
        </div>

        {/* Elite RBs */}
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2" title="Best available running backs sorted by overall rank.">
            <Trophy className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-semibold text-purple-400">BEST RBs</span>
          </div>
          <div className="space-y-0.5">
            {bestRBs.map((player, idx) => (
              <PlayerCard key={idx} player={player} showStat="value" />
            ))}
          </div>
        </div>

        {/* Elite WRs */}
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2" title="Best available wide receivers sorted by overall rank.">
            <Star className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-semibold text-blue-400">BEST WRs</span>
          </div>
          <div className="space-y-0.5">
            {bestWRs.map((player, idx) => (
              <PlayerCard key={idx} player={player} showStat="value" />
            ))}
          </div>
        </div>

        {/* Breakout Candidates */}
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2" title="High-scoring players (200+ pts) with lower ADPs (50+). Potential league-winners being overlooked by the market.">
            <Flame className="w-4 h-4 text-orange-400" />
            <span className="text-xs font-semibold text-orange-400">BREAKOUTS</span>
          </div>
          <div className="space-y-0.5">
            {breakouts.map((player, idx) => (
              <PlayerCard key={idx} player={player} showStat="value" showPosition={true} />
            ))}
          </div>
        </div>

        {/* Value QBs */}
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2" title="Late-round QBs (ADP 80+) with strong projected points. Perfect for late-round QB strategy.">
            <DollarSign className="w-4 h-4 text-red-400" />
            <span className="text-xs font-semibold text-red-400">VALUE QBs</span>
          </div>
          <div className="space-y-0.5">
            {valueQBs.map((player, idx) => (
              <PlayerCard key={idx} player={player} showStat="value" />
            ))}
          </div>
        </div>

        {/* Best Proj-ADP */}
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2" title="Players with high projected points (150+) and high ADP (60+). Late round values with strong upside.">
            <Zap className="w-4 h-4 text-yellow-400" />
            <span className="text-xs font-semibold text-yellow-400">BEST VALUE</span>
          </div>
          <div className="space-y-0.5">
            {bestProjADP.map((player, idx) => (
              <PlayerCard key={idx} player={player} showStat="value" showPosition={true} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompactDashboardPanel;