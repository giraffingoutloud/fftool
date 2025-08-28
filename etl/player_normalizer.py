#!/usr/bin/env python3
"""
Player Name Normalization Service
Handles inconsistent player names across different data sources
"""

import re
from typing import Dict, Optional, Tuple, List
from difflib import SequenceMatcher
import logging

logger = logging.getLogger(__name__)

class PlayerNormalizer:
    """
    Normalizes player names across different data sources to ensure consistency.
    """
    
    def __init__(self):
        # Team name mappings for DST
        self.dst_mappings = {
            # Full name to abbreviation
            'arizona cardinals': 'ARI',
            'atlanta falcons': 'ATL',
            'baltimore ravens': 'BAL',
            'buffalo bills': 'BUF',
            'carolina panthers': 'CAR',
            'chicago bears': 'CHI',
            'cincinnati bengals': 'CIN',
            'cleveland browns': 'CLE',
            'dallas cowboys': 'DAL',
            'denver broncos': 'DEN',
            'detroit lions': 'DET',
            'green bay packers': 'GB',
            'houston texans': 'HOU',
            'indianapolis colts': 'IND',
            'jacksonville jaguars': 'JAX',
            'kansas city chiefs': 'KC',
            'las vegas raiders': 'LV',
            'los angeles chargers': 'LAC',
            'los angeles rams': 'LAR',
            'miami dolphins': 'MIA',
            'minnesota vikings': 'MIN',
            'new england patriots': 'NE',
            'new orleans saints': 'NO',
            'new york giants': 'NYG',
            'new york jets': 'NYJ',
            'philadelphia eagles': 'PHI',
            'pittsburgh steelers': 'PIT',
            'san francisco 49ers': 'SF',
            'seattle seahawks': 'SEA',
            'tampa bay buccaneers': 'TB',
            'tennessee titans': 'TEN',
            'washington commanders': 'WAS',
            
            # Common abbreviations and aliases
            'cardinals': 'ARI',
            'falcons': 'ATL',
            'ravens': 'BAL',
            'bills': 'BUF',
            'panthers': 'CAR',
            'bears': 'CHI',
            'bengals': 'CIN',
            'browns': 'CLE',
            'cowboys': 'DAL',
            'broncos': 'DEN',
            'lions': 'DET',
            'packers': 'GB',
            'texans': 'HOU',
            'colts': 'IND',
            'jaguars': 'JAX',
            'chiefs': 'KC',
            'raiders': 'LV',
            'chargers': 'LAC',
            'rams': 'LAR',
            'dolphins': 'MIA',
            'vikings': 'MIN',
            'patriots': 'NE',
            'saints': 'NO',
            'giants': 'NYG',
            'jets': 'NYJ',
            'eagles': 'PHI',
            'steelers': 'PIT',
            '49ers': 'SF',
            'niners': 'SF',
            'seahawks': 'SEA',
            'buccaneers': 'TB',
            'bucs': 'TB',
            'titans': 'TEN',
            'commanders': 'WAS',
            'washington': 'WAS',
            
            # Handle variations
            'arizona': 'ARI',
            'atlanta': 'ATL',
            'baltimore': 'BAL',
            'buffalo': 'BUF',
            'carolina': 'CAR',
            'chicago': 'CHI',
            'cincinnati': 'CIN',
            'cleveland': 'CLE',
            'dallas': 'DAL',
            'denver': 'DEN',
            'detroit': 'DET',
            'green bay': 'GB',
            'houston': 'HOU',
            'indianapolis': 'IND',
            'jacksonville': 'JAX',
            'kansas city': 'KC',
            'las vegas': 'LV',
            'oakland': 'LV',  # Historical
            'los angeles': 'LAR',  # Default to Rams if ambiguous
            'la chargers': 'LAC',
            'la rams': 'LAR',
            'miami': 'MIA',
            'minnesota': 'MIN',
            'new england': 'NE',
            'new orleans': 'NO',
            'new york': 'NYG',  # Default to Giants if ambiguous
            'ny giants': 'NYG',
            'ny jets': 'NYJ',
            'philadelphia': 'PHI',
            'philly': 'PHI',
            'pittsburgh': 'PIT',
            'san francisco': 'SF',
            'san fran': 'SF',
            'seattle': 'SEA',
            'tampa bay': 'TB',
            'tampa': 'TB',
            'tennessee': 'TEN',
            'washington': 'WAS',
            'dc': 'WAS',
        }
        
        # Team code aliases for data inconsistencies
        self.team_code_aliases = {
            'ARZ': 'ARI',  # Arizona
            'BLT': 'BAL',  # Baltimore (typo)
            'CLV': 'CLE',  # Cleveland
            'GB': 'GB',    # Green Bay
            'HST': 'HOU',  # Houston (typo)
            'JAC': 'JAX',  # Jacksonville
            'KC': 'KC',    # Kansas City
            'LA': 'LAR',   # Los Angeles (ambiguous, default to Rams)
            'LV': 'LV',    # Las Vegas
            'NE': 'NE',    # New England
            'NO': 'NO',    # New Orleans
            'NY': 'NYG',   # New York (ambiguous, default to Giants)
            'SD': 'LAC',   # San Diego (historical, now LA Chargers)
            'SF': 'SF',    # San Francisco
            'STL': 'LAR',  # St. Louis (historical, now LA Rams)
            'TB': 'TB',    # Tampa Bay
            'WSH': 'WAS',  # Washington
        }
        
        # Common name variations and nicknames
        self.name_variations = {
            # Format: canonical_name: [variations]
            'kenneth walker iii': ['kenneth walker', 'ken walker'],
            'marvin harrison jr': ['marvin harrison jr.', 'marvin harrison'],
            'calvin ridley': ['calvin ridley'],
            'michael pittman jr': ['michael pittman jr.', 'michael pittman'],
            'dj moore': ['d.j. moore', 'dj moore'],
            'aj brown': ['a.j. brown', 'aj brown'],
            'dk metcalf': ['d.k. metcalf', 'dk metcalf'],
            'cd lamb': ['ceedee lamb', 'c.d. lamb'],
            'jk dobbins': ['j.k. dobbins', 'jk dobbins'],
            'tj hockenson': ['t.j. hockenson', 'tj hockenson'],
        }
        
        # Build reverse mapping
        self.variation_to_canonical = {}
        for canonical, variations in self.name_variations.items():
            for var in variations:
                self.variation_to_canonical[var.lower()] = canonical
    
    def normalize_team_code(self, team: str) -> str:
        """Normalize team codes to standard abbreviations."""
        if not team:
            return ''
        
        team = str(team).upper().strip()
        
        # Check direct mapping
        if team in self.team_code_aliases:
            return self.team_code_aliases[team]
        
        # Already standard
        if len(team) <= 3:
            return team
            
        # Try to match full name
        team_lower = team.lower()
        if team_lower in self.dst_mappings:
            return self.dst_mappings[team_lower]
            
        return team
    
    def normalize_dst_name(self, name: str, position: str = None) -> str:
        """
        Normalize DST/defense names to consistent format.
        Returns format: 'TEAM DST' (e.g., 'CHI DST')
        """
        if not name:
            return ''
            
        name_lower = name.lower().strip()
        
        # Remove 'dst' or 'defense' suffixes for processing
        cleaned = re.sub(r'\s+(dst|defense|def)$', '', name_lower)
        cleaned = cleaned.strip()
        
        # Look up team code
        team_code = None
        if cleaned in self.dst_mappings:
            team_code = self.dst_mappings[cleaned]
        elif cleaned.upper() in self.team_code_aliases:
            team_code = self.team_code_aliases[cleaned.upper()]
        elif len(cleaned) <= 3:
            team_code = self.normalize_team_code(cleaned)
        
        if team_code:
            return f"{team_code} DST"
        
        # If can't normalize, return original with DST suffix
        if position and position.upper() == 'DST':
            if not name_lower.endswith('dst'):
                return f"{name.strip()} DST"
        
        return name.strip()
    
    def normalize_player_name(self, name: str, position: str = None) -> str:
        """
        Normalize player names to consistent format.
        """
        if not name:
            return ''
        
        # Handle DST specially
        if position and position.upper() == 'DST':
            return self.normalize_dst_name(name, position)
        
        # Clean name
        name = str(name).strip()
        
        # Remove common suffixes
        name = re.sub(r'\s+(jr\.?|sr\.?|iii|ii|iv|v)$', '', name, flags=re.IGNORECASE)
        
        # Normalize whitespace
        name = ' '.join(name.split())
        
        # Convert to lowercase for matching
        name_lower = name.lower()
        
        # Check for known variations
        if name_lower in self.variation_to_canonical:
            return self.variation_to_canonical[name_lower]
        
        # Handle special characters
        # Keep apostrophes for names like D'Andre
        name = re.sub(r"[^\w\s\'-]", '', name)
        
        return name.lower()
    
    def create_player_key(self, name: str, position: str = None, team: str = None) -> str:
        """
        Create a normalized key for player matching.
        Format: 'normalized_name_position' or 'normalized_name_position_team'
        """
        normalized_name = self.normalize_player_name(name, position)
        
        if not normalized_name:
            return ''
        
        # Normalize position
        pos = (position or '').upper().strip()
        
        # Create key
        if team:
            team_code = self.normalize_team_code(team)
            return f"{normalized_name}_{pos}_{team_code}".lower()
        else:
            return f"{normalized_name}_{pos}".lower()
    
    def fuzzy_match(self, name1: str, name2: str, threshold: float = 0.85) -> Tuple[bool, float]:
        """
        Perform fuzzy matching between two player names.
        Returns (is_match, confidence)
        """
        if not name1 or not name2:
            return False, 0.0
        
        # Normalize both names
        norm1 = self.normalize_player_name(name1)
        norm2 = self.normalize_player_name(name2)
        
        # Exact match after normalization
        if norm1 == norm2:
            return True, 1.0
        
        # Calculate similarity
        similarity = SequenceMatcher(None, norm1, norm2).ratio()
        
        # Check if meets threshold
        is_match = similarity >= threshold
        
        return is_match, similarity
    
    def match_players(self, source_players: List[Dict], 
                     target_players: List[Dict],
                     threshold: float = 0.85) -> Dict[str, str]:
        """
        Match players between two datasets.
        Returns mapping of source_key -> target_key
        """
        matches = {}
        unmatched_source = []
        
        # Create normalized keys for target
        target_keys = {}
        for player in target_players:
            name = player.get('player') or player.get('playerName') or player.get('Player', '')
            pos = player.get('position') or player.get('Position', '')
            team = player.get('team') or player.get('teamName') or player.get('Team', '')
            
            key = self.create_player_key(name, pos, team)
            if key:
                target_keys[key] = player
        
        # Try to match source players
        for player in source_players:
            name = player.get('player') or player.get('playerName') or player.get('Player', '')
            pos = player.get('position') or player.get('Position', '')
            team = player.get('team') or player.get('teamName') or player.get('Team', '')
            
            source_key = self.create_player_key(name, pos, team)
            
            if not source_key:
                continue
            
            # Try exact match first
            if source_key in target_keys:
                matches[source_key] = source_key
                continue
            
            # Try fuzzy match
            best_match = None
            best_score = 0
            
            for target_key in target_keys:
                # Only compare same position
                if source_key.split('_')[-1] != target_key.split('_')[-1]:
                    continue
                
                source_name = source_key.rsplit('_', 1)[0]
                target_name = target_key.rsplit('_', 1)[0]
                
                is_match, score = self.fuzzy_match(source_name, target_name, threshold)
                
                if is_match and score > best_score:
                    best_match = target_key
                    best_score = score
            
            if best_match:
                matches[source_key] = best_match
                logger.info(f"Fuzzy matched: {source_key} -> {best_match} (score: {best_score:.2f})")
            else:
                unmatched_source.append(source_key)
        
        if unmatched_source:
            logger.warning(f"Unmatched players: {len(unmatched_source)}")
            logger.debug(f"Sample unmatched: {unmatched_source[:5]}")
        
        return matches


