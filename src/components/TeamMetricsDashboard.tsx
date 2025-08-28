import React from 'react';
import { TeamMetrics, TeamComposite } from '@/types';
import { TrendingUp, TrendingDown, Minus, Zap, Target, Shield, Clock } from 'lucide-react';

interface TeamMetricsDashboardProps {
  teamMetrics: Map<string, TeamMetrics>;
  teamComposites: Map<string, TeamComposite>;
}

const TeamMetricsDashboard: React.FC<TeamMetricsDashboardProps> = ({
  teamMetrics,
  teamComposites
}) => {
  // Sort teams by offense quality
  const sortedTeams = Array.from(teamComposites.entries())
    .sort((a, b) => b[1].offenseQualityIndex - a[1].offenseQualityIndex);

  const getIndexColor = (value: number) => {
    if (value > 0.5) return 'text-green-400';
    if (value > 0) return 'text-yellow-400';
    if (value > -0.5) return 'text-orange-400';
    return 'text-red-400';
  };

  const getIndexIcon = (value: number) => {
    if (value > 0.1) return <TrendingUp className="w-4 h-4" />;
    if (value < -0.1) return <TrendingDown className="w-4 h-4" />;
    return <Minus className="w-4 h-4" />;
  };

  const formatPercent = (value?: number) => {
    if (value === undefined || value === null) return 'N/A';
    return `${(value * 100).toFixed(1)}%`;
  };

  return (
    <div className="bg-gray-900 rounded-lg p-6">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <Shield className="w-5 h-5 text-primary" />
        Team Metrics Dashboard
      </h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
        {sortedTeams.map(([team, composite]) => {
          const metrics = teamMetrics.get(team);
          if (!metrics) return null;
          
          return (
            <div key={team} className="bg-gray-800 rounded-lg p-4 hover:bg-gray-750 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-lg">{team}</h3>
                <div className={`flex items-center gap-1 ${getIndexColor(composite.offenseQualityIndex)}`}>
                  {getIndexIcon(composite.offenseQualityIndex)}
                  <span className="text-sm font-medium">
                    {composite.offenseQualityIndex.toFixed(2)}
                  </span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-sm">
                {/* Offense Quality */}
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 flex items-center gap-1">
                    <Target className="w-3 h-3" />
                    PPG
                  </span>
                  <span className="text-white font-medium">
                    {metrics.pointsPerGame?.toFixed(1) || 'N/A'}
                  </span>
                </div>
                
                {/* Pace */}
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 flex items-center gap-1">
                    <Zap className="w-3 h-3" />
                    Pace
                  </span>
                  <span className={getIndexColor(composite.paceIndex)}>
                    {composite.paceIndex > 0 ? 'Fast' : 'Slow'}
                  </span>
                </div>
                
                {/* Red Zone */}
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">RZ TD%</span>
                  <span className="text-white">
                    {formatPercent(metrics.redZoneTDScoringPct)}
                  </span>
                </div>
                
                {/* Yards per play */}
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Y/P</span>
                  <span className="text-white">
                    {metrics.yardsPerPlay?.toFixed(1) || 'N/A'}
                  </span>
                </div>
                
                {/* Third down */}
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">3rd%</span>
                  <span className="text-white">
                    {formatPercent(metrics.thirdDownConvPct)}
                  </span>
                </div>
                
                {/* Time of Possession */}
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">TOP</span>
                  <span className="text-white">
                    {formatPercent(metrics.timeOfPossessionPct)}
                  </span>
                </div>
              </div>
              
              {/* Trend indicator */}
              {composite.trendIndex !== 0 && (
                <div className="mt-3 pt-3 border-t border-gray-700">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">Recent Trend</span>
                    <div className={`flex items-center gap-1 ${
                      composite.trendIndex > 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {composite.trendIndex > 0 ? (
                        <TrendingUp className="w-3 h-3" />
                      ) : (
                        <TrendingDown className="w-3 h-3" />
                      )}
                      <span className="text-xs">
                        {composite.trendIndex > 0 ? 'Improving' : 'Declining'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Composite Indices */}
              <div className="mt-3 pt-3 border-t border-gray-700 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Red Zone</span>
                  <span className={getIndexColor(composite.redZoneIndex)}>
                    {composite.redZoneIndex.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Sustain</span>
                  <span className={getIndexColor(composite.sustainIndex)}>
                    {composite.sustainIndex.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Environment</span>
                  <span className={getIndexColor(composite.environmentIndex)}>
                    {composite.environmentIndex.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Legend */}
      <div className="mt-4 pt-4 border-t border-gray-800">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-4">
            <span className="text-gray-500">Index Scale:</span>
            <span className="text-green-400">Elite (&gt;0.5)</span>
            <span className="text-yellow-400">Above Avg (0 to 0.5)</span>
            <span className="text-orange-400">Below Avg (-0.5 to 0)</span>
            <span className="text-red-400">Poor (&lt;-0.5)</span>
          </div>
          <div className="text-gray-500">
            Higher indices = Better fantasy environment
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeamMetricsDashboard;