"""
Tests for valuation model invariants.
Ensures mathematical properties hold across all computations.
"""

import pytest
import numpy as np
from typing import List
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.lib.calibratedValuationModel import CalibratedValuationModel, PlayerData
from src.lib.valuationInvariantChecker import ValuationInvariantChecker


class TestValuationInvariants:
    """Test suite for valuation model invariants"""
    
    @pytest.fixture
    def invariant_checker(self):
        """Create invariant checker instance"""
        return ValuationInvariantChecker()
    
    @pytest.fixture
    def valuation_model(self):
        """Create valuation model instance"""
        return CalibratedValuationModel()
    
    @pytest.fixture
    def standard_league_players(self) -> List[PlayerData]:
        """Generate a standard 12-team league worth of players"""
        players = []
        player_id = 0
        
        # Realistic point distributions by position
        distributions = {
            'QB': {'count': 24, 'max': 380, 'min': 200, 'top_tier': 5},
            'RB': {'count': 60, 'max': 320, 'min': 50, 'top_tier': 8},
            'WR': {'count': 72, 'max': 340, 'min': 60, 'top_tier': 10},
            'TE': {'count': 24, 'max': 260, 'min': 70, 'top_tier': 3},
            'DST': {'count': 16, 'max': 130, 'min': 90, 'top_tier': 3},
            'K': {'count': 16, 'max': 160, 'min': 130, 'top_tier': 2}
        }
        
        for position, config in distributions.items():
            for rank in range(1, config['count'] + 1):
                # Create realistic point distribution
                if rank <= config['top_tier']:
                    # Elite tier - linear decrease
                    points = config['max'] - (rank - 1) * 10
                else:
                    # Exponential decay for rest
                    decay_rate = 0.9
                    remaining = config['count'] - config['top_tier']
                    position_in_tier = rank - config['top_tier']
                    tier_range = config['max'] - config['min'] - config['top_tier'] * 10
                    points = config['min'] + tier_range * (decay_rate ** (position_in_tier / remaining))
                
                players.append(PlayerData(
                    id=f'p{player_id}',
                    name=f'{position} Player {rank}',
                    position=position,
                    team=f'TM{(player_id % 32) + 1}',
                    projectedPoints=max(0, points),
                    adp=player_id + 1,
                    positionRank=rank
                ))
                player_id += 1
        
        return players
    
    def test_invariant_budget_conservation(self, valuation_model, standard_league_players):
        """Test Invariant 1: Budget Conservation"""
        result = valuation_model.processAllPlayers(standard_league_players)
        
        # Total auction values for drafted players should equal total league budget
        total_budget = 12 * 200  # 12 teams × $200
        roster_size = 12 * 16  # 12 teams × 16 players
        
        # Get top N players by value
        sorted_valuations = sorted(result['valuations'], 
                                 key=lambda x: x.auctionValue, 
                                 reverse=True)
        drafted_players = sorted_valuations[:roster_size]
        
        total_value = sum(p.auctionValue for p in drafted_players)
        
        # Should be within 5% of total budget
        ratio = total_value / total_budget
        assert 0.95 <= ratio <= 1.05, \
            f"Budget conservation failed: ${total_value} / ${total_budget} = {ratio:.2%}"
    
    def test_invariant_replacement_level_zeroing(self, valuation_model, standard_league_players):
        """Test Invariant 2: Replacement-level players have near-zero VORP"""
        valuations = []
        for player in standard_league_players:
            valuations.append(valuation_model.calculateAuctionValue(player, standard_league_players))
        
        # Check replacement level players for each position
        replacement_ranks = {
            'QB': 15, 'RB': 48, 'WR': 60, 'TE': 18, 'DST': 14, 'K': 13
        }
        
        for position, repl_rank in replacement_ranks.items():
            pos_players = [v for v in valuations if v.position == position]
            pos_players.sort(key=lambda x: x.positionRank)
            
            if len(pos_players) >= repl_rank:
                # Players at or just below replacement should have VORP near 0
                at_replacement = pos_players[repl_rank - 1:repl_rank + 2]
                
                for player in at_replacement:
                    if player.positionRank >= repl_rank:
                        assert player.vbd <= 5, \
                            f"{position}{player.positionRank} has VORP {player.vbd:.1f} > 5"
    
    def test_invariant_non_negativity(self, valuation_model, standard_league_players):
        """Test Invariant 3: All values and prices are non-negative"""
        result = valuation_model.processAllPlayers(standard_league_players)
        
        for val in result['valuations']:
            assert val.auctionValue >= 1, f"{val.playerName}: auction value ${val.auctionValue} < $1"
            assert val.vbd >= 0, f"{val.playerName}: VORP {val.vbd} < 0"
            assert val.minBid >= 1, f"{val.playerName}: min bid ${val.minBid} < $1"
            assert val.targetBid >= 1, f"{val.playerName}: target bid ${val.targetBid} < $1"
            assert val.maxBid >= 1, f"{val.playerName}: max bid ${val.maxBid} < $1"
            assert 0 <= val.confidence <= 1, f"{val.playerName}: confidence {val.confidence} out of range"
    
    def test_invariant_monotonicity(self, valuation_model, standard_league_players):
        """Test Invariant 4: Monotonicity within positions"""
        result = valuation_model.processAllPlayers(standard_league_players)
        
        # Group by position
        by_position = {}
        for val in result['valuations']:
            if val.position not in by_position:
                by_position[val.position] = []
            by_position[val.position].append(val)
        
        violations = []
        for position, players in by_position.items():
            # Sort by projected points
            players.sort(key=lambda x: x.projectedPoints, reverse=True)
            
            # Check monotonicity with some tolerance for tier effects
            for i in range(1, len(players)):
                if players[i].projectedPoints < players[i-1].projectedPoints:
                    # Allow up to 20% violation due to tier/market adjustments
                    tolerance = 1.20
                    if players[i].auctionValue > players[i-1].auctionValue * tolerance:
                        violations.append({
                            'position': position,
                            'player1': players[i-1].playerName,
                            'points1': players[i-1].projectedPoints,
                            'value1': players[i-1].auctionValue,
                            'player2': players[i].playerName,
                            'points2': players[i].projectedPoints,
                            'value2': players[i].auctionValue
                        })
        
        assert len(violations) == 0, f"Monotonicity violations: {violations[:3]}"
    
    def test_invariant_positional_scarcity(self, valuation_model, standard_league_players):
        """Test Invariant 5: Positional value distribution reflects scarcity"""
        result = valuation_model.processAllPlayers(standard_league_players)
        
        # Calculate total value by position for starters
        position_values = {}
        starter_counts = {
            'QB': 12, 'RB': 30, 'WR': 36, 'TE': 12, 'DST': 12, 'K': 12
        }
        
        for position, count in starter_counts.items():
            pos_players = [v for v in result['valuations'] if v.position == position]
            pos_players.sort(key=lambda x: x.auctionValue, reverse=True)
            top_players = pos_players[:count]
            position_values[position] = sum(p.auctionValue for p in top_players)
        
        total_starter_value = sum(position_values.values())
        
        # Check expected ranges
        expected_ranges = {
            'QB': (0.05, 0.10),
            'RB': (0.45, 0.52),  # Slightly wider range for RB
            'WR': (0.33, 0.40),
            'TE': (0.05, 0.10),
            'DST': (0.005, 0.02),
            'K': (0.005, 0.02)
        }
        
        for position, (min_pct, max_pct) in expected_ranges.items():
            actual_pct = position_values[position] / total_starter_value
            assert min_pct <= actual_pct <= max_pct, \
                f"{position}: {actual_pct:.1%} outside range [{min_pct:.1%}, {max_pct:.1%}]"
    
    def test_invariant_max_budget_share(self, valuation_model, standard_league_players):
        """Test Invariant 6: No player exceeds reasonable budget share"""
        result = valuation_model.processAllPlayers(standard_league_players)
        
        max_budget_share = 0.40  # No player should exceed 40% of budget ($80 in $200 league)
        max_allowed = 200 * max_budget_share
        
        violations = []
        for val in result['valuations']:
            if val.auctionValue > max_allowed:
                violations.append({
                    'player': val.playerName,
                    'value': val.auctionValue,
                    'share': val.auctionValue / 200
                })
        
        assert len(violations) == 0, \
            f"Players exceeding {max_budget_share:.0%} budget share: {violations}"
    
    def test_invariant_checker_integration(self, invariant_checker, valuation_model, standard_league_players):
        """Test integration with ValuationInvariantChecker"""
        # Process players
        result = valuation_model.processAllPlayers(standard_league_players)
        
        # Convert to format for invariant checker
        players_for_checker = []
        for val in result['valuations']:
            players_for_checker.append({
                'id': val.playerId,
                'name': val.playerName,
                'position': val.position,
                'team': '',
                'projectedPoints': val.projectedPoints,
                'vorp': val.vbd,
                'intrinsicValue': val.auctionValue,
                'marketPrice': max(1, int(val.auctionValue * 0.9)),
                'edge': max(0, int(val.auctionValue * 0.1)),
                'adp': 0,
                'confidence': val.confidence
            })
        
        # Run invariant checks
        invariant_report = invariant_checker.checkAllInvariants(players_for_checker)
        
        # At minimum, these should pass
        assert invariant_report.invariants.replacementLevelZeroing.passed, \
            "Replacement level zeroing failed"
        assert invariant_report.invariants.nonNegativity.passed, \
            "Non-negativity failed"
        assert invariant_report.invariants.monotonicity.passed, \
            "Monotonicity failed"
    
    def test_edge_case_all_identical_players(self, valuation_model):
        """Test edge case: all players have identical stats"""
        identical_players = [
            PlayerData(
                id=f'p{i}',
                name=f'Player {i}',
                position='RB',
                team='TM',
                projectedPoints=150.0,
                adp=i+1,
                positionRank=i+1
            ) for i in range(50)
        ]
        
        result = valuation_model.processAllPlayers(identical_players)
        
        # All players at same position with same points should have similar values
        # (may differ slightly due to tier cutoffs)
        values = [v.auctionValue for v in result['valuations']]
        assert max(values) - min(values) <= 5, \
            f"Identical players have value spread > $5: {min(values)}-{max(values)}"
    
    def test_edge_case_extreme_scoring(self, valuation_model):
        """Test edge case: extreme scoring disparities"""
        extreme_players = [
            # Super elite
            PlayerData(id='p1', name='Superman', position='RB', team='KC',
                      projectedPoints=500.0, adp=1, positionRank=1),
            # Normal players
            PlayerData(id='p2', name='Normal RB', position='RB', team='NYG',
                      projectedPoints=200.0, adp=10, positionRank=2),
            # Very low scorer
            PlayerData(id='p3', name='Backup RB', position='RB', team='JAX',
                      projectedPoints=10.0, adp=200, positionRank=60),
        ]
        
        # Add replacement level context
        for i in range(4, 50):
            extreme_players.append(
                PlayerData(id=f'p{i}', name=f'RB{i}', position='RB', team='TM',
                          projectedPoints=max(50, 150 - i*2), adp=i, positionRank=i)
            )
        
        result = valuation_model.processAllPlayers(extreme_players)
        
        # Superman should have high but not infinite value
        superman = next(v for v in result['valuations'] if v.playerName == 'Superman')
        assert superman.auctionValue <= 150, \
            f"Superman value ${superman.auctionValue} exceeds reasonable maximum"
        assert superman.auctionValue >= 50, \
            f"Superman value ${superman.auctionValue} below reasonable minimum"
        
        # Backup should be $1
        backup = next(v for v in result['valuations'] if v.playerName == 'Backup RB')
        assert backup.auctionValue == 1, f"Backup RB should be $1, got ${backup.auctionValue}"