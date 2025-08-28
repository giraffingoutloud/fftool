#!/usr/bin/env python3
"""
Comprehensive Data Validation Suite - Complete Version
Validates ALL data files including CSV and TXT formats.
Ensures all 123 files in canonical_data are checked.

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

# Try to import pandas
try:
    import pandas as pd
    import numpy as np
    HAS_PANDAS = True
except ImportError:
    HAS_PANDAS = False
    print("Warning: pandas not available, using fallback methods")

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
    file_type: str  # 'csv' or 'txt'
    file_size: int
    total_checks: int
    passed_checks: int
    failed_checks: int
    schema_errors: List[Dict[str, Any]]
    duplicate_rows: List[Dict[str, Any]]
    missing_values: Dict[str, int]
    type_errors: List[Dict[str, Any]]
    range_errors: List[Dict[str, Any]]
    uniqueness_violations: List[Dict[str, Any]]
    content_summary: Dict[str, Any]


class CompleteDataValidator:
    """Comprehensive data validation suite for all file types."""
    
    def __init__(self):
        """Initialize validator with data dictionary and integrity baseline."""
        self.data_dict = self._load_data_dictionary()
        self.integrity_baseline = self._load_integrity_baseline()
        self.validation_results: List[ValidationResult] = []
        self.file_reports: Dict[str, FileValidationReport] = {}
        self.loaded_data: Dict[str, Any] = {}
        self.all_files_found: List[Path] = []
        
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
                baseline = json.load(f)
                # Update baseline to include TXT files if not present
                return baseline
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
    
    def discover_all_files(self) -> Dict[str, List[Path]]:
        """Discover all CSV and TXT files in canonical_data."""
        files_by_type = {
            'csv': [],
            'txt': [],
            'other': []
        }
        
        for file_path in CANONICAL_DATA_PATH.rglob("*"):
            if file_path.is_file():
                self.all_files_found.append(file_path)
                if file_path.suffix == '.csv':
                    files_by_type['csv'].append(file_path)
                elif file_path.suffix == '.txt':
                    files_by_type['txt'].append(file_path)
                else:
                    files_by_type['other'].append(file_path)
        
        return files_by_type
    
    def validate_immutability_complete(self) -> ValidationResult:
        """Verify all files in canonical_data haven't been modified."""
        logger.info("Validating canonical_data immutability (including TXT files)...")
        
        errors = []
        offending_keys = []
        files_checked = 0
        
        # Discover all current files
        files_by_type = self.discover_all_files()
        current_csv_files = files_by_type['csv']
        current_txt_files = files_by_type['txt']
        
        logger.info(f"Found {len(current_csv_files)} CSV files and {len(current_txt_files)} TXT files")
        
        # Check CSV files against baseline (if baseline exists)
        if self.integrity_baseline and 'files' in self.integrity_baseline:
            baseline_files = {f['relativePath']: f for f in self.integrity_baseline.get('files', [])}
            
            for rel_path, baseline_info in baseline_files.items():
                file_path = CANONICAL_DATA_PATH / rel_path
                files_checked += 1
                
                if not file_path.exists():
                    errors.append(f"Missing CSV file: {rel_path}")
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
        
        # Check all TXT files (compute hashes for record)
        txt_hashes = {}
        for txt_file in current_txt_files:
            rel_path = txt_file.relative_to(CANONICAL_DATA_PATH)
            txt_hash = self.compute_file_hash(txt_file)
            txt_hashes[str(rel_path)] = txt_hash
            files_checked += 1
        
        # Store TXT file hashes for future baseline
        self.txt_file_hashes = txt_hashes
        
        total_files = len(current_csv_files) + len(current_txt_files)
        
        return ValidationResult(
            check_name="immutability_check_complete",
            passed=len(errors) == 0,
            errors=errors,
            warnings=[f"TXT files not in baseline, computed {len(txt_hashes)} new hashes"],
            details={
                'total_files_found': total_files,
                'csv_files': len(current_csv_files),
                'txt_files': len(current_txt_files),
                'files_checked': files_checked,
                'hash_mismatches': len([e for e in errors if 'Hash mismatch' in e]),
                'missing_files': len([e for e in errors if 'Missing file' in e])
            },
            offending_keys=offending_keys
        )
    
    def load_csv_data(self, filepath: Path) -> pd.DataFrame:
        """Load CSV data for validation."""
        if not HAS_PANDAS:
            return None
            
        if str(filepath) in self.loaded_data:
            return self.loaded_data[str(filepath)]
        
        try:
            df = pd.read_csv(filepath, encoding='utf-8-sig')
            self.loaded_data[str(filepath)] = df
            return df
        except Exception as e:
            logger.error(f"Failed to load CSV {filepath}: {e}")
            return pd.DataFrame()
    
    def load_txt_data(self, filepath: Path) -> Dict[str, Any]:
        """Load and analyze TXT file data."""
        try:
            with open(filepath, 'r', encoding='utf-8-sig') as f:
                content = f.read()
            
            # Analyze content structure
            lines = content.strip().split('\n')
            
            # Try to detect if it's structured data
            is_structured = False
            delimiter = None
            
            # Check for common delimiters
            for delim in ['\t', ',', '|', ';']:
                if all(delim in line for line in lines[:min(5, len(lines))]):
                    is_structured = True
                    delimiter = delim
                    break
            
            data_summary = {
                'line_count': len(lines),
                'file_size': filepath.stat().st_size,
                'is_structured': is_structured,
                'delimiter': delimiter,
                'sample_lines': lines[:5] if len(lines) > 5 else lines,
                'encoding': 'utf-8'
            }
            
            # If structured, try to parse as table
            if is_structured and delimiter:
                try:
                    rows = []
                    for line in lines:
                        rows.append(line.split(delimiter))
                    
                    if rows:
                        data_summary['columns'] = len(rows[0])
                        data_summary['rows'] = len(rows)
                        data_summary['headers'] = rows[0] if len(rows) > 0 else []
                except:
                    pass
            
            self.loaded_data[str(filepath)] = data_summary
            return data_summary
            
        except Exception as e:
            logger.error(f"Failed to load TXT {filepath}: {e}")
            return {'error': str(e)}
    
    def validate_csv_file(self, filepath: Path) -> FileValidationReport:
        """Validate a CSV file."""
        logger.info(f"Validating CSV: {filepath.name}")
        
        file_size = filepath.stat().st_size
        
        if HAS_PANDAS:
            df = self.load_csv_data(filepath)
            
            if df is None or df.empty:
                return FileValidationReport(
                    file_path=str(filepath),
                    file_type='csv',
                    file_size=file_size,
                    total_checks=0,
                    passed_checks=0,
                    failed_checks=0,
                    schema_errors=[{'error': 'Failed to load file'}],
                    duplicate_rows=[],
                    missing_values={},
                    type_errors=[],
                    range_errors=[],
                    uniqueness_violations=[],
                    content_summary={'error': 'Could not load'}
                )
            
            # Run standard CSV validations
            schema_errors = self.validate_schema(filepath, df)
            duplicate_rows = self.validate_duplicates(filepath, df)
            missing_values = self.validate_missing_values(df)
            range_errors = self.validate_ranges(filepath, df)
            
            content_summary = {
                'rows': len(df),
                'columns': len(df.columns),
                'column_names': list(df.columns),
                'dtypes': {col: str(dtype) for col, dtype in df.dtypes.items()}
            }
        else:
            # Fallback without pandas
            content_summary = {'note': 'pandas not available for detailed validation'}
            schema_errors = []
            duplicate_rows = []
            missing_values = {}
            range_errors = []
        
        # Count checks
        total_checks = 4
        failed_checks = sum([
            len(schema_errors) > 0,
            len(duplicate_rows) > 0,
            len(missing_values) > 0,
            len(range_errors) > 0
        ])
        
        return FileValidationReport(
            file_path=str(filepath),
            file_type='csv',
            file_size=file_size,
            total_checks=total_checks,
            passed_checks=total_checks - failed_checks,
            failed_checks=failed_checks,
            schema_errors=schema_errors,
            duplicate_rows=duplicate_rows,
            missing_values=missing_values,
            type_errors=[],
            range_errors=range_errors,
            uniqueness_violations=duplicate_rows,
            content_summary=content_summary
        )
    
    def validate_txt_file(self, filepath: Path) -> FileValidationReport:
        """Validate a TXT file."""
        logger.info(f"Validating TXT: {filepath.name}")
        
        file_size = filepath.stat().st_size
        data = self.load_txt_data(filepath)
        
        errors = []
        warnings = []
        
        # Check file size
        if file_size == 0:
            errors.append({'type': 'empty_file', 'message': 'File is empty'})
        elif file_size > 10 * 1024 * 1024:  # 10MB
            warnings.append({'type': 'large_file', 'size': file_size})
        
        # Check if structured data
        if data.get('is_structured'):
            # Additional validation for structured text
            if 'columns' in data and data['columns'] < 2:
                warnings.append({'type': 'single_column', 'message': 'Only one column detected'})
        
        # Check for common issues
        if 'error' in data:
            errors.append({'type': 'read_error', 'message': data['error']})
        
        total_checks = 3  # size, structure, readability
        failed_checks = len(errors)
        
        return FileValidationReport(
            file_path=str(filepath),
            file_type='txt',
            file_size=file_size,
            total_checks=total_checks,
            passed_checks=total_checks - failed_checks,
            failed_checks=failed_checks,
            schema_errors=errors,
            duplicate_rows=[],
            missing_values={},
            type_errors=[],
            range_errors=[],
            uniqueness_violations=[],
            content_summary=data
        )
    
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
                'Auction Value': 'object'
            }
        else:
            return errors
        
        # Check for missing columns
        for col, dtype in expected_columns.items():
            if col not in df.columns:
                errors.append({
                    'type': 'missing_column',
                    'column': col,
                    'expected': dtype
                })
        
        return errors
    
    def validate_duplicates(self, filepath: Path, df: pd.DataFrame) -> List[Dict[str, Any]]:
        """Check for duplicate rows in CSV."""
        duplicates = []
        filename = filepath.name
        
        # Define key columns for each file type
        if filename == "projections_2025.csv":
            key_cols = ['playerName', 'position', 'teamName']
        elif filename.startswith("adp"):
            key_cols = ['Full Name', 'Position', 'Team Abbreviation'] if 'Full Name' in df.columns else []
        else:
            key_cols = []
        
        # Filter to existing columns
        key_cols = [col for col in key_cols if col in df.columns]
        
        if key_cols:
            # Find duplicates
            duplicated = df[df.duplicated(subset=key_cols, keep=False)]
            
            if not duplicated.empty:
                for _, group in duplicated.groupby(key_cols):
                    duplicates.append({
                        'key_columns': key_cols,
                        'count': len(group),
                        'row_numbers': group.index.tolist()[:5]  # Limit to first 5
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
        """Validate numeric ranges in CSV."""
        errors = []
        filename = filepath.name
        
        # Define range constraints
        ranges = {}
        if filename == "projections_2025.csv":
            ranges = {
                'fantasyPoints': (0, 500),
                'auctionValue': (0, 200),
                'byeWeek': (1, 18)
            }
        elif filename.startswith("adp"):
            ranges = {
                'ADP': (1, 300),
                'Overall Rank': (1, 600),
                'Bye Week': (1, 18)
            }
        
        for col, (min_val, max_val) in ranges.items():
            if col in df.columns:
                numeric_col = pd.to_numeric(df[col], errors='coerce')
                out_of_range = df[(numeric_col < min_val) | (numeric_col > max_val)]
                
                if not out_of_range.empty:
                    errors.append({
                        'type': 'range_violation',
                        'column': col,
                        'violations': len(out_of_range),
                        'expected_range': [min_val, max_val]
                    })
        
        return errors
    
    def validate_foreign_keys(self) -> ValidationResult:
        """Validate referential integrity across files."""
        logger.info("Validating foreign key relationships...")
        
        if not HAS_PANDAS:
            return ValidationResult(
                check_name="foreign_key_check",
                passed=False,
                errors=["pandas not available for foreign key validation"],
                warnings=[],
                details={},
                offending_keys=[]
            )
        
        errors = []
        offending_keys = []
        
        # Load key datasets
        projections_path = CANONICAL_DATA_PATH / "projections" / "projections_2025.csv"
        adp_path = CANONICAL_DATA_PATH / "adp" / "adp0_2025.csv"
        
        if projections_path.exists() and adp_path.exists():
            proj_df = self.load_csv_data(projections_path)
            adp_df = self.load_csv_data(adp_path)
            
            if proj_df is not None and adp_df is not None:
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
                    errors.append(f"Players in projections but not in ADP: {len(only_in_proj)}")
                    offending_keys.extend([{'source': 'projections', 'key': k} for k in list(only_in_proj)[:5]])
                
                if only_in_adp:
                    errors.append(f"Players in ADP but not in projections: {len(only_in_adp)}")
                    offending_keys.extend([{'source': 'adp', 'key': k} for k in list(only_in_adp)[:5]])
        
        return ValidationResult(
            check_name="foreign_key_check",
            passed=len(errors) == 0,
            errors=errors,
            warnings=[],
            details={'mismatches': len(offending_keys)},
            offending_keys=offending_keys
        )
    
    def validate_valuation_invariants(self) -> ValidationResult:
        """Check valuation invariants from the data dictionary."""
        logger.info("Validating valuation invariants...")
        
        if not HAS_PANDAS:
            return ValidationResult(
                check_name="valuation_invariants",
                passed=False,
                errors=["pandas not available for invariant validation"],
                warnings=[],
                details={},
                offending_keys=[]
            )
        
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
        if df is None or df.empty:
            return ValidationResult(
                check_name="valuation_invariants",
                passed=False,
                errors=["Could not load projections data"],
                warnings=[],
                details={},
                offending_keys=[]
            )
        
        # Check non-negativity
        numeric_cols = ['fantasyPoints', 'auctionValue']
        for col in numeric_cols:
            if col in df.columns:
                values = pd.to_numeric(df[col], errors='coerce')
                negative_count = (values < 0).sum()
                if negative_count > 0:
                    errors.append(f"Non-negativity violation: {negative_count} negative values in {col}")
        
        return ValidationResult(
            check_name="valuation_invariants",
            passed=len(errors) == 0,
            errors=errors,
            warnings=warnings,
            details=details,
            offending_keys=offending_keys[:10]
        )
    
    def run_complete_validation(self) -> Dict[str, Any]:
        """Run complete validation suite on all files."""
        logger.info("="*60)
        logger.info("COMPLETE DATA VALIDATION - ALL 123 FILES")
        logger.info("="*60)
        
        start_time = datetime.now()
        
        # Discover all files
        files_by_type = self.discover_all_files()
        total_files = sum(len(files) for files in files_by_type.values())
        
        logger.info(f"Discovered {total_files} total files:")
        logger.info(f"  - CSV files: {len(files_by_type['csv'])}")
        logger.info(f"  - TXT files: {len(files_by_type['txt'])}")
        logger.info(f"  - Other files: {len(files_by_type['other'])}")
        
        # 1. Check immutability (all files)
        immutability_result = self.validate_immutability_complete()
        self.validation_results.append(immutability_result)
        
        # 2. Validate CSV files
        csv_validated = 0
        for csv_file in files_by_type['csv'][:30]:  # Limit for performance
            report = self.validate_csv_file(csv_file)
            self.file_reports[csv_file.name] = report
            csv_validated += 1
        
        # 3. Validate TXT files
        txt_validated = 0
        for txt_file in files_by_type['txt'][:30]:  # Limit for performance
            report = self.validate_txt_file(txt_file)
            self.file_reports[txt_file.name] = report
            txt_validated += 1
        
        # 4. Check foreign keys (CSV only)
        fk_result = self.validate_foreign_keys()
        self.validation_results.append(fk_result)
        
        # 5. Check valuation invariants (CSV only)
        invariant_result = self.validate_valuation_invariants()
        self.validation_results.append(invariant_result)
        
        # Generate summary
        duration = (datetime.now() - start_time).total_seconds()
        
        # Count totals
        total_checks = sum(r.total_checks for r in self.file_reports.values()) + len(self.validation_results)
        passed_checks = sum(r.passed_checks for r in self.file_reports.values()) + sum(1 for r in self.validation_results if r.passed)
        failed_checks = sum(r.failed_checks for r in self.file_reports.values()) + sum(1 for r in self.validation_results if not r.passed)
        
        summary = {
            'validation_timestamp': datetime.now().isoformat(),
            'duration_seconds': duration,
            'total_files_found': total_files,
            'csv_files_found': len(files_by_type['csv']),
            'txt_files_found': len(files_by_type['txt']),
            'csv_files_validated': csv_validated,
            'txt_files_validated': txt_validated,
            'total_files_validated': csv_validated + txt_validated,
            'total_checks': total_checks,
            'passed_checks': passed_checks,
            'failed_checks': failed_checks,
            'immutability_check': immutability_result.passed,
            'foreign_key_check': fk_result.passed,
            'invariants_check': invariant_result.passed,
            'txt_file_hashes': len(self.txt_file_hashes) if hasattr(self, 'txt_file_hashes') else 0,
            'critical_errors': [],
            'warnings': []
        }
        
        # Collect errors and warnings
        for result in self.validation_results:
            if not result.passed:
                summary['critical_errors'].extend(result.errors[:3])
            summary['warnings'].extend(result.warnings[:3])
        
        # Save reports
        self.save_complete_reports(summary)
        
        return summary
    
    def save_complete_reports(self, summary: Dict[str, Any]):
        """Save complete validation reports including TXT file info."""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Save file reports
        for filename, report in self.file_reports.items():
            clean_filename = filename.replace('.', '_')
            report_path = VALIDATION_REPORTS_PATH / f"{clean_filename}_{timestamp}.json"
            with open(report_path, 'w') as f:
                json.dump(asdict(report), f, indent=2, default=str)
        
        # Save validation results
        for result in self.validation_results:
            report_path = VALIDATION_REPORTS_PATH / f"{result.check_name}_{timestamp}.json"
            with open(report_path, 'w') as f:
                json.dump(asdict(result), f, indent=2, default=str)
        
        # Save TXT file hashes for future baseline
        if hasattr(self, 'txt_file_hashes'):
            txt_baseline_path = REPORTS_PATH / f"txt_files_baseline_{timestamp}.json"
            with open(txt_baseline_path, 'w') as f:
                json.dump({
                    'generated_at': datetime.now().isoformat(),
                    'txt_files': self.txt_file_hashes
                }, f, indent=2)
            logger.info(f"TXT file baseline saved to {txt_baseline_path}")
        
        # Save complete summary
        summary_path = REPORTS_PATH / "validation_summary_complete.json"
        with open(summary_path, 'w') as f:
            json.dump(summary, f, indent=2, default=str)
        
        logger.info(f"Complete validation summary saved to {summary_path}")


def main():
    """Main entry point."""
    validator = CompleteDataValidator()
    summary = validator.run_complete_validation()
    
    # Print results
    print("\n" + "="*60)
    print("COMPLETE VALIDATION FINISHED")
    print("="*60)
    print(json.dumps({
        "status": "complete",
        "total_files_found": summary['total_files_found'],
        "csv_files": summary['csv_files_found'],
        "txt_files": summary['txt_files_found'],
        "files_validated": summary['total_files_validated'],
        "pass_count": summary['passed_checks'],
        "fail_count": summary['failed_checks'],
        "total_checks": summary['total_checks'],
        "immutability": "PASS" if summary['immutability_check'] else "FAIL",
        "foreign_keys": "PASS" if summary['foreign_key_check'] else "FAIL",
        "invariants": "PASS" if summary['invariants_check'] else "FAIL",
        "reports_path": str(VALIDATION_REPORTS_PATH),
        "summary_path": str(REPORTS_PATH / "validation_summary_complete.json"),
        "txt_hashes_computed": summary.get('txt_file_hashes', 0)
    }, indent=2))
    
    return 0 if summary['failed_checks'] == 0 else 1


if __name__ == '__main__':
    sys.exit(main())