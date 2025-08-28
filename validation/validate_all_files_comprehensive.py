#!/usr/bin/env python3
"""
Comprehensive validation of ALL files in canonical_data
Ensures data integrity and accuracy for fantasy football analysis

CRITICAL: 
- No data estimation or approximation
- No data omission
- All original data preserved
- Only flag issues, don't modify data
"""

import os
import sys
import pandas as pd
import numpy as np
import json
import hashlib
import logging
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Set, Tuple, Any

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Add project to path
sys.path.append('/mnt/c/Users/giraf/Documents/projects/fftool')
from etl.player_normalizer import PlayerNormalizer

class ComprehensiveDataValidator:
    """Validates ALL canonical data files without modifying any data."""
    
    def __init__(self):
        self.canonical_path = Path('/mnt/c/Users/giraf/Documents/projects/fftool/canonical_data')
        self.reports_path = Path('/mnt/c/Users/giraf/Documents/projects/fftool/reports/comprehensive_validation')
        self.reports_path.mkdir(parents=True, exist_ok=True)
        
        self.normalizer = PlayerNormalizer()
        self.validation_results = {}
        self.critical_issues = []
        self.data_integrity_issues = []
        
    def discover_all_files(self) -> Dict[str, List[Path]]:
        """Discover ALL files in canonical_data."""
        files_by_category = {}
        total_files = 0
        
        for root, dirs, files in os.walk(self.canonical_path):
            for file in files:
                if file.endswith(('.csv', '.txt')):
                    filepath = Path(root) / file
                    category = filepath.parent.name if filepath.parent != self.canonical_path else 'root'
                    
                    if category not in files_by_category:
                        files_by_category[category] = []
                    
                    files_by_category[category].append(filepath)
                    total_files += 1
        
        logger.info(f"Discovered {total_files} total files across {len(files_by_category)} categories")
        return files_by_category
    
    def validate_file_structure(self, filepath: Path) -> Dict[str, Any]:
        """Validate file structure without modifying data."""
        results = {
            'file': str(filepath),
            'readable': False,
            'rows': 0,
            'columns': 0,
            'has_headers': False,
            'encoding': None,
            'delimiter': None,
            'issues': []
        }
        
        try:
            # Try different encodings
            for encoding in ['utf-8', 'latin-1', 'cp1252']:
                try:
                    with open(filepath, 'r', encoding=encoding) as f:
                        first_line = f.readline()
                        results['encoding'] = encoding
                        results['readable'] = True
                        break
                except UnicodeDecodeError:
                    continue
            
            if not results['readable']:
                results['issues'].append('Cannot read file with standard encodings')
                return results
            
            # Read as DataFrame
            df = pd.read_csv(filepath, encoding=results['encoding'])
            results['rows'] = len(df)
            results['columns'] = len(df.columns)
            results['has_headers'] = not df.columns[0].startswith('Unnamed')
            results['delimiter'] = ','  # CSV assumed
            
            # Check for critical data issues
            if results['rows'] == 0:
                results['issues'].append('CRITICAL: File has no data rows')
                self.critical_issues.append(f"{filepath}: No data rows")
            
            if results['columns'] == 0:
                results['issues'].append('CRITICAL: File has no columns')
                self.critical_issues.append(f"{filepath}: No columns")
                
            # Check for unnamed columns (potential parsing issue)
            unnamed_cols = [col for col in df.columns if col.startswith('Unnamed')]
            if unnamed_cols:
                results['issues'].append(f'Found {len(unnamed_cols)} unnamed columns - possible parsing issue')
            
        except Exception as e:
            results['issues'].append(f'Error reading file: {str(e)}')
            self.critical_issues.append(f"{filepath}: {str(e)}")
        
        return results
    
    def validate_data_integrity(self, filepath: Path) -> Dict[str, Any]:
        """Validate data integrity - no modifications, only reporting."""
        results = {
            'file': str(filepath),
            'null_counts': {},
            'duplicate_rows': 0,
            'data_types': {},
            'value_ranges': {},
            'integrity_issues': []
        }
        
        try:
            df = pd.read_csv(filepath)
            
            # Count nulls per column
            null_counts = df.isnull().sum()
            results['null_counts'] = null_counts.to_dict()
            
            # Count exact duplicate rows
            results['duplicate_rows'] = df.duplicated().sum()
            if results['duplicate_rows'] > 0:
                self.data_integrity_issues.append(
                    f"{filepath.name}: {results['duplicate_rows']} duplicate rows found"
                )
            
            # Check data types
            for col in df.columns:
                results['data_types'][col] = str(df[col].dtype)
                
                # For numeric columns, get range
                if pd.api.types.is_numeric_dtype(df[col]):
                    results['value_ranges'][col] = {
                        'min': float(df[col].min()) if not pd.isna(df[col].min()) else None,
                        'max': float(df[col].max()) if not pd.isna(df[col].max()) else None,
                        'mean': float(df[col].mean()) if not pd.isna(df[col].mean()) else None,
                        'nulls': int(df[col].isnull().sum())
                    }
            
            # Check for data integrity issues
            # Check if numeric columns have text
            for col in df.columns:
                if 'points' in col.lower() or 'yards' in col.lower() or 'value' in col.lower():
                    # These should be numeric
                    non_numeric = df[~df[col].apply(lambda x: pd.isna(x) or isinstance(x, (int, float)))]
                    if len(non_numeric) > 0:
                        results['integrity_issues'].append(
                            f"Column '{col}' has {len(non_numeric)} non-numeric values but appears to be numeric data"
                        )
            
        except Exception as e:
            results['integrity_issues'].append(f'Error validating: {str(e)}')
        
        return results
    
    def validate_player_data(self, filepath: Path) -> Dict[str, Any]:
        """Validate player data specifically - critical for fantasy accuracy."""
        results = {
            'file': str(filepath),
            'player_columns': [],
            'unique_players': 0,
            'position_distribution': {},
            'team_distribution': {},
            'name_issues': []
        }
        
        try:
            df = pd.read_csv(filepath)
            
            # Identify player columns
            player_cols = [col for col in df.columns if any(
                term in col.lower() for term in ['player', 'name']
            )]
            results['player_columns'] = player_cols
            
            if not player_cols:
                return results
            
            player_col = player_cols[0]
            
            # Count unique players
            results['unique_players'] = df[player_col].nunique()
            
            # Position distribution if exists
            pos_cols = [col for col in df.columns if 'position' in col.lower() or col.lower() == 'pos']
            if pos_cols:
                pos_col = pos_cols[0]
                results['position_distribution'] = df[pos_col].value_counts().to_dict()
                
                # Check for invalid positions
                valid_positions = {'QB', 'RB', 'WR', 'TE', 'K', 'DST', 'DEF', 'FLEX', 'D/ST'}
                invalid_pos = df[~df[pos_col].str.upper().isin(valid_positions)][pos_col].unique()
                if len(invalid_pos) > 0:
                    results['name_issues'].append(f"Invalid positions found: {list(invalid_pos)}")
            
            # Team distribution if exists
            team_cols = [col for col in df.columns if 'team' in col.lower() or col.lower() in ['tm', 'club']]
            if team_cols:
                team_col = team_cols[0]
                results['team_distribution'] = df[team_col].value_counts().to_dict()
            
            # Check for player name issues
            # Look for names that might be malformed
            if player_col in df.columns:
                # Check for empty names
                empty_names = df[df[player_col].isna() | (df[player_col] == '')].shape[0]
                if empty_names > 0:
                    results['name_issues'].append(f"{empty_names} rows with empty player names")
                    self.critical_issues.append(f"{filepath.name}: {empty_names} empty player names")
                
                # Check for suspiciously short names
                if not df.empty:
                    short_names = df[df[player_col].str.len() < 3].shape[0]
                    if short_names > 0:
                        results['name_issues'].append(f"{short_names} suspiciously short player names")
        
        except Exception as e:
            results['name_issues'].append(f'Error in player validation: {str(e)}')
        
        return results
    
    def validate_statistical_data(self, filepath: Path) -> Dict[str, Any]:
        """Validate statistical columns for impossible values."""
        results = {
            'file': str(filepath),
            'statistical_issues': [],
            'negative_values': {},
            'excessive_values': {}
        }
        
        try:
            df = pd.read_csv(filepath)
            
            # Check for negative values in columns that shouldn't have them
            non_negative_patterns = ['yards', 'attempts', 'completions', 'touchdowns', 'receptions', 
                                    'targets', 'carries', 'points', 'games']
            
            for col in df.columns:
                col_lower = col.lower()
                if any(pattern in col_lower for pattern in non_negative_patterns):
                    if pd.api.types.is_numeric_dtype(df[col]):
                        negative_count = (df[col] < 0).sum()
                        if negative_count > 0:
                            results['negative_values'][col] = int(negative_count)
                            results['statistical_issues'].append(
                                f"Column '{col}' has {negative_count} negative values"
                            )
            
            # Check for impossibly high values
            max_thresholds = {
                'passing_yards': 6000,  # Season max
                'rushing_yards': 2500,  # Season max
                'receiving_yards': 2000,  # Season max
                'touchdowns': 50,  # Any TD type season max
                'games': 17,  # Regular season max
                'receptions': 150,  # Season max
                'fantasy_points': 500  # Season max PPR
            }
            
            for col in df.columns:
                col_lower = col.lower()
                for stat_type, threshold in max_thresholds.items():
                    if stat_type in col_lower.replace('_', ''):
                        if pd.api.types.is_numeric_dtype(df[col]):
                            excessive = (df[col] > threshold).sum()
                            if excessive > 0:
                                max_val = df[col].max()
                                results['excessive_values'][col] = {
                                    'count': int(excessive),
                                    'max_value': float(max_val),
                                    'threshold': threshold
                                }
                                results['statistical_issues'].append(
                                    f"Column '{col}' has {excessive} values above {threshold} (max: {max_val})"
                                )
        
        except Exception as e:
            results['statistical_issues'].append(f'Error in statistical validation: {str(e)}')
        
        return results
    
    def cross_validate_files(self, files_by_category: Dict[str, List[Path]]) -> Dict[str, Any]:
        """Cross-validate related files for consistency."""
        results = {
            'player_consistency': {},
            'team_consistency': {},
            'cross_file_issues': []
        }
        
        # Collect all unique players across all files
        all_players = {}  # file -> set of players
        all_teams = {}    # file -> set of teams
        
        for category, files in files_by_category.items():
            for filepath in files:
                try:
                    df = pd.read_csv(filepath)
                    
                    # Find player columns
                    player_cols = [col for col in df.columns if any(
                        term in col.lower() for term in ['player', 'name']
                    ) and 'team' not in col.lower()]
                    
                    if player_cols:
                        players = set()
                        for col in player_cols:
                            players.update(df[col].dropna().unique())
                        all_players[filepath.name] = players
                    
                    # Find team columns
                    team_cols = [col for col in df.columns if any(
                        term in col.lower() for term in ['team', 'tm', 'club']
                    )]
                    
                    if team_cols:
                        teams = set()
                        for col in team_cols:
                            teams.update(df[col].dropna().unique())
                        all_teams[filepath.name] = teams
                
                except Exception as e:
                    logger.warning(f"Could not read {filepath} for cross-validation: {e}")
        
        # Check player consistency across projection and ADP files
        proj_files = [f for f in all_players.keys() if 'projection' in f.lower()]
        adp_files = [f for f in all_players.keys() if 'adp' in f.lower()]
        
        if proj_files and adp_files:
            # Compare each projection file with each ADP file
            for proj_file in proj_files:
                for adp_file in adp_files:
                    proj_players = all_players.get(proj_file, set())
                    adp_players = all_players.get(adp_file, set())
                    
                    if proj_players and adp_players:
                        only_proj = proj_players - adp_players
                        only_adp = adp_players - proj_players
                        
                        results['player_consistency'][f"{proj_file}_vs_{adp_file}"] = {
                            'only_in_projections': len(only_proj),
                            'only_in_adp': len(only_adp),
                            'common_players': len(proj_players & adp_players)
                        }
                        
                        if len(only_proj) > 100 or len(only_adp) > 100:
                            results['cross_file_issues'].append(
                                f"Large player mismatch between {proj_file} and {adp_file}"
                            )
        
        # Check team consistency
        unique_teams = set()
        for teams in all_teams.values():
            unique_teams.update(teams)
        
        results['team_consistency']['unique_teams_found'] = len(unique_teams)
        # Convert all to strings to avoid type mismatch in sorting
        results['team_consistency']['teams_list'] = sorted([str(t) for t in unique_teams])
        
        return results
    
    def run_comprehensive_validation(self):
        """Run validation on ALL files without modifying any data."""
        logger.info("=" * 60)
        logger.info("COMPREHENSIVE VALIDATION OF ALL CANONICAL DATA")
        logger.info("=" * 60)
        
        # Discover all files
        files_by_category = self.discover_all_files()
        
        all_results = {
            'timestamp': datetime.now().isoformat(),
            'total_files': sum(len(files) for files in files_by_category.values()),
            'categories': list(files_by_category.keys()),
            'file_validations': [],
            'critical_issues': [],
            'data_integrity_issues': [],
            'summary': {}
        }
        
        # Validate each file
        for category, files in files_by_category.items():
            logger.info(f"\nValidating category: {category} ({len(files)} files)")
            
            for filepath in files:
                logger.info(f"  Validating: {filepath.name}")
                
                file_result = {
                    'file': str(filepath),
                    'category': category,
                    'structure': self.validate_file_structure(filepath),
                    'integrity': self.validate_data_integrity(filepath),
                    'player_data': self.validate_player_data(filepath),
                    'statistics': self.validate_statistical_data(filepath)
                }
                
                all_results['file_validations'].append(file_result)
        
        # Cross-validation
        logger.info("\nPerforming cross-file validation...")
        all_results['cross_validation'] = self.cross_validate_files(files_by_category)
        
        # Compile critical issues
        all_results['critical_issues'] = self.critical_issues
        all_results['data_integrity_issues'] = self.data_integrity_issues
        
        # Generate summary
        all_results['summary'] = {
            'files_validated': len(all_results['file_validations']),
            'files_with_issues': sum(1 for f in all_results['file_validations'] 
                                   if f['structure']['issues'] or 
                                   f['integrity']['integrity_issues'] or
                                   f['player_data']['name_issues'] or
                                   f['statistics']['statistical_issues']),
            'critical_issue_count': len(self.critical_issues),
            'integrity_issue_count': len(self.data_integrity_issues),
            'files_with_duplicates': sum(1 for f in all_results['file_validations'] 
                                        if f['integrity']['duplicate_rows'] > 0),
            'total_duplicate_rows': sum(f['integrity']['duplicate_rows'] 
                                       for f in all_results['file_validations'])
        }
        
        # Save comprehensive report
        report_path = self.reports_path / f"comprehensive_validation_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(report_path, 'w') as f:
            json.dump(all_results, f, indent=2, default=str)
        
        logger.info(f"\nValidation complete. Report saved to: {report_path}")
        
        # Print summary
        print("\n" + "=" * 60)
        print("VALIDATION SUMMARY")
        print("=" * 60)
        print(f"Total files validated: {all_results['summary']['files_validated']}")
        print(f"Files with issues: {all_results['summary']['files_with_issues']}")
        print(f"Critical issues: {all_results['summary']['critical_issue_count']}")
        print(f"Data integrity issues: {all_results['summary']['integrity_issue_count']}")
        print(f"Files with duplicate rows: {all_results['summary']['files_with_duplicates']}")
        print(f"Total duplicate rows: {all_results['summary']['total_duplicate_rows']}")
        
        if self.critical_issues:
            print("\nCRITICAL ISSUES FOUND:")
            for issue in self.critical_issues[:5]:
                print(f"  - {issue}")
            if len(self.critical_issues) > 5:
                print(f"  ... and {len(self.critical_issues) - 5} more")
        
        return all_results


if __name__ == '__main__':
    validator = ComprehensiveDataValidator()
    results = validator.run_comprehensive_validation()