# Singleton instance
normalizer = PlayerNormalizer()


def normalize_player_name(name: str, position: str = None) -> str:
    """Convenience function to normalize player names."""
    return normalizer.normalize_player_name(name, position)


def normalize_team_code(team: str) -> str:
    """Convenience function to normalize team codes."""
    return normalizer.normalize_team_code(team)


def create_player_key(name: str, position: str = None, team: str = None) -> str:
    """Convenience function to create player keys."""
    return normalizer.create_player_key(name, position, team)


if __name__ == '__main__':
    # Test the normalizer
    test_cases = [
        ('Bears DST', 'DST', 'CHI DST'),
        ('Chicago Bears DST', 'DST', 'CHI DST'),
        ('raiders dst', 'DST', 'LV DST'),
        ('Kenneth Walker III', 'RB', 'kenneth walker iii'),
        ('CeeDee Lamb', 'WR', 'cd lamb'),
        ('D.J. Moore', 'WR', 'dj moore'),
    ]
    
    print("Testing Player Normalizer:")
    print("-" * 50)
    
    for name, pos, expected in test_cases:
        result = normalize_player_name(name, pos)
        status = "✓" if result == expected.lower() else "✗"
        print(f"{status} {name:25} -> {result:25} (expected: {expected})")
    
    # Test team code normalization
    print("\nTesting Team Code Normalizer:")
    print("-" * 50)
    
    team_tests = [
        ('ARZ', 'ARI'),
        ('LA', 'LAR'),
        ('BLT', 'BAL'),
        ('GB', 'GB'),
        ('Washington', 'WAS'),
    ]
    
    for team, expected in team_tests:
        result = normalize_team_code(team)
        status = "✓" if result == expected else "✗"
        print(f"{status} {team:15} -> {result:5} (expected: {expected})")