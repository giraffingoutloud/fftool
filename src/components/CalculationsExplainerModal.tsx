import React, { useState } from 'react';
import { X, Calculator, TrendingUp, DollarSign, Target, Layers, Activity, Award, Info, CheckCircle } from 'lucide-react';

interface CalculationsExplainerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CalculationsExplainerModal: React.FC<CalculationsExplainerModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState('projections');

  if (!isOpen) return null;

  const tabs = [
    { id: 'projections', label: 'Projected Points', icon: TrendingUp },
    { id: 'vorp', label: 'VORP', icon: Activity },
    { id: 'auction', label: 'Auction Value', icon: DollarSign },
    { id: 'invariants', label: 'Invariant Tests', icon: CheckCircle },
    { id: 'tiers', label: 'Tiers', icon: Layers },
    { id: 'edge', label: 'Edge', icon: Target },
    { id: 'confidence', label: 'Confidence', icon: Award },
    { id: 'ranges', label: 'Bid Ranges', icon: Calculator },
    { id: 'data', label: 'Data Sources', icon: Info },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'projections':
        return (
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-white mb-4">Projected Points Aggregation</h3>
            
            <div className="bg-gray-800 rounded-lg p-4">
              <h4 className="font-semibold text-blue-400 mb-2">Weighted Average Formula:</h4>
              <code className="block bg-gray-900 p-3 rounded text-green-400">
                projectedPoints = (FantasyPros × 0.40) + (CBS × 0.35) + (baseline × 0.25)
              </code>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-gray-300">Data Sources & Weights:</h4>
              <ul className="space-y-2 text-gray-400">
                <li className="flex justify-between">
                  <span>• FantasyPros (4 position files)</span>
                  <span className="text-blue-400 font-mono">40%</span>
                </li>
                <li className="flex justify-between">
                  <span>• CBS Sports (4 position files)</span>
                  <span className="text-blue-400 font-mono">35%</span>
                </li>
                <li className="flex justify-between">
                  <span>• Baseline projections_2025.csv</span>
                  <span className="text-blue-400 font-mono">25%</span>
                </li>
              </ul>
            </div>

            <div className="bg-gray-800 rounded-lg p-4">
              <h4 className="font-semibold text-blue-400 mb-2">Player Matching Process:</h4>
              <ol className="list-decimal list-inside space-y-1 text-gray-400">
                <li>Normalize names (lowercase, remove special chars)</li>
                <li>Remove suffixes (Jr, Sr, II, III, etc.)</li>
                <li>Match by normalized_name + position</li>
                <li>Calculate weighted average across all sources</li>
                <li>Round to 1 decimal place</li>
              </ol>
            </div>

            <div className="bg-gray-800 rounded-lg p-4">
              <h4 className="font-semibold text-blue-400 mb-2">PPR Scoring Formula (if calculated from stats):</h4>
              <code className="block bg-gray-900 p-3 rounded text-green-400 text-sm">
                points = passYds/25 + passTD×4 - INT×2 + rushYds/10 + rushTD×6 + receptions×1 + recYds/10 + recTD×6
              </code>
            </div>
          </div>
        );

      case 'vorp':
        return (
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-white mb-4">VORP (Value Over Replacement Player)</h3>
            
            <div className="bg-gray-800 rounded-lg p-4">
              <h4 className="font-semibold text-blue-400 mb-2">Formula:</h4>
              <code className="block bg-gray-900 p-3 rounded text-green-400">
                VORP = projectedPoints - replacementPoints
              </code>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-gray-300">Replacement Level by Position:</h4>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-gray-800 rounded p-3">
                  <span className="text-gray-400">QB:</span>
                  <span className="text-blue-400 font-mono ml-2">QB15</span>
                  <p className="text-xs text-gray-500 mt-1">Most teams roster 1-2 QBs</p>
                </div>
                <div className="bg-gray-800 rounded p-3">
                  <span className="text-gray-400">RB:</span>
                  <span className="text-blue-400 font-mono ml-2">RB48</span>
                  <p className="text-xs text-gray-500 mt-1">12 teams × 4 RBs average</p>
                </div>
                <div className="bg-gray-800 rounded p-3">
                  <span className="text-gray-400">WR:</span>
                  <span className="text-blue-400 font-mono ml-2">WR60</span>
                  <p className="text-xs text-gray-500 mt-1">12 teams × 5 WRs average</p>
                </div>
                <div className="bg-gray-800 rounded p-3">
                  <span className="text-gray-400">TE:</span>
                  <span className="text-blue-400 font-mono ml-2">TE18</span>
                  <p className="text-xs text-gray-500 mt-1">Most teams roster 1-2 TEs</p>
                </div>
                <div className="bg-gray-800 rounded p-3">
                  <span className="text-gray-400">DST:</span>
                  <span className="text-blue-400 font-mono ml-2">DST14</span>
                  <p className="text-xs text-gray-500 mt-1">Some teams stream DST</p>
                </div>
                <div className="bg-gray-800 rounded p-3">
                  <span className="text-gray-400">K:</span>
                  <span className="text-blue-400 font-mono ml-2">K13</span>
                  <p className="text-xs text-gray-500 mt-1">Few roster backup kickers</p>
                </div>
              </div>
            </div>

            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
              <h4 className="font-semibold text-blue-400 mb-2">Why VORP Matters:</h4>
              <p className="text-gray-400 text-sm">
                VORP measures how much better a player is than what's freely available. A QB with 350 points might seem valuable, 
                but if replacement QBs score 320 points, the VORP is only 30. This helps compare value across positions fairly.
              </p>
            </div>
          </div>
        );

      case 'auction':
        return (
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-white mb-4">Auction Value Calculation (Calibrated Model)</h3>
            
            <div className="bg-gray-800 rounded-lg p-4">
              <h4 className="font-semibold text-blue-400 mb-2">Calibrated Formula:</h4>
              <code className="block bg-gray-900 p-3 rounded text-green-400 text-sm">
                baseValue = (vorp / totalVORP) × discretionaryBudget<br/>
                tierAdjusted = baseValue × tierMultiplier<br/>
                calibrated = tierAdjusted × calibrationFactor<br/>
                finalValue = Math.max(1, Math.round(calibrated))
              </code>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-gray-300">Position-Specific Calibration:</h4>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-gray-800 rounded p-3">
                  <span className="text-gray-400 font-semibold">RB:</span>
                  <span className="text-green-400 font-mono ml-2">45-50% of budget</span>
                  <p className="text-xs text-gray-500">High value on workhorse backs</p>
                </div>
                <div className="bg-gray-800 rounded p-3">
                  <span className="text-gray-400 font-semibold">WR:</span>
                  <span className="text-blue-400 font-mono ml-2">35-40% of budget</span>
                  <p className="text-xs text-gray-500">Deep position but elite matters</p>
                </div>
                <div className="bg-gray-800 rounded p-3">
                  <span className="text-gray-400 font-semibold">QB:</span>
                  <span className="text-yellow-400 font-mono ml-2">5-10% of budget</span>
                  <p className="text-xs text-gray-500">Streaming viable</p>
                </div>
                <div className="bg-gray-800 rounded p-3">
                  <span className="text-gray-400 font-semibold">TE:</span>
                  <span className="text-purple-400 font-mono ml-2">5-10% of budget</span>
                  <p className="text-xs text-gray-500">Premium for elite TEs</p>
                </div>
              </div>
              <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                <p className="text-sm text-gray-400">
                  <span className="font-semibold text-blue-400">Calibrated Model:</span> Dynamic calibration ensures budget conservation
                  (top 192 = ~$2400) and proper position distribution based on market conditions
                </p>
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg p-4">
              <h4 className="font-semibold text-blue-400 mb-2">Discretionary Budget:</h4>
              <p className="text-gray-400 text-sm">
                Total Budget ($2400 for 12 teams) - Minimum Roster Cost ($192 = 12 teams × 16 players × $1)
                = <span className="text-green-400 font-mono">$2208 discretionary</span>
              </p>
            </div>

            <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
              <h4 className="font-semibold text-green-400 mb-2">✅ Model Validation:</h4>
              <p className="text-gray-400 text-sm">
                Our calibrated model automatically adjusts to ensure fair valuations based on current projections and market data.
                Values are dynamically calibrated to match historical spending patterns.
              </p>
            </div>
          </div>
        );

      case 'invariants':
        return (
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-white mb-4">Model Validation Tests</h3>
            
            <div className="bg-gray-800 rounded-lg p-4">
              <h4 className="font-semibold text-blue-400 mb-2">What Are Invariants?</h4>
              <p className="text-gray-400 text-sm">
                Validation tests ensure our valuation model produces fair, balanced, and realistic auction values. 
                The calibrated model dynamically adjusts to maintain these constraints.
              </p>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-gray-300">Current Test Results:</h4>
              
              <div className="space-y-2">
                <div className="bg-green-900/20 border border-green-500/30 rounded p-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-green-400 font-semibold">✅ Budget Conservation</span>
                    <span className="text-green-400 font-mono">PASSED</span>
                  </div>
                  <p className="text-gray-400 text-sm">
                    Top 192 players: <span className="text-green-400">$2,338</span> (97.4% of $2,400 target)
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Ensures the total auction budget is properly distributed across all roster spots
                  </p>
                </div>

                <div className="bg-green-900/20 border border-green-500/30 rounded p-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-green-400 font-semibold">✅ Position Distribution</span>
                    <span className="text-green-400 font-mono">PASSED</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                    <div className="text-gray-400">RB: <span className="text-green-400">45.3%</span> (45-50%)</div>
                    <div className="text-gray-400">WR: <span className="text-green-400">39.9%</span> (35-40%)</div>
                    <div className="text-gray-400">QB: <span className="text-green-400">6.6%</span> (5-10%)</div>
                    <div className="text-gray-400">TE: <span className="text-green-400">7.1%</span> (5-10%)</div>
                    <div className="text-gray-400">DST: <span className="text-green-400">0.6%</span> (0.5-2%)</div>
                    <div className="text-gray-400">K: <span className="text-green-400">0.6%</span> (0.5-1%)</div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Matches historical auction spending patterns by position
                  </p>
                </div>

                <div className="bg-green-900/20 border border-green-500/30 rounded p-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-green-400 font-semibold">✅ No Negative Values</span>
                    <span className="text-green-400 font-mono">PASSED</span>
                  </div>
                  <p className="text-gray-400 text-sm">
                    All 572 players have positive or $1 minimum values
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Every rosterable player must have at least $1 value
                  </p>
                </div>

                <div className="bg-green-900/20 border border-green-500/30 rounded p-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-green-400 font-semibold">✅ Reasonable Value Ranges</span>
                    <span className="text-green-400 font-mono">PASSED</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                    <div className="text-gray-400">Max RB: <span className="text-green-400">$75</span> (limit: $80)</div>
                    <div className="text-gray-400">Max WR: <span className="text-green-400">$59</span> (limit: $75)</div>
                    <div className="text-gray-400">Max QB: <span className="text-green-400">$24</span> (limit: $45)</div>
                    <div className="text-gray-400">Max TE: <span className="text-green-400">$36</span> (limit: $40)</div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Prevents unrealistic player valuations
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
              <h4 className="font-semibold text-blue-400 mb-2">Calibration Approach:</h4>
              <div className="space-y-1 text-sm">
                <p className="text-gray-400">
                  The model uses a dynamic calibration factor (typically 0.55-0.65) that automatically adjusts
                  based on the total VORP to ensure proper budget distribution.
                </p>
                <p className="text-gray-400">
                  This approach maintains flexibility while ensuring consistent results across different
                  projection sets and scoring systems.
                </p>
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg p-4">
              <h4 className="font-semibold text-blue-400 mb-2">Testing Command:</h4>
              <code className="block bg-gray-900 p-3 rounded text-green-400 text-sm">
                npm run test:valuations
              </code>
              <p className="text-xs text-gray-500 mt-2">
                Run this command to verify all validation tests pass after any model changes
              </p>
            </div>
          </div>
        );

      case 'tiers':
        return (
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-white mb-4">Tier Classification</h3>
            
            <div className="bg-gray-800 rounded-lg p-4">
              <h4 className="font-semibold text-blue-400 mb-2">Tier Assignment Logic:</h4>
              <code className="block bg-gray-900 p-3 rounded text-green-400 text-sm">
                if (positionRank ≤ 3) tier = 'elite'<br/>
                else if (positionRank ≤ 8) tier = 'tier1'<br/>
                else if (positionRank ≤ 20) tier = 'tier2'<br/>
                else if (auctionValue &gt; 5) tier = 'tier3'<br/>
                else tier = 'replacement'
              </code>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-gray-300">Base Tier Multipliers:</h4>
              <div className="space-y-2">
                <div className="flex justify-between bg-purple-900/30 rounded p-3">
                  <span className="text-purple-400 font-semibold">Elite (Ranks 1-3)</span>
                  <span className="text-green-400 font-mono">1.15× (+15%)</span>
                </div>
                <div className="flex justify-between bg-blue-900/30 rounded p-3">
                  <span className="text-blue-400 font-semibold">Tier 1 (Ranks 4-8)</span>
                  <span className="text-green-400 font-mono">1.08× (+8%)</span>
                </div>
                <div className="flex justify-between bg-gray-800 rounded p-3">
                  <span className="text-gray-300">Tier 2 (Ranks 9-16)</span>
                  <span className="text-gray-400 font-mono">1.00× (base)</span>
                </div>
                <div className="flex justify-between bg-gray-800 rounded p-3">
                  <span className="text-gray-400">Tier 3 (Ranks 17-24)</span>
                  <span className="text-orange-400 font-mono">0.92× (-8%)</span>
                </div>
                <div className="flex justify-between bg-gray-900 rounded p-3">
                  <span className="text-gray-500">Replacement (25+)</span>
                  <span className="text-red-400 font-mono">0.75× (-25%)</span>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                * Position-specific adjustments are applied on top of base multipliers
              </p>
            </div>

            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
              <h4 className="font-semibold text-blue-400 mb-2">Position Rank Calculation:</h4>
              <p className="text-gray-400 text-sm">
                Players are ranked within their position based on projected points (descending). 
                The #1 RB has positionRank = 1, regardless of overall rank.
              </p>
            </div>
          </div>
        );

      case 'edge':
        return (
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-white mb-4">Edge Calculation</h3>
            
            <div className="bg-gray-800 rounded-lg p-4">
              <h4 className="font-semibold text-blue-400 mb-2">Edge Formula:</h4>
              <code className="block bg-gray-900 p-3 rounded text-green-400">
                edge = auctionValue - marketPrice<br/>
                edge% = (edge / marketValue) × 100
              </code>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-gray-300">Understanding Edge Values:</h4>
              <div className="space-y-2">
                <div className="flex justify-between bg-green-900/30 rounded p-3">
                  <span className="text-green-400">Edge ≥ $20</span>
                  <span className="text-gray-300">Exceptional value - priority target</span>
                </div>
                <div className="flex justify-between bg-green-900/20 rounded p-3">
                  <span className="text-green-300">Edge $10-19</span>
                  <span className="text-gray-300">Strong value - recommended</span>
                </div>
                <div className="flex justify-between bg-yellow-900/20 rounded p-3">
                  <span className="text-yellow-400">Edge $5-9</span>
                  <span className="text-gray-300">Good value - consider</span>
                </div>
                <div className="flex justify-between bg-gray-800 rounded p-3">
                  <span className="text-gray-400">Edge $0-4</span>
                  <span className="text-gray-300">Fair value - market price</span>
                </div>
                <div className="flex justify-between bg-orange-900/20 rounded p-3">
                  <span className="text-orange-400">Edge -$5 to -$1</span>
                  <span className="text-gray-300">Slight overpay - be cautious</span>
                </div>
                <div className="flex justify-between bg-red-900/20 rounded p-3">
                  <span className="text-red-400">Edge &lt; -$5</span>
                  <span className="text-gray-300">Significant overpay - avoid</span>
                </div>
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg p-4">
              <h4 className="font-semibold text-blue-400 mb-2">Market Price Source:</h4>
              <p className="text-gray-400 text-sm">
                Market prices come from actual Average Auction Values (AAV) in the ESPN_AAV column 
                from adp1_2025.csv. If no AAV data exists, we estimate conservatively: 
                <code className="text-green-400">min(2, max(1, round(auctionValue × 0.5)))</code>
              </p>
            </div>
          </div>
        );

      case 'confidence':
        return (
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-white mb-4">Confidence Score</h3>
            
            <div className="bg-gray-800 rounded-lg p-4">
              <h4 className="font-semibold text-blue-400 mb-2">Confidence Calculation:</h4>
              <code className="block bg-gray-900 p-3 rounded text-green-400 text-sm">
                baseFactor = min(1, numSources / 3)<br/>
                agreementFactor = based on coefficient of variation<br/>
                confidence = baseFactor × 0.5 + agreementFactor<br/>
                final = min(0.95, max(0.3, confidence))
              </code>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-gray-300">Agreement Factors (Coefficient of Variation):</h4>
              <div className="space-y-2">
                <div className="flex justify-between bg-green-900/30 rounded p-3">
                  <span className="text-green-400">CV &lt; 0.1</span>
                  <span className="text-gray-300">Very high agreement (+0.4)</span>
                </div>
                <div className="flex justify-between bg-green-900/20 rounded p-3">
                  <span className="text-green-300">CV 0.1-0.2</span>
                  <span className="text-gray-300">High agreement (+0.3)</span>
                </div>
                <div className="flex justify-between bg-yellow-900/20 rounded p-3">
                  <span className="text-yellow-400">CV 0.2-0.3</span>
                  <span className="text-gray-300">Moderate agreement (+0.2)</span>
                </div>
                <div className="flex justify-between bg-orange-900/20 rounded p-3">
                  <span className="text-orange-400">CV 0.3-0.5</span>
                  <span className="text-gray-300">Low agreement (+0.1)</span>
                </div>
                <div className="flex justify-between bg-red-900/20 rounded p-3">
                  <span className="text-red-400">CV &gt; 0.5</span>
                  <span className="text-gray-300">Poor agreement (+0.0)</span>
                </div>
              </div>
            </div>

            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
              <h4 className="font-semibold text-blue-400 mb-2">What Confidence Means:</h4>
              <p className="text-gray-400 text-sm">
                Higher confidence (0.8+) means projection sources agree closely. Lower confidence (0.3-0.6) 
                indicates disagreement between sources or limited data. Use confidence to gauge risk when 
                making draft decisions.
              </p>
            </div>
          </div>
        );

      case 'ranges':
        return (
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-white mb-4">Bid Range Calculations</h3>
            
            <div className="bg-gray-800 rounded-lg p-4">
              <h4 className="font-semibold text-blue-400 mb-2">Bid Range Formulas:</h4>
              <code className="block bg-gray-900 p-3 rounded text-green-400">
                maxBid = Math.max(1, Math.round(auctionValue × 1.15))<br/>
                targetBid = auctionValue<br/>
                minBid = Math.max(1, Math.round(auctionValue × 0.85))
              </code>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-gray-300">Understanding Bid Ranges:</h4>
              <div className="space-y-3">
                <div className="bg-gray-800 rounded-lg p-4">
                  <div className="flex justify-between mb-2">
                    <span className="text-green-400 font-semibold">Max Bid</span>
                    <span className="text-gray-400">Up to 15% over value</span>
                  </div>
                  <p className="text-gray-500 text-sm">
                    The absolute maximum you should pay. Going beyond this significantly overpays 
                    relative to the player's projected contribution.
                  </p>
                </div>

                <div className="bg-gray-800 rounded-lg p-4">
                  <div className="flex justify-between mb-2">
                    <span className="text-blue-400 font-semibold">Target Bid</span>
                    <span className="text-gray-400">Fair auction value</span>
                  </div>
                  <p className="text-gray-500 text-sm">
                    The calculated fair value based on VORP and market adjustments. Aim to get 
                    players at or below this price.
                  </p>
                </div>

                <div className="bg-gray-800 rounded-lg p-4">
                  <div className="flex justify-between mb-2">
                    <span className="text-yellow-400 font-semibold">Min Bid</span>
                    <span className="text-gray-400">15% under value</span>
                  </div>
                  <p className="text-gray-500 text-sm">
                    The bargain threshold. Getting a player at this price represents excellent 
                    value and should be prioritized.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
              <h4 className="font-semibold text-blue-400 mb-2">Floor/Ceiling Points:</h4>
              <code className="block bg-gray-900 p-2 rounded text-green-400 text-sm mb-2">
                floorPoints = projectedPoints × 0.75<br/>
                ceilingPoints = projectedPoints × 1.25
              </code>
              <p className="text-gray-400 text-sm">
                If not provided by data sources, we estimate floor at 75% and ceiling at 125% 
                of projected points to represent reasonable variance ranges.
              </p>
            </div>
          </div>
        );

      case 'data':
        return (
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-white mb-4">Data Processing Pipeline</h3>
            
            <div className="space-y-3">
              <div className="bg-gray-800 rounded-lg p-4">
                <h4 className="font-semibold text-blue-400 mb-2">1. ETL Pipeline (Python)</h4>
                <p className="text-gray-400 text-sm mb-2">robust_loader.py → artifacts/clean_data/</p>
                <ul className="text-gray-500 text-sm space-y-1">
                  <li>• Validates and cleans canonical data</li>
                  <li>• Removes duplicates</li>
                  <li>• Handles nulls and validates types</li>
                </ul>
              </div>

              <div className="bg-gray-800 rounded-lg p-4">
                <h4 className="font-semibold text-blue-400 mb-2">2. Data Loading (TypeScript)</h4>
                <p className="text-gray-400 text-sm mb-2">cleanDataLoader.ts</p>
                <ul className="text-gray-500 text-sm space-y-1">
                  <li>• Loads CSV files from clean_data/</li>
                  <li>• Applies team code mappings (ARZ→ARI, BLT→BAL)</li>
                  <li>• Builds SOS lookup from sos_2025.csv</li>
                </ul>
              </div>

              <div className="bg-gray-800 rounded-lg p-4">
                <h4 className="font-semibold text-blue-400 mb-2">3. Aggregation & Normalization</h4>
                <p className="text-gray-400 text-sm mb-2">projectionAggregator.ts & playerResolver.ts</p>
                <ul className="text-gray-500 text-sm space-y-1">
                  <li>• Weights multiple projection sources</li>
                  <li>• Normalizes player names across sources</li>
                  <li>• Handles DST variations ("Bills D/ST" vs "Buffalo DST")</li>
                </ul>
              </div>

              <div className="bg-gray-800 rounded-lg p-4">
                <h4 className="font-semibold text-blue-400 mb-2">4. Valuation Calculation</h4>
                <p className="text-gray-400 text-sm mb-2">calibratedValuationModel.ts</p>
                <ul className="text-gray-500 text-sm space-y-1">
                  <li>• Calculates VORP for each player</li>
                  <li>• Applies market and tier adjustments</li>
                  <li>• Generates auction values and bid ranges</li>
                </ul>
              </div>
            </div>

            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
              <h4 className="font-semibold text-blue-400 mb-2">Impact Chain:</h4>
              <div className="text-gray-400 text-sm space-y-1">
                <div>Projected Points (aggregated)</div>
                <div className="ml-4">↓</div>
                <div>VORP (points - replacement)</div>
                <div className="ml-4">↓</div>
                <div>Auction Value (VORP share × budget)</div>
                <div className="ml-4">↓</div>
                <div>Max/Target/Min Bids</div>
                <div className="ml-4">↓</div>
                <div>Edge (value vs market)</div>
                <div className="ml-4">↓</div>
                <div>Tier (based on position rank)</div>
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
      <div className="bg-gray-900 rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <Calculator className="w-6 h-6 text-blue-400" />
            <h2 className="text-2xl font-bold text-white">Methodology</h2>
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
      </div>
    </div>
  );
};

export default CalculationsExplainerModal;