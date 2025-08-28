#!/usr/bin/env python3
"""
Comprehensive Data Validation Suite
Validates schemas, foreign keys, valuation invariants, and canonical_data immutability.

Author: Data Provenance & Valuation Auditor
Date: 2025-08-27
"""

import csv
import hashlib
import json
import logging
import os
import sys
from collections import defaultdict
from dataclasses import dataclass, asdict
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple
import warnings

# Try to import pandera, fall back to pandas if not available
try:
    import pandera as pa
    from pandera import Column, DataFrameSchema, Check
    import pandera.errors
    HAS_PANDERA = True
except ImportError:
    HAS_PANDERA = False
    print("Warning: pandera not available, using pandas validation fallback")

import pandas as pd
import numpy as np

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Paths
PROJECT_ROOT = Path("/mnt/c/Users/giraf/Documents/projects/fftool")
CANONICAL_DATA_PATH = PROJECT_ROOT / "canonical_data"
SPECS_PATH = PROJECT_ROOT / "specs"
REPORTS_PATH = PROJECT_ROOT / "reports"
VALIDATION_REPORTS_PATH = REPORTS_PATH / "validation"

# Ensure directories exist
VALIDATION_REPORTS_PATH.mkdir(parents=True, exist_ok=True)

# Load data dictionary
DATA_DICT_PATH = SPECS_PATH / "data_dictionary.json"
INTEGRITY_REPORT_PATH = REPORTS_PATH / "canonical_data_integrity.json"


@dataclass
class ValidationResult:
    """Result of a validation check."""
    check_name: str
    passed: bool
    errors: List[str]
    warnings: List[str]
    details: Dict[str, Any]
    offending_keys: List[Any]


@dataclass
class FileValidationReport:
    """Validation report for a single file."""
    file_path: str
    total_checks: int
    passed_checks: int
    failed_checks: int
    schema_errors: List[Dict[str, Any]]
    duplicate_rows: List[Dict[str, Any]]
    missing_values: Dict[str, int]
    type_errors: List[Dict[str, Any]]
    range_errors: List[Dict[str, Any]]
    uniqueness_violations: List[Dict[str, Any]]


