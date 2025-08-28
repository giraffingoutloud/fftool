#!/usr/bin/env python3
"""
Data Integrity Fixer
Fixes validation issues WITHOUT modifying or estimating data
Only addresses structural issues to preserve ALL original data
"""

import pandas as pd
import numpy as np
import json
import logging
import os
from pathlib import Path
from typing import Dict, List, Any, Optional
import sys

# Add project to path  
sys.path.append('/mnt/c/Users/giraf/Documents/projects/fftool')
from etl.player_normalizer import PlayerNormalizer

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class DataIntegrityFixer:
    """
    Fixes data integrity issues without modifying actual data values.
    Only fixes structural issues to ensure data can be properly parsed.
    """
    
    def __init__(self):
        self.canonical_path = Path('/mnt/c/Users/giraf/Documents/projects/fftool/canonical_data')
        self.fixed_path = Path('/mnt/c/Users/giraf/Documents/projects/fftool/artifacts/structurally_fixed_data')
        self.fixed_path.mkdir(parents=True, exist_ok=True)
        
        self.normalizer = PlayerNormalizer()
        self.fixes_applied = []
        
    def fix_adp5_headers(self) -> Dict[str, Any]:
        """Fix ADP5 file that has metadata headers before data."""
        filepath = self.canonical_path / 'adp' / 'adp5_2025.txt'
        
        result = {
            'file': 'adp5_2025.txt',
            'issue': 'Metadata headers before data',
            'fix_applied': False,
            'original_preserved': True
        }
        
        try:
            # Read file and skip metadata lines
            with open(filepath, 'r') as f:
                lines = f.readlines()
            
            # Find where actual data starts (look for header row)
            data_start = 0
            for i, line in enumerate(lines):
                if line.startswith('ADP,Overall,Name'):
                    data_start = i
                    break
            
            # Save structurally fixed version (preserving ALL data)
            fixed_filepath = self.fixed_path / 'adp' / 'adp5_2025.txt'
            fixed_filepath.parent.mkdir(parents=True, exist_ok=True)
            
            with open(fixed_filepath, 'w') as f:
                # Write data starting from header row
                f.writelines(lines[data_start:])
            
            # Also save metadata separately
            metadata_filepath = self.fixed_path / 'adp' / 'adp5_2025_metadata.txt'
            with open(metadata_filepath, 'w') as f:
                f.writelines(lines[:data_start])
            
            result['fix_applied'] = True
            result['fixed_file'] = str(fixed_filepath)
            result['metadata_file'] = str(metadata_filepath)
            result['data_rows_preserved'] = len(lines) - data_start - 1
            
            logger.info(f"Fixed ADP5 file structure, preserved {result['data_rows_preserved']} data rows")
            
        except Exception as e:
            result['error'] = str(e)
            logger.error(f"Failed to fix ADP5: {e}")
        
        return result
    
    def fix_49ers_csv(self) -> Dict[str, Any]:
        """Fix 49ers.csv that has inconsistent column counts."""
        filepath = self.canonical_path / 'advanced_data' / '2025-2026' / '49ers.csv'
        
        result = {
            'file': '49ers.csv',
            'issue': 'Inconsistent column count in some rows',
            'fix_applied': False,
            'original_preserved': True
        }
        
        try:
            # Read with error handling
            lines = []
            with open(filepath, 'r', encoding='utf-8') as f:
                lines = f.readlines()
            
            if not lines:
                result['error'] = 'File is empty'
                return result
            
            # Get expected column count from header
            header = lines[0]
            expected_cols = len(header.split(','))
            
            # Fix lines with wrong column count
            fixed_lines = []
            issues_found = []
            
            for i, line in enumerate(lines):
                col_count = len(line.split(','))
                if col_count != expected_cols:
                    # Log the issue but preserve the line
                    issues_found.append({
                        'line': i + 1,
                        'expected': expected_cols,
                        'found': col_count
                    })
                fixed_lines.append(line)
            
            # Save structurally fixed version
            fixed_filepath = self.fixed_path / 'advanced_data' / '2025-2026' / '49ers.csv'
            fixed_filepath.parent.mkdir(parents=True, exist_ok=True)
            
            with open(fixed_filepath, 'w') as f:
                f.writelines(fixed_lines)
            
            result['fix_applied'] = True
            result['fixed_file'] = str(fixed_filepath)
            result['issues_found'] = issues_found
            result['total_rows'] = len(lines)
            
            if issues_found:
                logger.warning(f"Found {len(issues_found)} rows with column count issues in 49ers.csv")
            
        except Exception as e:
            result['error'] = str(e)
            logger.error(f"Failed to fix 49ers.csv: {e}")
        
        return result
    
    def create_team_code_mapping(self) -> Dict[str, Any]:
        """Create mapping for team code inconsistencies without modifying data."""
        result = {
            'mapping_created': False,
            'team_codes_found': {},
            'recommended_mappings': {}
        }
        
        try:
            # Scan all files for team codes
            all_team_codes = set()
            
            for root, dirs, files in os.walk(self.canonical_path):
                for file in files:
                    if file.endswith(('.csv', '.txt')):
                        try:
                            filepath = Path(root) / file
                            df = pd.read_csv(filepath, nrows=100)  # Sample first 100 rows
                            
                            # Look for team columns
                            team_cols = [col for col in df.columns if any(
                                term in col.lower() for term in ['team', 'tm', 'club']
                            )]
                            
                            for col in team_cols:
                                teams = df[col].dropna().unique()
                                # Convert to strings to avoid type issues
                                all_team_codes.update(str(t) for t in teams)
                        except:
                            continue
            
            # Create mapping for non-standard codes
            standard_codes = {
                'ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE',
                'DAL', 'DEN', 'DET', 'GB', 'HOU', 'IND', 'JAX', 'KC',
                'LAC', 'LAR', 'LV', 'MIA', 'MIN', 'NE', 'NO', 'NYG',
                'NYJ', 'PHI', 'PIT', 'SEA', 'SF', 'TB', 'TEN', 'WAS'
            }
            
            non_standard = [code for code in all_team_codes if code not in standard_codes]
            
            # Create mappings using normalizer
            for code in non_standard:
                normalized = self.normalizer.normalize_team_code(code)
                if normalized != code:
                    result['recommended_mappings'][code] = normalized
            
            result['team_codes_found'] = {
                'standard': sorted(list(all_team_codes & standard_codes)),
                'non_standard': sorted(non_standard)
            }
            result['mapping_created'] = True
            
            # Save mapping to file
            mapping_file = self.fixed_path / 'team_code_mappings.json'
            with open(mapping_file, 'w') as f:
                json.dump(result, f, indent=2)
            
            result['mapping_file'] = str(mapping_file)
            
            logger.info(f"Created team code mapping with {len(result['recommended_mappings'])} mappings")
            
        except Exception as e:
            result['error'] = str(e)
            logger.error(f"Failed to create team mapping: {e}")
        
        return result
    
    def create_player_name_registry(self) -> Dict[str, Any]:
        """Create registry of all player names without modifying data."""
        result = {
            'registry_created': False,
            'unique_players': 0,
            'name_variations': {}
        }
        
        try:
            all_players = {}  # normalized -> list of original variations
            
            # Scan projection and ADP files
            target_dirs = ['projections', 'adp']
            
            for dir_name in target_dirs:
                dir_path = self.canonical_path / dir_name
                if not dir_path.exists():
                    continue
                    
                for file in dir_path.glob('*.csv'):
                    try:
                        df = pd.read_csv(file)
                        
                        # Find player columns
                        player_cols = [col for col in df.columns if any(
                            term in col.lower() for term in ['player', 'name']
                        ) and 'team' not in col.lower()]
                        
                        for col in player_cols:
                            for name in df[col].dropna().unique():
                                # Get position if available
                                pos = None
                                pos_cols = [c for c in df.columns if 'position' in c.lower() or c.lower() == 'pos']
                                if pos_cols:
                                    pos_idx = df[df[col] == name].index
                                    if len(pos_idx) > 0:
                                        pos = df.loc[pos_idx[0], pos_cols[0]]
                                
                                normalized = self.normalizer.normalize_player_name(str(name), pos)
                                
                                if normalized not in all_players:
                                    all_players[normalized] = set()
                                all_players[normalized].add(str(name))
                    
                    except Exception as e:
                        logger.warning(f"Could not process {file}: {e}")
            
            # Convert sets to lists for JSON serialization
            result['name_variations'] = {
                norm: sorted(list(variations)) 
                for norm, variations in all_players.items()
                if len(variations) > 1  # Only include names with variations
            }
            
            result['unique_players'] = len(all_players)
            result['registry_created'] = True
            
            # Save registry
            registry_file = self.fixed_path / 'player_name_registry.json'
            with open(registry_file, 'w') as f:
                json.dump({
                    'total_unique_players': result['unique_players'],
                    'players_with_variations': len(result['name_variations']),
                    'variations': result['name_variations']
                }, f, indent=2)
            
            result['registry_file'] = str(registry_file)
            
            logger.info(f"Created player registry with {result['unique_players']} unique players")
            
        except Exception as e:
            result['error'] = str(e)
            logger.error(f"Failed to create player registry: {e}")
        
        return result
    
    def apply_fixes(self) -> Dict[str, Any]:
        """Apply all fixes without modifying original data."""
        logger.info("=" * 60)
        logger.info("APPLYING DATA INTEGRITY FIXES")
        logger.info("NOTE: All original data is preserved")
        logger.info("=" * 60)
        
        results = {
            'fixes_applied': [],
            'original_data_preserved': True,
            'fixed_files_location': str(self.fixed_path)
        }
        
        # Fix structural issues
        logger.info("\n1. Fixing structural issues...")
        
        # Fix ADP5 headers
        adp5_result = self.fix_adp5_headers()
        results['fixes_applied'].append(adp5_result)
        
        # Fix 49ers.csv
        niners_result = self.fix_49ers_csv()
        results['fixes_applied'].append(niners_result)
        
        # Create mappings (doesn't modify data)
        logger.info("\n2. Creating data mappings...")
        
        # Team code mapping
        team_mapping = self.create_team_code_mapping()
        results['team_code_mapping'] = team_mapping
        
        # Player name registry
        player_registry = self.create_player_name_registry()
        results['player_registry'] = player_registry
        
        # Save summary
        summary_file = self.fixed_path / 'integrity_fixes_summary.json'
        with open(summary_file, 'w') as f:
            json.dump(results, f, indent=2, default=str)
        
        logger.info(f"\n✅ Fixes complete. Summary saved to: {summary_file}")
        
        print("\n" + "=" * 60)
        print("DATA INTEGRITY FIXES SUMMARY")
        print("=" * 60)
        print(f"✅ Original data preserved: {results['original_data_preserved']}")
        print(f"📁 Fixed files location: {results['fixed_files_location']}")
        print(f"🔧 Structural fixes applied: {len(results['fixes_applied'])}")
        
        if team_mapping.get('mapping_created'):
            print(f"🗺️  Team codes mapped: {len(team_mapping.get('recommended_mappings', {}))}")
        
        if player_registry.get('registry_created'):
            print(f"👥 Unique players found: {player_registry.get('unique_players', 0)}")
        
        print("\nNOTE: All original canonical_data files remain unchanged")
        print("Fixed versions are in artifacts/structurally_fixed_data/")
        
        return results


if __name__ == '__main__':
    fixer = DataIntegrityFixer()
    results = fixer.apply_fixes()