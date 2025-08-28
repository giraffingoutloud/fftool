"""
Deterministic pytest unit tests for core valuation calculations.
Tests VORP, budget conservation, monotonicity, and invariants.
"""

import pytest
import numpy as np
from typing import List, Dict, Any
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.lib.calibratedValuationModel import CalibratedValuationModel, PlayerData


class TestValuationCalculations:
    """Test suite for core valuation calculations"""
    
    @pytest.fixture
    def valuation_model(self):
        """Create valuation model instance"""
        return CalibratedValuationModel()
    
    @pytest.fixture
    def synthetic_players_basic(self) -> List[PlayerData]:
        """Basic synthetic player set for simple tests"""
        return [
            # Elite tier players
            PlayerData(id='p1', name='Elite RB1', position='RB', team='DAL', 
                      projectedPoints=320.0, adp=1, positionRank=1),
            PlayerData(id='p2', name='Elite WR1', position='WR', team='CIN',
                      projectedPoints=340.0, adp=2, positionRank=1),
            # Mid tier
            PlayerData(id='p3', name='Mid RB1', position='RB', team='NYG',
                      projectedPoints=200.0, adp=25, positionRank=10),
            PlayerData(id='p4', name='Mid WR1', position='WR', team='SEA',
                      projectedPoints=220.0, adp=30, positionRank=15),
            # Replacement level
            PlayerData(id='p5', name='Replace RB', position='RB', team='JAX',
                      projectedPoints=104.1, adp=150, positionRank=48),
            PlayerData(id='p6', name='Replace WR', position='WR', team='HOU',
                      projectedPoints=148.4, adp=180, positionRank=60),
        ]
    
    @pytest.fixture
    def synthetic_players_edge_cases(self) -> List[PlayerData]:
        """Edge case synthetic players"""
        return [
            # Zero points player
            PlayerData(id='e1', name='Injured Player', position='RB', team='IR',
                      projectedPoints=0.0, adp=250, positionRank=99),
            # Negative VBD (below replacement)
            PlayerData(id='e2', name='Below Replace', position='RB', team='BAD',
                      projectedPoints=50.0, adp=240, positionRank=80),
            # Very high points
            PlayerData(id='e3', name='Super Elite', position='QB', team='KC',
                      projectedPoints=450.0, adp=1, positionRank=1),
            # Exactly at replacement
            PlayerData(id='e4', name='At Replace', position='TE', team='AVG',
                      projectedPoints=135.7, adp=100, positionRank=18),
        ]
    
    @pytest.fixture
    def synthetic_players_full_league(self) -> List[PlayerData]:
        """Full league worth of players (192 = 12 teams × 16 roster)"""
        players = []
        
        # Generate realistic distribution by position
        positions_dist = {
            'QB': {'count': 20, 'top': 360, 'replacement': 262.3, 'decline': 4.5},
            'RB': {'count': 60, 'top': 320, 'replacement': 104.1, 'decline': 3.5},
            'WR': {'count': 72, 'top': 340, 'replacement': 148.4, 'decline': 2.5},
            'TE': {'count': 24, 'top': 260, 'replacement': 135.7, 'decline': 5.0},
            'DST': {'count': 16, 'top': 130, 'replacement': 111.7, 'decline': 1.2},
            'K': {'count': 16, 'top': 160, 'replacement': 146.6, 'decline': 0.9}
        }
        
        player_id = 0
        for position, config in positions_dist.items():
            for rank in range(1, config['count'] + 1):
                # Exponential decay in points
                decay = np.exp(-rank / config['decline'])
                points = config['replacement'] + (config['top'] - config['replacement']) * decay
                
                players.append(PlayerData(
                    id=f'p{player_id}',
                    name=f'{position}{rank}',
                    position=position,
                    team='TM',
                    projectedPoints=max(0, points),
                    adp=player_id + 1,
                    positionRank=rank
                ))
                player_id += 1
        
        return players
    
    def test_vorp_computation_basic(self, valuation_model, synthetic_players_basic):
        """Test VORP calculation for basic cases"""
        # Calculate valuations
        valuations = [
            valuation_model.calculateAuctionValue(p, synthetic_players_basic)
            for p in synthetic_players_basic
        ]
        
        # Elite RB should have high positive VORP (320 - 104.1 = 215.9)
        assert valuations[0].vbd == pytest.approx(215.9, rel=0.01)
        
        # Elite WR should have high positive VORP (340 - 148.4 = 191.6)
        assert valuations[1].vbd == pytest.approx(191.6, rel=0.01)
        
        # Replacement level RB should have 0 VORP
        assert valuations[4].vbd == 0.0
        
        # Replacement level WR should have 0 VORP
        assert valuations[5].vbd == 0.0
    
    def test_vorp_never_negative(self, valuation_model, synthetic_players_edge_cases):
        """Test that VORP is never negative"""
        valuations = [
            valuation_model.calculateAuctionValue(p, synthetic_players_edge_cases)
            for p in synthetic_players_edge_cases
        ]
        
        for val in valuations:
            assert val.vbd >= 0, f"Player {val.playerName} has negative VORP: {val.vbd}"
    
    def test_auction_value_minimum_dollar(self, valuation_model, synthetic_players_edge_cases):
        """Test that all auction values are at least $1"""
        valuations = [
            valuation_model.calculateAuctionValue(p, synthetic_players_edge_cases)
            for p in synthetic_players_edge_cases
        ]
        
        for val in valuations:
            assert val.auctionValue >= 1, f"Player {val.playerName} below $1: ${val.auctionValue}"
            assert val.minBid >= 1, f"Player {val.playerName} minBid below $1: ${val.minBid}"
    
    def test_budget_conservation(self, valuation_model, synthetic_players_full_league):
        """Test budget conservation across full league"""
        result = valuation_model.processAllPlayers(synthetic_players_full_league)
        
        # Check budget conservation
        budget_check = result['validation']['budgetConservation']
        
        # Should be within 95-105% of total budget ($2400 for 12 teams)
        assert budget_check['percentageOfBudget'] >= 95.0
        assert budget_check['percentageOfBudget'] <= 105.0
        assert budget_check['passed'] == True
        
        # Total value should be close to expected
        expected = 2400  # 12 teams × $200
        assert abs(budget_check['totalValue'] - expected) <= expected * 0.05
    
    def test_dollars_per_point_consistency(self, valuation_model, synthetic_players_full_league):
        """Test that dollars-per-VORP-point is consistent within position"""
        valuations = []
        for player in synthetic_players_full_league:
            val = valuation_model.calculateAuctionValue(player, synthetic_players_full_league)
            if val.vbd > 0:  # Only check players above replacement
                valuations.append(val)
        
        # Group by position
        by_position = {}
        for val in valuations:
            if val.position not in by_position:
                by_position[val.position] = []
            if val.vbd > 10:  # Only meaningful VBD
                dollars_per_vbd = (val.baseValue - 1) / val.vbd  # Subtract $1 minimum
                by_position[val.position].append(dollars_per_vbd)
        
        # Check consistency within position (before market adjustments)
        for position, ratios in by_position.items():
            if len(ratios) > 1:
                std_dev = np.std(ratios)
                mean = np.mean(ratios)
                cv = std_dev / mean  # Coefficient of variation
                # Should be relatively consistent (CV < 0.15)
                assert cv < 0.15, f"{position} has inconsistent $/VBD: CV={cv:.3f}"
    
    def test_monotonicity_within_position(self, valuation_model, synthetic_players_full_league):
        """Test monotonicity: higher projected points = higher value within position"""
        valuations = []
        for player in synthetic_players_full_league:
            valuations.append(valuation_model.calculateAuctionValue(player, synthetic_players_full_league))
        
        # Group by position and sort by projected points
        by_position = {}
        for val in valuations:
            if val.position not in by_position:
                by_position[val.position] = []
            by_position[val.position].append(val)
        
        # Check monotonicity for each position
        for position, vals in by_position.items():
            # Sort by projected points descending
            sorted_vals = sorted(vals, key=lambda x: x.projectedPoints, reverse=True)
            
            # Check that values are non-increasing
            for i in range(1, len(sorted_vals)):
                current = sorted_vals[i]
                previous = sorted_vals[i-1]
                
                # Allow small violations due to tier adjustments, but general trend should hold
                if current.projectedPoints < previous.projectedPoints:
                    # Value should generally be lower (allow 10% tolerance for tier effects)
                    max_allowed = previous.auctionValue * 1.1
                    assert current.auctionValue <= max_allowed, \
                        f"{position}: {current.playerName} (${current.auctionValue}) > " \
                        f"{previous.playerName} (${previous.auctionValue}) despite fewer points"
    
    def test_position_multipliers_applied(self, valuation_model, synthetic_players_basic):
        """Test that position multipliers are correctly applied"""
        # Create two identical players except position
        rb_player = PlayerData(id='rb1', name='RB Test', position='RB', team='DAL',
                              projectedPoints=200.0, adp=20, positionRank=10)
        wr_player = PlayerData(id='wr1', name='WR Test', position='WR', team='DAL',
                              projectedPoints=200.0, adp=20, positionRank=10)
        
        test_set = [rb_player, wr_player] + synthetic_players_basic
        
        rb_val = valuation_model.calculateAuctionValue(rb_player, test_set)
        wr_val = valuation_model.calculateAuctionValue(wr_player, test_set)
        
        # RB should have 1.15 multiplier vs WR 1.0
        # So RB value should be ~15% higher (accounting for rounding)
        ratio = rb_val.auctionValue / wr_val.auctionValue
        assert ratio >= 1.10 and ratio <= 1.20, f"RB/WR ratio {ratio:.2f} not in expected range"
    
    def test_tier_multipliers_applied(self, valuation_model, synthetic_players_full_league):
        """Test that tier multipliers create appropriate premiums/discounts"""
        rb_players = [p for p in synthetic_players_full_league if p.position == 'RB']
        
        valuations = []
        for player in rb_players[:25]:  # Top 25 RBs
            valuations.append(valuation_model.calculateAuctionValue(player, synthetic_players_full_league))
        
        # Elite (1-3) should have 1.2x tier multiplier
        # Tier 1 (4-8) should have 1.1x
        # Tier 2 (9-16) should have 1.0x
        
        # Compare tier adjustments
        elite_avg_tier = np.mean([v.tierAdjustment for v in valuations[:3]])
        tier1_avg_tier = np.mean([v.tierAdjustment for v in valuations[3:8]])
        tier2_avg_tier = np.mean([v.tierAdjustment for v in valuations[8:16]])
        
        assert elite_avg_tier == pytest.approx(1.2, rel=0.01)
        assert tier1_avg_tier == pytest.approx(1.1, rel=0.01)
        assert tier2_avg_tier == pytest.approx(1.0, rel=0.01)
    
    def test_golden_values_real_players(self, valuation_model):
        """Golden tests with frozen expected outputs for real players"""
        # Define a small set of real players with known expected values
        real_players = [
            PlayerData(id='bijan', name='Bijan Robinson', position='RB', team='ATL',
                      projectedPoints=316.9, adp=2, positionRank=1),
            PlayerData(id='jamarr', name='Ja\'Marr Chase', position='WR', team='CIN',
                      projectedPoints=334.4, adp=4, positionRank=1),
            PlayerData(id='bowers', name='Brock Bowers', position='TE', team='LV',
                      projectedPoints=251.5, adp=35, positionRank=1),
            PlayerData(id='jayden', name='Jayden Daniels', position='QB', team='WAS',
                      projectedPoints=351.6, adp=45, positionRank=1),
        ]
        
        # Add replacement level players for context
        for pos, rank, points in [('RB', 48, 104.1), ('WR', 60, 148.4), 
                                 ('TE', 18, 135.7), ('QB', 15, 262.3)]:
            real_players.append(PlayerData(
                id=f'repl_{pos}', name=f'Replacement {pos}', position=pos,
                team='NA', projectedPoints=points, adp=200, positionRank=rank
            ))
        
        # Calculate valuations
        valuations = {}
        for player in real_players[:4]:  # Only test the star players
            val = valuation_model.calculateAuctionValue(player, real_players)
            valuations[player.id] = val
        
        # Golden values (frozen expected outputs)
        # These values are based on our calibrated model and should not change
        golden_values = {
            'bijan': {
                'vbd': 212.8,  # 316.9 - 104.1
                'auctionValue': 77,  # Frozen expected value
                'tolerance': 3  # Allow ±$3 due to rounding
            },
            'jamarr': {
                'vbd': 186.0,  # 334.4 - 148.4
                'auctionValue': 58,
                'tolerance': 3
            },
            'bowers': {
                'vbd': 115.8,  # 251.5 - 135.7
                'auctionValue': 33,
                'tolerance': 2
            },
            'jayden': {
                'vbd': 89.3,  # 351.6 - 262.3
                'auctionValue': 24,
                'tolerance': 2
            }
        }
        
        # Verify golden values
        for player_id, expected in golden_values.items():
            val = valuations[player_id]
            assert val.vbd == pytest.approx(expected['vbd'], abs=0.1), \
                f"{player_id}: VBD {val.vbd:.1f} != expected {expected['vbd']}"
            
            assert abs(val.auctionValue - expected['auctionValue']) <= expected['tolerance'], \
                f"{player_id}: Value ${val.auctionValue} outside tolerance of ${expected['auctionValue']}"
    
    def test_confidence_scores(self, valuation_model, synthetic_players_full_league):
        """Test confidence score calculation logic"""
        valuations = []
        for player in synthetic_players_full_league[:30]:  # Top 30 players
            valuations.append(valuation_model.calculateAuctionValue(player, synthetic_players_full_league))
        
        # Elite players (rank 1-5) should have higher confidence
        elite_confidence = [v.confidence for v in valuations if v.positionRank <= 5]
        mid_confidence = [v.confidence for v in valuations if 12 <= v.positionRank <= 24]
        
        assert all(c >= 0.85 for c in elite_confidence), "Elite players should have high confidence"
        assert np.mean(elite_confidence) > np.mean(mid_confidence), "Elite > Mid confidence"
        assert all(0.5 <= c <= 1.0 for v in valuations for c in [v.confidence]), "Confidence in valid range"
    
    def test_max_bid_relationships(self, valuation_model, synthetic_players_basic):
        """Test that bid ranges make sense"""
        valuations = []
        for player in synthetic_players_basic:
            valuations.append(valuation_model.calculateAuctionValue(player, synthetic_players_basic))
        
        for val in valuations:
            # Max bid should be ~15% above target
            assert val.maxBid == pytest.approx(val.targetBid * 1.15, rel=0.1)
            
            # Min bid should be ~15% below target
            assert val.minBid == pytest.approx(val.targetBid * 0.85, rel=0.1)
            
            # Target should equal auction value
            assert val.targetBid == val.auctionValue
            
            # All should be at least $1
            assert val.minBid >= 1
            assert val.targetBid >= 1
            assert val.maxBid >= 1