class DataValidator:
    """Comprehensive data validation suite."""
    
    def __init__(self):
        """Initialize validator with data dictionary and integrity baseline."""
        self.data_dict = self._load_data_dictionary()
        self.integrity_baseline = self._load_integrity_baseline()
        self.validation_results: List[ValidationResult] = []
        self.file_reports: Dict[str, FileValidationReport] = {}
        self.loaded_data: Dict[str, pd.DataFrame] = {}
        
    def _load_data_dictionary(self) -> Dict[str, Any]:
        """Load data dictionary specification."""
        if DATA_DICT_PATH.exists():
            with open(DATA_DICT_PATH, 'r') as f:
                return json.load(f)
        else:
            logger.warning(f"Data dictionary not found at {DATA_DICT_PATH}")
            return {}
    
    def _load_integrity_baseline(self) -> Dict[str, Any]:
        """Load integrity baseline for immutability check."""
        if INTEGRITY_REPORT_PATH.exists():
            with open(INTEGRITY_REPORT_PATH, 'r') as f:
                return json.load(f)
        else:
            logger.warning(f"Integrity baseline not found at {INTEGRITY_REPORT_PATH}")
            return {}
    
    def compute_file_hash(self, filepath: Path) -> str:
        """Compute SHA256 hash of a file."""
        sha256_hash = hashlib.sha256()
        with open(filepath, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()
    
    def validate_immutability(self) -> ValidationResult:
        """Verify canonical_data hasn't been modified."""
        logger.info("Validating canonical_data immutability...")
        
        errors = []
        offending_keys = []
        
        if not self.integrity_baseline:
            return ValidationResult(
                check_name="immutability_check",
                passed=False,
                errors=["No integrity baseline available"],
                warnings=[],
                details={},
                offending_keys=[]
            )
        
        baseline_files = {f['relativePath']: f for f in self.integrity_baseline.get('files', [])}
        
        # Check each file in baseline
        for rel_path, baseline_info in baseline_files.items():
            file_path = CANONICAL_DATA_PATH / rel_path
            
            if not file_path.exists():
                errors.append(f"Missing file: {rel_path}")
                offending_keys.append(rel_path)
                continue
            
            current_hash = self.compute_file_hash(file_path)
            if current_hash != baseline_info['sha256']:
                errors.append(f"Hash mismatch for {rel_path}")
                offending_keys.append({
                    'file': rel_path,
                    'expected': baseline_info['sha256'],
                    'actual': current_hash
                })
        
        # Check for new unexpected files
        for csv_file in CANONICAL_DATA_PATH.rglob("*.csv"):
            rel_path = csv_file.relative_to(CANONICAL_DATA_PATH)
            if str(rel_path) not in baseline_files:
                errors.append(f"Unexpected file: {rel_path}")
                offending_keys.append(str(rel_path))
        
        return ValidationResult(
            check_name="immutability_check",
            passed=len(errors) == 0,
            errors=errors,
            warnings=[],
            details={
                'files_checked': len(baseline_files),
                'hash_mismatches': len([e for e in errors if 'Hash mismatch' in e]),
                'missing_files': len([e for e in errors if 'Missing file' in e]),
                'unexpected_files': len([e for e in errors if 'Unexpected file' in e])
            },
            offending_keys=offending_keys
        )
    
    def load_csv_data(self, filepath: Path) -> pd.DataFrame:
        """Load CSV data for validation."""
        if str(filepath) in self.loaded_data:
            return self.loaded_data[str(filepath)]
        
        try:
            df = pd.read_csv(filepath, encoding='utf-8-sig')
            self.loaded_data[str(filepath)] = df
            return df
        except Exception as e:
            logger.error(f"Failed to load {filepath}: {e}")
            return pd.DataFrame()
    
    def validate_schema(self, filepath: Path, df: pd.DataFrame) -> List[Dict[str, Any]]:
        """Validate DataFrame against expected schema."""
        errors = []
        filename = filepath.name
        
        # Get expected schema from data dictionary
        if filename == "projections_2025.csv":
            expected_columns = {
                'playerName': 'object',
                'teamName': 'object', 
                'position': 'object',
                'fantasyPoints': 'float64',
                'auctionValue': 'float64'
            }
        elif filename == "adp0_2025.csv":
            expected_columns = {
                'Full Name': 'object',
                'Team Abbreviation': 'object',
                'Position': 'object',
                'ADP': 'float64',
                'Auction Value': 'object'  # Can be "N/A"
            }
        else:
            # Default validation
            return errors
        
        # Check for missing columns
        for col, dtype in expected_columns.items():
            if col not in df.columns:
                errors.append({
                    'type': 'missing_column',
                    'column': col,
                    'expected': dtype
                })
        
        # Check data types
        for col in df.columns:
            if col in expected_columns:
                expected_dtype = expected_columns[col]
                actual_dtype = str(df[col].dtype)
                
                # Allow compatible types
                if expected_dtype == 'float64' and actual_dtype in ['int64', 'float64']:
                    continue
                if expected_dtype == 'object' and actual_dtype == 'object':
                    continue
                    
                if actual_dtype != expected_dtype:
                    errors.append({
                        'type': 'dtype_mismatch',
                        'column': col,
                        'expected': expected_dtype,
                        'actual': actual_dtype
                    })
        
        return errors
    
    def validate_duplicates(self, filepath: Path, df: pd.DataFrame) -> List[Dict[str, Any]]:
        """Check for duplicate rows."""
        duplicates = []
        filename = filepath.name
        
        # Define key columns for each file type
        if filename == "projections_2025.csv":
            key_cols = ['playerName', 'position', 'teamName']
        elif filename == "adp0_2025.csv":
            key_cols = ['Full Name', 'Position', 'Team Abbreviation']
        else:
            # Check for any exact duplicates
            key_cols = list(df.columns)
        
        # Filter to existing columns
        key_cols = [col for col in key_cols if col in df.columns]
        
        if key_cols:
            # Find duplicates
            duplicated = df[df.duplicated(subset=key_cols, keep=False)]
            
            if not duplicated.empty:
                # Group duplicates
                for _, group in duplicated.groupby(key_cols):
                    duplicates.append({
                        'key_columns': key_cols,
                        'key_values': {col: group.iloc[0][col] for col in key_cols},
                        'count': len(group),
                        'row_numbers': group.index.tolist()
                    })
        
        return duplicates
    
    def validate_missing_values(self, df: pd.DataFrame) -> Dict[str, int]:
        """Count missing values per column."""
        missing = {}
        for col in df.columns:
            null_count = df[col].isna().sum()
            if null_count > 0:
                missing[col] = int(null_count)
        return missing
    
    def validate_ranges(self, filepath: Path, df: pd.DataFrame) -> List[Dict[str, Any]]:
        """Validate numeric ranges."""
        errors = []
        filename = filepath.name
        
        # Define range constraints
        if filename == "projections_2025.csv":
            ranges = {
                'fantasyPoints': (0, 500),
                'auctionValue': (0, 200),
                'byeWeek': (1, 18),
                'games': (0, 17)
            }
        elif filename == "adp0_2025.csv":
            ranges = {
                'ADP': (1, 300),
                'Overall Rank': (1, 600),
                'Position Rank': (1, 200),
                'Bye Week': (1, 18)
            }
        else:
            return errors
        
        for col, (min_val, max_val) in ranges.items():
            if col in df.columns:
                # Convert to numeric, coercing errors to NaN
                numeric_col = pd.to_numeric(df[col], errors='coerce')
                
                # Find out of range values
                out_of_range = df[(numeric_col < min_val) | (numeric_col > max_val)]
                
                if not out_of_range.empty:
                    for idx, row in out_of_range.iterrows():
                        errors.append({
                            'type': 'range_violation',
                            'column': col,
                            'row': int(idx),
                            'value': row[col],
                            'expected_range': [min_val, max_val]
                        })
        
        return errors
    
    def validate_foreign_keys(self) -> ValidationResult:
        """Validate referential integrity across files."""
        logger.info("Validating foreign key relationships...")
        
        errors = []
        offending_keys = []
        
        # Load key datasets
        projections_path = CANONICAL_DATA_PATH / "projections" / "projections_2025.csv"
        adp_path = CANONICAL_DATA_PATH / "adp" / "adp0_2025.csv"
        
        if projections_path.exists() and adp_path.exists():
            proj_df = self.load_csv_data(projections_path)
            adp_df = self.load_csv_data(adp_path)
            
            # Create player keys
            proj_players = set()
            for _, row in proj_df.iterrows():
                if pd.notna(row.get('playerName')):
                    key = f"{row['playerName']}_{row.get('position', '')}".lower()
                    proj_players.add(key)
            
            adp_players = set()
            for _, row in adp_df.iterrows():
                if pd.notna(row.get('Full Name')):
                    key = f"{row['Full Name']}_{row.get('Position', '')}".lower()
                    adp_players.add(key)
            
            # Find mismatches
            only_in_proj = proj_players - adp_players
            only_in_adp = adp_players - proj_players
            
            if only_in_proj:
                sample = list(only_in_proj)[:10]
                errors.append(f"Players in projections but not in ADP: {len(only_in_proj)}")
                offending_keys.extend([{'source': 'projections', 'key': k} for k in sample])
            
            if only_in_adp:
                sample = list(only_in_adp)[:10]
                errors.append(f"Players in ADP but not in projections: {len(only_in_adp)}")
                offending_keys.extend([{'source': 'adp', 'key': k} for k in sample])
        
        return ValidationResult(
            check_name="foreign_key_check",
            passed=len(errors) == 0,
            errors=errors,
            warnings=[],
            details={
                'tables_checked': 2,
                'mismatches': len(offending_keys)
            },
            offending_keys=offending_keys
        )
    
    def validate_valuation_invariants(self) -> ValidationResult:
        """Check valuation invariants from the data dictionary."""
        logger.info("Validating valuation invariants...")
        
        errors = []
        warnings = []
        offending_keys = []
        details = {}
        
        # Load projections for invariant checks
        proj_path = CANONICAL_DATA_PATH / "projections" / "projections_2025.csv"
        if not proj_path.exists():
            return ValidationResult(
                check_name="valuation_invariants",
                passed=False,
                errors=["Projections file not found"],
                warnings=[],
                details={},
                offending_keys=[]
            )
        
        df = self.load_csv_data(proj_path)
        
        # 1. Budget conservation (auction values should be reasonable)
        if 'auctionValue' in df.columns:
            auction_values = pd.to_numeric(df['auctionValue'], errors='coerce')
            total_value = auction_values.sum()
            expected_total = 200 * 12  # $200 per team, 12 teams
            
            if abs(total_value - expected_total) > expected_total * 0.2:
                errors.append(f"Budget conservation violated: total=${total_value:.0f}, expected~${expected_total}")
                details['total_auction_value'] = float(total_value)
        
        # 2. Replacement level check (should be positive for top players)
        if 'position' in df.columns and 'fantasyPoints' in df.columns:
            for pos in ['QB', 'RB', 'WR', 'TE']:
                pos_df = df[df['position'] == pos].copy()
                if len(pos_df) > 0:
                    pos_df = pos_df.sort_values('fantasyPoints', ascending=False)
                    
                    # Get replacement level (12th QB, 24th RB, 36th WR, 12th TE for 12-team league)
                    replacement_idx = {'QB': 12, 'RB': 24, 'WR': 36, 'TE': 12}.get(pos, 12)
                    
                    if len(pos_df) > replacement_idx:
                        replacement_level = pos_df.iloc[replacement_idx]['fantasyPoints']
                        top_player = pos_df.iloc[0]['fantasyPoints']
                        
                        vorp = top_player - replacement_level
                        if vorp <= 0:
                            errors.append(f"VORP violation for {pos}: top player has non-positive VORP")
                            offending_keys.append({
                                'position': pos,
                                'top_player_points': float(top_player),
                                'replacement_level': float(replacement_level)
                            })
                        
                        details[f'{pos}_replacement_level'] = float(replacement_level)
                        details[f'{pos}_top_vorp'] = float(vorp)
        
        # 3. Non-negativity check
        numeric_cols = ['fantasyPoints', 'auctionValue', 'passYds', 'rushYds', 'recvYds']
        for col in numeric_cols:
            if col in df.columns:
                values = pd.to_numeric(df[col], errors='coerce')
                negative_count = (values < 0).sum()
                if negative_count > 0:
                    errors.append(f"Non-negativity violation: {negative_count} negative values in {col}")
                    negative_rows = df[values < 0].head(5)
                    offending_keys.extend([
                        {'column': col, 'row': int(idx), 'value': float(row[col])}
                        for idx, row in negative_rows.iterrows()
                    ])
        
        # 4. Positional scarcity (RB/WR should have steeper drop-offs than QB)
        if 'position' in df.columns and 'fantasyPoints' in df.columns:
            drop_offs = {}
            for pos in ['QB', 'RB', 'WR']:
                pos_df = df[df['position'] == pos].sort_values('fantasyPoints', ascending=False)
                if len(pos_df) >= 10:
                    # Calculate drop-off from 1st to 10th
                    drop_off = pos_df.iloc[0]['fantasyPoints'] - pos_df.iloc[9]['fantasyPoints']
                    drop_offs[pos] = float(drop_off)
            
            if 'QB' in drop_offs and 'RB' in drop_offs:
                if drop_offs['QB'] > drop_offs['RB']:
                    warnings.append(f"Positional scarcity warning: QB drop-off ({drop_offs['QB']:.1f}) > RB drop-off ({drop_offs['RB']:.1f})")
            
            details['positional_dropoffs'] = drop_offs
        
        # 5. Monotonicity (auction values should generally decrease with rank)
        if 'auctionValue' in df.columns and 'fantasyPointsRank' in df.columns:
            sorted_df = df.sort_values('fantasyPointsRank')
            auction_values = pd.to_numeric(sorted_df['auctionValue'], errors='coerce').fillna(0)
            
            inversions = 0
            for i in range(1, len(auction_values)):
                if auction_values.iloc[i] > auction_values.iloc[i-1] * 1.5:  # Allow some variance
                    inversions += 1
            
            if inversions > len(df) * 0.1:  # More than 10% inversions
                warnings.append(f"Monotonicity warning: {inversions} auction value inversions")
                details['monotonicity_inversions'] = inversions
        
        return ValidationResult(
            check_name="valuation_invariants",
            passed=len(errors) == 0,
            errors=errors,
            warnings=warnings,
            details=details,
            offending_keys=offending_keys[:20]  # Limit to first 20
        )
    
    def validate_file(self, filepath: Path) -> FileValidationReport:
        """Validate a single CSV file."""
        logger.info(f"Validating {filepath.name}...")
        
        df = self.load_csv_data(filepath)
        
        if df.empty:
            return FileValidationReport(
                file_path=str(filepath),
                total_checks=0,
                passed_checks=0,
                failed_checks=0,
                schema_errors=[{'error': 'Failed to load file'}],
                duplicate_rows=[],
                missing_values={},
                type_errors=[],
                range_errors=[],
                uniqueness_violations=[]
            )
        
        # Run validations
        schema_errors = self.validate_schema(filepath, df)
        duplicate_rows = self.validate_duplicates(filepath, df)
        missing_values = self.validate_missing_values(df)
        range_errors = self.validate_ranges(filepath, df)
        
        # Count checks
        total_checks = 4  # schema, duplicates, missing, ranges
        failed_checks = sum([
            len(schema_errors) > 0,
            len(duplicate_rows) > 0,
            len(missing_values) > 0,
            len(range_errors) > 0
        ])
        
        return FileValidationReport(
            file_path=str(filepath),
            total_checks=total_checks,
            passed_checks=total_checks - failed_checks,
            failed_checks=failed_checks,
            schema_errors=schema_errors,
            duplicate_rows=duplicate_rows,
            missing_values=missing_values,
            type_errors=[],  # Included in schema_errors
            range_errors=range_errors,
            uniqueness_violations=duplicate_rows
        )
    
    def run_validation_suite(self) -> Dict[str, Any]:
        """Run complete validation suite."""
        logger.info("="*60)
        logger.info("STARTING COMPREHENSIVE DATA VALIDATION")
        logger.info("="*60)
        
        start_time = datetime.now()
        
        # 1. Check immutability
        immutability_result = self.validate_immutability()
        self.validation_results.append(immutability_result)
        
        # 2. Validate individual files
        csv_files = list(CANONICAL_DATA_PATH.rglob("*.csv"))
        logger.info(f"Found {len(csv_files)} CSV files to validate")
        
        for csv_file in csv_files[:20]:  # Limit to first 20 for performance
            report = self.validate_file(csv_file)
            self.file_reports[csv_file.name] = report
        
        # 3. Check foreign keys
        fk_result = self.validate_foreign_keys()
        self.validation_results.append(fk_result)
        
        # 4. Check valuation invariants
        invariant_result = self.validate_valuation_invariants()
        self.validation_results.append(invariant_result)
        
        # Generate summary
        duration = (datetime.now() - start_time).total_seconds()
        
        summary = {
            'validation_timestamp': datetime.now().isoformat(),
            'duration_seconds': duration,
            'files_validated': len(self.file_reports),
            'total_checks': sum(r.total_checks for r in self.file_reports.values()) + len(self.validation_results),
            'passed_checks': sum(r.passed_checks for r in self.file_reports.values()) + sum(1 for r in self.validation_results if r.passed),
            'failed_checks': sum(r.failed_checks for r in self.file_reports.values()) + sum(1 for r in self.validation_results if not r.passed),
            'immutability_check': immutability_result.passed,
            'foreign_key_check': fk_result.passed,
            'invariants_check': invariant_result.passed,
            'critical_errors': [],
            'warnings': []
        }
        
        # Collect critical errors
        for result in self.validation_results:
            if not result.passed:
                summary['critical_errors'].extend(result.errors[:5])
            summary['warnings'].extend(result.warnings[:5])
        
        # Save reports
        self.save_reports(summary)
        
        return summary
    
    def save_reports(self, summary: Dict[str, Any]):
        """Save validation reports to JSON files."""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Save individual file reports
        for filename, report in self.file_reports.items():
            report_path = VALIDATION_REPORTS_PATH / f"{filename}_{timestamp}.json"
            with open(report_path, 'w') as f:
                json.dump(asdict(report), f, indent=2, default=str)
        
        # Save validation results
        for result in self.validation_results:
            report_path = VALIDATION_REPORTS_PATH / f"{result.check_name}_{timestamp}.json"
            with open(report_path, 'w') as f:
                json.dump(asdict(result), f, indent=2, default=str)
        
        # Save summary
        summary_path = REPORTS_PATH / "validation_summary.json"
        with open(summary_path, 'w') as f:
            json.dump(summary, f, indent=2, default=str)
        
        logger.info(f"Reports saved to {VALIDATION_REPORTS_PATH}")
        logger.info(f"Summary saved to {summary_path}")


def main():
    """Main entry point."""
    validator = DataValidator()
    summary = validator.run_validation_suite()
    
    # Print results
    print("\n" + "="*60)
    print("VALIDATION COMPLETE")
    print("="*60)
    print(json.dumps({
        "status": "complete",
        "pass_count": summary['passed_checks'],
        "fail_count": summary['failed_checks'],
        "total_checks": summary['total_checks'],
        "immutability": "PASS" if summary['immutability_check'] else "FAIL",
        "foreign_keys": "PASS" if summary['foreign_key_check'] else "FAIL",
        "invariants": "PASS" if summary['invariants_check'] else "FAIL",
        "reports_path": str(VALIDATION_REPORTS_PATH),
        "summary_path": str(REPORTS_PATH / "validation_summary.json"),
        "critical_errors": summary['critical_errors'][:3],
        "warnings": summary['warnings'][:3]
    }, indent=2))
    
    return 0 if summary['failed_checks'] == 0 else 1


if __name__ == '__main__':
    sys.exit(main())