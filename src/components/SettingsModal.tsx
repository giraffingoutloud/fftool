import React, { useState, useEffect } from 'react';
import { 
  X, Settings, Save, RotateCcw, Download, Upload, 
  Users, Trophy, DollarSign, Target, Layers, Calculator,
  AlertCircle, Check
} from 'lucide-react';
import { configurationService, type ConfigurationData } from '@/lib/configurationService';
import { toast } from 'react-hot-toast';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (config: ConfigurationData) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onApply }) => {
  const [activeTab, setActiveTab] = useState('league');
  const [config, setConfig] = useState<ConfigurationData | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadConfiguration();
    }
  }, [isOpen]);

  const loadConfiguration = async () => {
    const loadedConfig = await configurationService.loadConfiguration();
    setConfig(loadedConfig);
    setIsDirty(false);
  };

  const handleValueChange = (path: string[], value: any) => {
    if (!config) return;
    
    const newConfig = { ...config };
    let current: any = newConfig;
    
    for (let i = 0; i < path.length - 1; i++) {
      current = current[path[i]];
    }
    
    current[path[path.length - 1]] = value;
    setConfig(newConfig);
    setIsDirty(true);
  };

  const handleApply = async () => {
    if (!config) return;
    
    setIsSaving(true);
    try {
      // Update the configuration service
      configurationService.updateConfiguration(config);
      
      // Call the onApply callback to trigger recalculation
      await onApply(config);
      
      toast.success('Settings applied successfully! Values recalculated.');
      setIsDirty(false);
    } catch (error) {
      toast.error('Failed to apply settings');
      console.error('Error applying settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    loadConfiguration();
    toast.success('Settings reset to saved values');
  };

  const handleExport = () => {
    const json = configurationService.exportConfiguration();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fftool_settings.json';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Settings exported successfully');
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = configurationService.importConfiguration(e.target?.result as string);
        setConfig(imported);
        setIsDirty(true);
        toast.success('Settings imported successfully');
      } catch (error) {
        toast.error('Failed to import settings');
      }
    };
    reader.readAsText(file);
  };

  if (!isOpen || !config) return null;

  const tabs = [
    { id: 'league', label: 'League Settings', icon: Users },
    { id: 'scoring', label: 'Scoring', icon: Trophy },
    { id: 'replacement', label: 'VORP Levels', icon: Target },
    { id: 'market', label: 'Market Adjustments', icon: DollarSign },
    { id: 'tiers', label: 'Tier Values', icon: Layers },
    { id: 'projections', label: 'Projections', icon: Calculator },
    { id: 'bidding', label: 'Bid Ranges', icon: Target },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'league':
        return (
          <div className="space-y-6">
            {/* League Structure */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">League Structure</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Number of Teams</label>
                  <input
                    type="number"
                    value={config.leagueSettings.numTeams}
                    onChange={(e) => handleValueChange(['leagueSettings', 'numTeams'], parseInt(e.target.value))}
                    min="8"
                    max="16"
                    className="w-full bg-gray-800 text-white px-3 py-2 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Auction Budget</label>
                  <input
                    type="number"
                    value={config.leagueSettings.auctionBudget}
                    onChange={(e) => handleValueChange(['leagueSettings', 'auctionBudget'], parseInt(e.target.value))}
                    min="100"
                    max="500"
                    className="w-full bg-gray-800 text-white px-3 py-2 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Roster Size</label>
                  <input
                    type="number"
                    value={config.leagueSettings.rosterSize}
                    onChange={(e) => handleValueChange(['leagueSettings', 'rosterSize'], parseInt(e.target.value))}
                    min="12"
                    max="20"
                    className="w-full bg-gray-800 text-white px-3 py-2 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Bench Spots</label>
                  <input
                    type="number"
                    value={config.leagueSettings.benchSpots}
                    onChange={(e) => handleValueChange(['leagueSettings', 'benchSpots'], parseInt(e.target.value))}
                    min="5"
                    max="10"
                    className="w-full bg-gray-800 text-white px-3 py-2 rounded-lg"
                  />
                </div>
              </div>
            </div>

            {/* Starting Lineup */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">Starting Lineup</h3>
              <div className="grid grid-cols-3 gap-4">
                {Object.entries(config.leagueSettings.starters).map(([position, count]) => (
                  <div key={position}>
                    <label className="block text-sm text-gray-400 mb-1">{position}</label>
                    <input
                      type="number"
                      value={count}
                      onChange={(e) => handleValueChange(['leagueSettings', 'starters', position], parseInt(e.target.value))}
                      min="0"
                      max="4"
                      className="w-full bg-gray-800 text-white px-3 py-2 rounded-lg"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 'scoring':
        return (
          <div className="space-y-6">
            <div className="bg-yellow-900/20 border border-yellow-600/30 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-400 mt-0.5" />
                <p className="text-sm text-yellow-200">
                  Scoring system changes affect player valuations. Apply changes to recalculate all values.
                </p>
              </div>
            </div>

            {/* Passing */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">Passing</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Yards (per yard)</label>
                  <input
                    type="number"
                    value={config.scoringSystem.passing.yards}
                    onChange={(e) => handleValueChange(['scoringSystem', 'passing', 'yards'], parseFloat(e.target.value))}
                    step="0.01"
                    className="w-full bg-gray-800 text-white px-3 py-2 rounded-lg"
                  />
                  <span className="text-xs text-gray-500">1pt/25yds = 0.04</span>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Touchdowns</label>
                  <input
                    type="number"
                    value={config.scoringSystem.passing.touchdowns}
                    onChange={(e) => handleValueChange(['scoringSystem', 'passing', 'touchdowns'], parseInt(e.target.value))}
                    className="w-full bg-gray-800 text-white px-3 py-2 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Interceptions</label>
                  <input
                    type="number"
                    value={config.scoringSystem.passing.interceptions}
                    onChange={(e) => handleValueChange(['scoringSystem', 'passing', 'interceptions'], parseInt(e.target.value))}
                    className="w-full bg-gray-800 text-white px-3 py-2 rounded-lg"
                  />
                </div>
              </div>
            </div>

            {/* Rushing */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">Rushing</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Yards (per yard)</label>
                  <input
                    type="number"
                    value={config.scoringSystem.rushing.yards}
                    onChange={(e) => handleValueChange(['scoringSystem', 'rushing', 'yards'], parseFloat(e.target.value))}
                    step="0.01"
                    className="w-full bg-gray-800 text-white px-3 py-2 rounded-lg"
                  />
                  <span className="text-xs text-gray-500">1pt/10yds = 0.1</span>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Touchdowns</label>
                  <input
                    type="number"
                    value={config.scoringSystem.rushing.touchdowns}
                    onChange={(e) => handleValueChange(['scoringSystem', 'rushing', 'touchdowns'], parseInt(e.target.value))}
                    className="w-full bg-gray-800 text-white px-3 py-2 rounded-lg"
                  />
                </div>
              </div>
            </div>

            {/* Receiving */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">Receiving</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Receptions (PPR)</label>
                  <input
                    type="number"
                    value={config.scoringSystem.receiving.receptions}
                    onChange={(e) => handleValueChange(['scoringSystem', 'receiving', 'receptions'], parseFloat(e.target.value))}
                    step="0.5"
                    className="w-full bg-gray-800 text-white px-3 py-2 rounded-lg"
                  />
                  <span className="text-xs text-gray-500">1=PPR, 0.5=Half, 0=Standard</span>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Yards (per yard)</label>
                  <input
                    type="number"
                    value={config.scoringSystem.receiving.yards}
                    onChange={(e) => handleValueChange(['scoringSystem', 'receiving', 'yards'], parseFloat(e.target.value))}
                    step="0.01"
                    className="w-full bg-gray-800 text-white px-3 py-2 rounded-lg"
                  />
                  <span className="text-xs text-gray-500">1pt/10yds = 0.1</span>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Touchdowns</label>
                  <input
                    type="number"
                    value={config.scoringSystem.receiving.touchdowns}
                    onChange={(e) => handleValueChange(['scoringSystem', 'receiving', 'touchdowns'], parseInt(e.target.value))}
                    className="w-full bg-gray-800 text-white px-3 py-2 rounded-lg"
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case 'replacement':
        return (
          <div className="space-y-6">
            <div className="bg-blue-900/20 border border-blue-600/30 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-blue-400 mt-0.5" />
                <div>
                  <p className="text-sm text-blue-200 mb-2">
                    VORP (Value Over Replacement Player) is the foundation of player valuation.
                  </p>
                  <p className="text-xs text-gray-400">
                    Lower replacement ranks = fewer valuable players = higher scarcity value
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">Replacement Level by Position</h3>
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(config.replacementLevels).map(([position, rank]) => (
                  <div key={position} className="bg-gray-800 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-sm font-medium text-white">{position}</label>
                      <span className="text-xs text-gray-400">Rank #{rank}</span>
                    </div>
                    <input
                      type="range"
                      value={rank}
                      onChange={(e) => handleValueChange(['replacementLevels', position], parseInt(e.target.value))}
                      min={position === 'QB' ? 12 : position === 'RB' ? 36 : position === 'WR' ? 48 : 12}
                      max={position === 'QB' ? 24 : position === 'RB' ? 60 : position === 'WR' ? 72 : 24}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>More Scarce</span>
                      <span>Less Scarce</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 'market':
        return (
          <div className="space-y-6">
            <div className="bg-green-900/20 border border-green-600/30 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-green-400 mt-0.5" />
                <p className="text-sm text-green-200">
                  Market adjustments reflect how actual auctions differ from pure VORP calculations.
                  RBs typically go for more, while QBs and DSTs go for less than their VORP suggests.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">Position Market Adjustments</h3>
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(config.marketAdjustments).map(([position, adjustment]) => {
                  const percentage = ((adjustment - 1) * 100).toFixed(0);
                  const isPositive = adjustment > 1;
                  const isNeutral = Math.abs(adjustment - 1) < 0.01;
                  
                  return (
                    <div key={position} className="bg-gray-800 rounded-lg p-4">
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-sm font-medium text-white">{position}</label>
                        <span className={`text-sm font-mono ${
                          isNeutral ? 'text-gray-400' : 
                          isPositive ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {isPositive && '+'}{percentage}%
                        </span>
                      </div>
                      <input
                        type="range"
                        value={adjustment}
                        onChange={(e) => handleValueChange(['marketAdjustments', position], parseFloat(e.target.value))}
                        min="0.3"
                        max="1.3"
                        step="0.05"
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>-70%</span>
                        <span>Fair Value</span>
                        <span>+30%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );

      case 'tiers':
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">Tier Value Multipliers</h3>
              {config.tierMultipliers.map((tier, index) => (
                <div key={tier.name} className="bg-gray-800 rounded-lg p-4">
                  <div className="grid grid-cols-4 gap-4 items-center">
                    <div>
                      <label className="text-sm text-gray-400">Tier Name</label>
                      <p className="text-white font-medium capitalize">{tier.name}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-400">Ranks</label>
                      <p className="text-white">{tier.rankStart}-{tier.rankEnd}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-400">Multiplier</label>
                      <input
                        type="number"
                        value={tier.multiplier}
                        onChange={(e) => {
                          const newTiers = [...config.tierMultipliers];
                          newTiers[index].multiplier = parseFloat(e.target.value);
                          handleValueChange(['tierMultipliers'], newTiers);
                        }}
                        step="0.05"
                        min="0.5"
                        max="1.5"
                        className="w-full bg-gray-700 text-white px-2 py-1 rounded"
                      />
                    </div>
                    <div className="text-right">
                      <span className={`text-sm font-mono ${
                        tier.multiplier > 1 ? 'text-green-400' : 
                        tier.multiplier < 1 ? 'text-red-400' : 'text-gray-400'
                      }`}>
                        {tier.multiplier > 1 ? '+' : ''}{((tier.multiplier - 1) * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'projections':
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">Projection Source Weights</h3>
              {config.projectionWeights
                .filter(w => w.enabled)
                .map((weight, index) => (
                <div key={weight.source} className="bg-gray-800 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-medium text-white capitalize">
                      {weight.source.replace('_', ' ')}
                    </label>
                    <span className="text-sm font-mono text-blue-400">
                      {(weight.weight * 100).toFixed(0)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    value={weight.weight}
                    onChange={(e) => {
                      const newWeights = [...config.projectionWeights];
                      const enabledIndex = config.projectionWeights.findIndex(w => w.source === weight.source);
                      newWeights[enabledIndex].weight = parseFloat(e.target.value);
                      
                      // Normalize weights to sum to 1
                      const totalWeight = newWeights
                        .filter(w => w.enabled)
                        .reduce((sum, w) => sum + w.weight, 0);
                      
                      if (totalWeight > 0) {
                        newWeights.forEach(w => {
                          if (w.enabled) {
                            w.weight = w.weight / totalWeight;
                          }
                        });
                      }
                      
                      handleValueChange(['projectionWeights'], newWeights);
                    }}
                    min="0"
                    max="1"
                    step="0.05"
                    className="w-full"
                  />
                </div>
              ))}
              
              <div className="bg-blue-900/20 border border-blue-600/30 rounded-lg p-3">
                <p className="text-xs text-blue-200">
                  Weights are automatically normalized to sum to 100%
                </p>
              </div>
            </div>
          </div>
        );

      case 'bidding':
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">Bid Range Settings</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-800 rounded-lg p-4">
                  <label className="block text-sm text-gray-400 mb-2">Maximum Bid</label>
                  <input
                    type="number"
                    value={(config.bidRanges.maxBidMultiplier * 100).toFixed(0)}
                    onChange={(e) => handleValueChange(['bidRanges', 'maxBidMultiplier'], parseFloat(e.target.value) / 100)}
                    className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg"
                  />
                  <span className="text-xs text-gray-500">% of calculated value</span>
                </div>
                
                <div className="bg-gray-800 rounded-lg p-4">
                  <label className="block text-sm text-gray-400 mb-2">Minimum Bid</label>
                  <input
                    type="number"
                    value={(config.bidRanges.minBidMultiplier * 100).toFixed(0)}
                    onChange={(e) => handleValueChange(['bidRanges', 'minBidMultiplier'], parseFloat(e.target.value) / 100)}
                    className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg"
                  />
                  <span className="text-xs text-gray-500">% of calculated value</span>
                </div>
              </div>
              
              <div className="bg-gray-800 rounded-lg p-4">
                <h4 className="text-sm font-medium text-white mb-3">Strategy Presets</h4>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      handleValueChange(['bidRanges', 'maxBidMultiplier'], 1.25);
                      handleValueChange(['bidRanges', 'minBidMultiplier'], 0.90);
                    }}
                    className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm"
                  >
                    Aggressive
                  </button>
                  <button
                    onClick={() => {
                      handleValueChange(['bidRanges', 'maxBidMultiplier'], 1.15);
                      handleValueChange(['bidRanges', 'minBidMultiplier'], 0.85);
                    }}
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
                  >
                    Balanced
                  </button>
                  <button
                    onClick={() => {
                      handleValueChange(['bidRanges', 'maxBidMultiplier'], 1.10);
                      handleValueChange(['bidRanges', 'minBidMultiplier'], 0.80);
                    }}
                    className="px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm"
                  >
                    Conservative
                  </button>
                  <button
                    onClick={() => {
                      handleValueChange(['bidRanges', 'maxBidMultiplier'], 1.05);
                      handleValueChange(['bidRanges', 'minBidMultiplier'], 0.75);
                    }}
                    className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm"
                  >
                    Value Hunter
                  </button>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <Settings className="w-6 h-6 text-blue-400" />
            <h2 className="text-2xl font-bold text-white">Valuation Settings</h2>
            {isDirty && (
              <span className="text-sm text-yellow-400 bg-yellow-900/30 px-2 py-1 rounded">
                Unsaved Changes
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex overflow-x-auto border-b border-gray-700 px-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-blue-400 text-blue-400'
                    : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-sm font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {renderTabContent()}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between p-6 border-t border-gray-700">
          <div className="flex gap-2">
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
            <label className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors cursor-pointer">
              <Upload className="w-4 h-4" />
              Import
              <input
                type="file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
              />
            </label>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleReset}
              disabled={!isDirty}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                isDirty 
                  ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                  : 'bg-gray-800 text-gray-500 cursor-not-allowed'
              }`}
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>
            <button
              onClick={handleApply}
              disabled={!isDirty || isSaving}
              className={`flex items-center gap-2 px-6 py-2 rounded-lg transition-colors ${
                isDirty && !isSaving
                  ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                  : 'bg-gray-800 text-gray-500 cursor-not-allowed'
              }`}
            >
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white"></div>
                  Applying...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Apply Changes
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;