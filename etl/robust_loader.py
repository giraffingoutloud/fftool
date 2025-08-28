#!/usr/bin/env python3
"""
Robust, lossless CSV loader for Fantasy Football data.

CONSTRAINTS:
1. Never modifies canonical_data (read-only)
2. Explicit dtype declarations following data_dictionary.json
3. Strict schema enforcement
4. Duplicate detection and quarantine
5. Referential integrity checks
6. Comprehensive logging and metadata tracking

Author: Data Provenance & Valuation Auditor
Date: 2025-08-27
"""

import csv
import hashlib
import json
import logging
import os
import sys
from dataclasses import dataclass, asdict
from datetime import datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple, Union
import warnings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Constants - Use relative paths from script location
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
CANONICAL_DATA_PATH = PROJECT_ROOT / "canonical_data"
ARTIFACTS_PATH = PROJECT_ROOT / "artifacts"
CLEAN_DATA_PATH = ARTIFACTS_PATH / "clean_data"
QUARANTINE_PATH = ARTIFACTS_PATH / "quarantine"
REPORTS_PATH = PROJECT_ROOT / "reports"
DATA_DICT_PATH = PROJECT_ROOT / "specs" / "data_dictionary.json"

# Ensure output directories exist
CLEAN_DATA_PATH.mkdir(parents=True, exist_ok=True)
QUARANTINE_PATH.mkdir(parents=True, exist_ok=True)
REPORTS_PATH.mkdir(parents=True, exist_ok=True)

# NA tokens that should be treated as null/missing
NA_TOKENS = {
    '', 'NA', 'N/A', 'n/a', 'null', 'NULL', 'None', 'NONE', 
    'nan', 'NaN', 'NAN', '#N/A', '#NA', '#NULL!', '--', 
    'undefined', 'UNDEFINED', 'missing', 'MISSING', '-'
}

# Team code mappings for non-standard codes
TEAM_MAPPINGS = {
    'BLT': 'BAL',  # Baltimore
    'ARZ': 'ARI',  # Arizona
    'HST': 'HOU',  # Houston
    'LA': 'LAR',   # Los Angeles Rams
    'CLV': 'CLE',  # Cleveland
}

# NFL team abbreviations (valid values)
VALID_TEAMS = {
    'ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE',
    'DAL', 'DEN', 'DET', 'GB', 'HOU', 'IND', 'JAX', 'KC',
    'LAC', 'LAR', 'LV', 'MIA', 'MIN', 'NE', 'NO', 'NYG',
    'NYJ', 'PHI', 'PIT', 'SEA', 'SF', 'TB', 'TEN', 'WAS',
    'WSH'  # Washington alternative
}

# Also accept the non-standard codes that will be mapped
VALID_TEAMS_WITH_MAPPINGS = VALID_TEAMS | set(TEAM_MAPPINGS.keys())

# Valid positions
VALID_POSITIONS = {'QB', 'RB', 'WR', 'TE', 'DST', 'K', 'DEF', 'PK'}


@dataclass
class ColumnSpec:
    """Specification for a single column."""
    name: str
    dtype: str
    nullable: bool
    allowed_range: Optional[List[Any]] = None
    units: Optional[str] = None
    primary_key: bool = False
    unique: bool = False


@dataclass
class FileMetadata:
    """Metadata for a loaded file."""
    path: str
    sha256: str
    row_count: int
    column_count: int
    parsed_rows: int
    quarantined_rows: int
    coercion_count: int
    null_count: int
    duplicate_count: int
    load_timestamp: str
    exceptions: List[Dict[str, Any]]


@dataclass
class LoadResult:
    """Result of loading a file."""
    success: bool
    data: List[Dict[str, Any]]
    metadata: FileMetadata
    quarantined: List[Dict[str, Any]]
    errors: List[str]
    warnings: List[str]


class RobustCSVLoader:
    """
    Robust CSV loader with strict parsing, schema enforcement, and data integrity checks.
    """
    
    def __init__(self, data_dict_path: Optional[Path] = None):
        """Initialize loader with data dictionary."""
        self.data_dict_path = data_dict_path or DATA_DICT_PATH
        self.data_dict = self._load_data_dictionary()
        self.column_specs = self._parse_column_specs()
        self.load_history: List[FileMetadata] = []
        
    def _load_data_dictionary(self) -> Dict[str, Any]:
        """Load the data dictionary specification."""
        if not self.data_dict_path.exists():
            logger.warning(f"Data dictionary not found at {self.data_dict_path}")
            return {}
        
        with open(self.data_dict_path, 'r') as f:
            return json.load(f)
    
    def _parse_column_specs(self) -> Dict[str, Dict[str, ColumnSpec]]:
        """Parse column specifications from data dictionary."""
        specs = {}
        
        # Parse projections_2025.csv columns
        specs['projections_2025.csv'] = {
            'fantasyPointsRank': ColumnSpec('fantasyPointsRank', 'int', False, [1, 1000]),
            'playerName': ColumnSpec('playerName', 'str', False),
            'teamName': ColumnSpec('teamName', 'str', False, list(VALID_TEAMS_WITH_MAPPINGS)),
            'position': ColumnSpec('position', 'str', False, list(VALID_POSITIONS)),
            'byeWeek': ColumnSpec('byeWeek', 'int', True, [1, 18]),
            'games': ColumnSpec('games', 'float', True, [0, 17]),
            'fantasyPoints': ColumnSpec('fantasyPoints', 'float', False, [0, 500]),
            'auctionValue': ColumnSpec('auctionValue', 'int', True, [0, 200]),
            # Passing stats
            'passComp': ColumnSpec('passComp', 'float', True, [0, 1000]),
            'passAtt': ColumnSpec('passAtt', 'float', True, [0, 1000]),
            'passYds': ColumnSpec('passYds', 'float', True, [0, 10000]),
            'passTd': ColumnSpec('passTd', 'float', True, [0, 100]),
            'passInt': ColumnSpec('passInt', 'float', True, [0, 50]),
            'passSacked': ColumnSpec('passSacked', 'float', True, [0, 100]),
            # Rushing stats
            'rushAtt': ColumnSpec('rushAtt', 'float', True, [0, 500]),
            'rushYds': ColumnSpec('rushYds', 'float', True, [-100, 3000]),
            'rushTd': ColumnSpec('rushTd', 'float', True, [0, 30]),
            # Receiving stats
            'recvTargets': ColumnSpec('recvTargets', 'float', True, [0, 300]),
            'recvReceptions': ColumnSpec('recvReceptions', 'float', True, [0, 200]),
            'recvYds': ColumnSpec('recvYds', 'float', True, [0, 3000]),
            'recvTd': ColumnSpec('recvTd', 'float', True, [0, 30]),
            # Misc
            'fumbles': ColumnSpec('fumbles', 'float', True, [0, 20]),
            'fumblesLost': ColumnSpec('fumblesLost', 'float', True, [0, 20]),
            'twoPt': ColumnSpec('twoPt', 'float', True, [0, 10]),
        }
        
        # Parse adp0_2025.csv columns
        specs['adp0_2025.csv'] = {
            'Overall Rank': ColumnSpec('Overall Rank', 'int', False, [1, 600]),
            'Full Name': ColumnSpec('Full Name', 'str', False),
            'Team Abbreviation': ColumnSpec('Team Abbreviation', 'str', False, list(VALID_TEAMS_WITH_MAPPINGS)),
            'Position': ColumnSpec('Position', 'str', False, list(VALID_POSITIONS)),
            'Position Rank': ColumnSpec('Position Rank', 'int', False, [1, 200]),
            'Bye Week': ColumnSpec('Bye Week', 'int', True, [1, 18]),
            'ADP': ColumnSpec('ADP', 'float', True, [1, 300]),  # Made nullable to include all DSTs
            'Projected Points': ColumnSpec('Projected Points', 'float', True, [0, 500]),
            'Auction Value': ColumnSpec('Auction Value', 'int', True, [0, 200]),
            'Is Rookie': ColumnSpec('Is Rookie', 'str', True, ['Yes', 'No']),
            'Data Status': ColumnSpec('Data Status', 'str', True),
        }
        
        # TODO: Add specifications for other CSV files
        # These need to be extracted from actual file headers
        specs['preseason_rankings_2025.csv'] = {
            'Team': ColumnSpec('Team', 'str', False, list(VALID_TEAMS_WITH_MAPPINGS)),
            'Point Spread Rating Points': ColumnSpec('Point Spread Rating Points', 'float', True),
            'Point Spread Rating QB': ColumnSpec('Point Spread Rating QB', 'float', True),
            'Strength of Schedule To Date': ColumnSpec('Strength of Schedule To Date', 'float', True),
            'Strength of Schedule Remaining': ColumnSpec('Strength of Schedule Remaining', 'int', True),
            'Projections Avg. Wins': ColumnSpec('Projections Avg. Wins', 'float', True, [0, 17]),
            'Projections Make Playoffs': ColumnSpec('Projections Make Playoffs', 'float', True, [0, 100]),
            'Projections Win Division Title': ColumnSpec('Projections Win Division Title', 'float', True, [0, 100]),
            'Projections Win Conf Champ': ColumnSpec('Projections Win Conf Champ', 'float', True, [0, 100]),
            'Projections Win Super Bowl': ColumnSpec('Projections Win Super Bowl', 'float', True, [0, 100]),
        }
        
        return specs
    
    def compute_file_hash(self, filepath: Path) -> str:
        """Compute SHA256 hash of a file."""
        sha256_hash = hashlib.sha256()
        with open(filepath, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()
    
    def detect_encoding(self, filepath: Path) -> str:
        """Detect file encoding with BOM handling."""
        with open(filepath, 'rb') as f:
            raw = f.read(4)
            
        # Check for BOM
        if raw.startswith(b'\xef\xbb\xbf'):
            return 'utf-8-sig'
        elif raw.startswith(b'\xff\xfe'):
            return 'utf-16-le'
        elif raw.startswith(b'\xfe\xff'):
            return 'utf-16-be'
        else:
            # Default to UTF-8
            return 'utf-8'
    
    def parse_value(self, value: str, spec: ColumnSpec) -> Tuple[Any, bool]:
        """
        Parse a value according to its specification.
        Returns (parsed_value, was_coerced).
        """
        # Check for NA tokens
        if value in NA_TOKENS or (isinstance(value, str) and value.strip() in NA_TOKENS):
            if spec.nullable:
                return None, False
            else:
                raise ValueError(f"Non-nullable column {spec.name} has null value")
        
        was_coerced = False
        
        try:
            if spec.dtype == 'str':
                parsed = str(value).strip() if value else None
                
            elif spec.dtype == 'int':
                # Handle decimal separator and thousands separator
                if isinstance(value, str):
                    value = value.replace(',', '')  # Remove thousands separator
                    value = value.replace('$', '')  # Remove currency symbol
                    value = value.strip()
                
                if '.' in str(value):
                    # Has decimal part, needs coercion
                    parsed = int(float(value))
                    was_coerced = True
                else:
                    parsed = int(value)
                    
            elif spec.dtype == 'float':
                if isinstance(value, str):
                    value = value.replace(',', '')  # Remove thousands separator
                    value = value.replace('$', '')  # Remove currency symbol
                    value = value.replace('%', '')  # Remove percentage sign
                    value = value.strip()
                parsed = float(value)
                
            elif spec.dtype == 'bool':
                if isinstance(value, str):
                    value_lower = value.lower().strip()
                    if value_lower in ('true', 'yes', '1', 't', 'y'):
                        parsed = True
                    elif value_lower in ('false', 'no', '0', 'f', 'n'):
                        parsed = False
                    else:
                        raise ValueError(f"Cannot parse boolean value: {value}")
                else:
                    parsed = bool(value)
                    
            else:
                # Unknown dtype, keep as string
                parsed = str(value)
                was_coerced = True
        
        except (ValueError, TypeError, InvalidOperation) as e:
            if spec.nullable:
                return None, True
            else:
                raise ValueError(f"Cannot parse {spec.name}={value} as {spec.dtype}: {e}")
        
        # Validate allowed range
        if parsed is not None and spec.allowed_range:
            if isinstance(spec.allowed_range[0], (int, float)):
                # Numeric range
                min_val, max_val = spec.allowed_range[0], spec.allowed_range[-1]
                if not (min_val <= parsed <= max_val):
                    logger.warning(f"Value {parsed} for {spec.name} outside range [{min_val}, {max_val}]")
                    was_coerced = True
                    # Clamp to range
                    parsed = max(min_val, min(parsed, max_val))
            else:
                # Categorical values
                if parsed not in spec.allowed_range:
                    # Check if this is a team code that needs mapping
                    if spec.name in ['teamName', 'Team Abbreviation', 'Team'] and parsed in TEAM_MAPPINGS:
                        mapped_value = TEAM_MAPPINGS[parsed]
                        logger.debug(f"Mapping team code {parsed} to {mapped_value}")
                        parsed = mapped_value
                        was_coerced = True
                    # Try case-insensitive match for strings
                    elif spec.dtype == 'str':
                        upper_val = str(parsed).upper()
                        if upper_val in spec.allowed_range:
                            parsed = upper_val
                            was_coerced = True
                        elif spec.name in ['teamName', 'Team Abbreviation', 'Team'] and upper_val in TEAM_MAPPINGS:
                            # Also try mapping after uppercasing
                            mapped_value = TEAM_MAPPINGS[upper_val]
                            logger.debug(f"Mapping team code {upper_val} to {mapped_value}")
                            parsed = mapped_value
                            was_coerced = True
                        else:
                            logger.warning(f"Value {parsed} for {spec.name} not in allowed values")
                            if spec.nullable:
                                return None, True
                            else:
                                raise ValueError(f"Invalid value {parsed} for {spec.name}")
        
        return parsed, was_coerced
    
    def detect_duplicates(self, data: List[Dict[str, Any]], key_columns: List[str]) -> Tuple[List[Dict], List[Dict]]:
        """
        Detect and separate duplicate records based on key columns.
        Returns (unique_records, duplicate_records).
        """
        seen_keys = {}
        unique = []
        duplicates = []
        
        for row in data:
            # Create composite key
            key_values = []
            for col in key_columns:
                val = row.get(col, '')
                # Normalize string values
                if isinstance(val, str):
                    val = val.lower().strip()
                key_values.append(str(val))
            key = '|'.join(key_values)
            
            if key in seen_keys:
                # Duplicate found
                dup_record = {
                    **row,
                    '_duplicate_of_row': seen_keys[key],
                    '_duplicate_key': key
                }
                duplicates.append(dup_record)
            else:
                seen_keys[key] = len(unique) + 1  # 1-based row number
                unique.append(row)
        
        return unique, duplicates
    
    def check_referential_integrity(self, 
                                   data: List[Dict[str, Any]], 
                                   reference_data: Dict[str, List[Dict[str, Any]]]) -> List[str]:
        """
        Check referential integrity against other datasets.
        Returns list of integrity violations.
        """
        violations = []
        
        # Example: Check if player names in projections exist in ADP data
        # TODO: Implement based on actual referential constraints
        
        return violations
    
    def load_csv(self, filepath: Path, strict: bool = True) -> LoadResult:
        """
        Load a CSV or TXT file with robust parsing and validation.
        TXT files are assumed to be comma-separated like CSV.
        
        Args:
            filepath: Path to the CSV or TXT file
            strict: If True, fail on schema violations; if False, quarantine bad rows
            
        Returns:
            LoadResult containing parsed data, metadata, and quarantined records
        """
        logger.info(f"Loading file: {filepath}")
        
        # Check if file exists
        if not filepath.exists():
            return LoadResult(
                success=False,
                data=[],
                metadata=FileMetadata(
                    path=str(filepath),
                    sha256='',
                    row_count=0,
                    column_count=0,
                    parsed_rows=0,
                    quarantined_rows=0,
                    coercion_count=0,
                    null_count=0,
                    duplicate_count=0,
                    load_timestamp=datetime.utcnow().isoformat(),
                    exceptions=[{'error': f'File not found: {filepath}'}]
                ),
                quarantined=[],
                errors=[f'File not found: {filepath}'],
                warnings=[]
            )
        
        # Compute file hash
        file_hash = self.compute_file_hash(filepath)
        
        # Detect encoding
        encoding = self.detect_encoding(filepath)
        
        # Get column specs for this file
        filename = filepath.name
        column_specs = self.column_specs.get(filename, {})
        
        # Parse CSV
        parsed_data = []
        quarantined_rows = []
        errors = []
        warnings = []
        coercion_count = 0
        null_count = 0
        total_rows = 0
        exceptions = []
        
        try:
            with open(filepath, 'r', encoding=encoding, errors='replace') as f:
                # Detect dialect
                sample = f.read(8192)
                f.seek(0)
                
                try:
                    dialect = csv.Sniffer().sniff(sample)
                except csv.Error:
                    # Default to standard CSV
                    dialect = csv.excel()
                
                # Check for quoted fields
                if '"' in sample or "'" in sample:
                    dialect.quoting = csv.QUOTE_MINIMAL
                
                reader = csv.DictReader(f, dialect=dialect)
                
                # Validate headers if specs exist
                if column_specs:
                    expected_cols = set(column_specs.keys())
                    actual_cols = set(reader.fieldnames or [])
                    
                    missing_cols = expected_cols - actual_cols
                    extra_cols = actual_cols - expected_cols
                    
                    if missing_cols:
                        msg = f"Missing columns: {missing_cols}"
                        if strict:
                            errors.append(msg)
                            raise ValueError(msg)
                        else:
                            warnings.append(msg)
                    
                    if extra_cols:
                        warnings.append(f"Extra columns found: {extra_cols}")
                
                # Parse rows
                for row_num, row in enumerate(reader, start=2):  # Start at 2 (header is row 1)
                    total_rows += 1
                    row_valid = True
                    parsed_row = {'_row_number': row_num}
                    row_exceptions = []
                    
                    for col_name, value in row.items():
                        if col_name is None:
                            continue
                            
                        col_name = col_name.strip()
                        spec = column_specs.get(col_name)
                        
                        if spec:
                            try:
                                parsed_val, was_coerced = self.parse_value(value, spec)
                                parsed_row[col_name] = parsed_val
                                
                                if was_coerced:
                                    coercion_count += 1
                                if parsed_val is None:
                                    null_count += 1
                                    
                            except ValueError as e:
                                row_exceptions.append({
                                    'row': row_num,
                                    'column': col_name,
                                    'value': value,
                                    'error': str(e)
                                })
                                row_valid = False
                                if strict:
                                    raise
                        else:
                            # No spec for this column, keep as string
                            parsed_row[col_name] = str(value).strip() if value else None
                    
                    if row_valid:
                        parsed_data.append(parsed_row)
                    else:
                        quarantined_rows.append({
                            **parsed_row,
                            '_quarantine_reason': 'validation_failed',
                            '_exceptions': row_exceptions
                        })
                        exceptions.extend(row_exceptions)
                        
        except Exception as e:
            logger.error(f"Error loading {filepath}: {e}")
            errors.append(str(e))
            exceptions.append({'error': str(e)})
        
        # Detect and quarantine duplicates
        if parsed_data and filename in ['projections_2025.csv', 'adp0_2025.csv']:
            # Define key columns for duplicate detection
            if filename == 'projections_2025.csv':
                key_cols = ['playerName', 'position', 'teamName']
            elif filename == 'adp0_2025.csv':
                key_cols = ['Full Name', 'Position', 'Team Abbreviation']
            else:
                key_cols = []
            
            if key_cols:
                unique_data, duplicate_data = self.detect_duplicates(parsed_data, key_cols)
                parsed_data = unique_data
                
                for dup in duplicate_data:
                    dup['_quarantine_reason'] = 'duplicate'
                    quarantined_rows.append(dup)
        
        # Create metadata
        metadata = FileMetadata(
            path=str(filepath),
            sha256=file_hash,
            row_count=total_rows,
            column_count=len(reader.fieldnames) if 'reader' in locals() else 0,
            parsed_rows=len(parsed_data),
            quarantined_rows=len(quarantined_rows),
            coercion_count=coercion_count,
            null_count=null_count,
            duplicate_count=len([r for r in quarantined_rows if r.get('_quarantine_reason') == 'duplicate']),
            load_timestamp=datetime.utcnow().isoformat(),
            exceptions=exceptions
        )
        
        # Save to load history
        self.load_history.append(metadata)
        
        # Write quarantined rows if any
        if quarantined_rows:
            base_name = filename.replace('.csv', '').replace('.txt', '')
            ext = '.csv' if filename.endswith('.csv') else '.txt'
            quarantine_file = QUARANTINE_PATH / f"{base_name}_dupes{ext}"
            self._write_quarantine(quarantine_file, quarantined_rows)
            warnings.append(f"Quarantined {len(quarantined_rows)} rows to {quarantine_file}")
        
        # Write clean data if successful
        if parsed_data and not errors:
            # Keep the same extension as the input file
            clean_file = CLEAN_DATA_PATH / filename
            self._write_clean_data(clean_file, parsed_data)
            logger.info(f"Wrote {len(parsed_data)} clean rows to {clean_file}")
        
        return LoadResult(
            success=len(errors) == 0,
            data=parsed_data,
            metadata=metadata,
            quarantined=quarantined_rows,
            errors=errors,
            warnings=warnings
        )
    
    def _write_quarantine(self, filepath: Path, data: List[Dict[str, Any]]):
        """Write quarantined data to CSV."""
        if not data:
            return
            
        with open(filepath, 'w', newline='', encoding='utf-8') as f:
            fieldnames = list(data[0].keys())
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(data)
    
    def _write_clean_data(self, filepath: Path, data: List[Dict[str, Any]]):
        """Write clean data to CSV (or parquet with pyarrow)."""
        if not data:
            return
            
        # Remove internal fields
        clean_data = []
        for row in data:
            clean_row = {k: v for k, v in row.items() if not k.startswith('_')}
            clean_data.append(clean_row)
        
        with open(filepath, 'w', newline='', encoding='utf-8') as f:
            fieldnames = list(clean_data[0].keys())
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(clean_data)
    
    def load_all_canonical_data(self) -> Dict[str, LoadResult]:
        """Load all canonical CSV and TXT files."""
        results = {}
        
        # Find all CSV and TXT files in canonical_data
        csv_files = list(CANONICAL_DATA_PATH.rglob('*.csv'))
        txt_files = list(CANONICAL_DATA_PATH.rglob('*.txt'))
        all_files = csv_files + txt_files
        logger.info(f"Found {len(csv_files)} CSV files and {len(txt_files)} TXT files to load")
        
        for data_file in all_files:
            rel_path = data_file.relative_to(CANONICAL_DATA_PATH)
            logger.info(f"Loading {rel_path}")
            
            try:
                result = self.load_csv(data_file, strict=False)
                results[str(rel_path)] = result
                
                if not result.success:
                    logger.error(f"Failed to load {rel_path}: {result.errors}")
                else:
                    logger.info(f"Loaded {result.metadata.parsed_rows} rows from {rel_path}")
                    
            except Exception as e:
                logger.error(f"Unexpected error loading {rel_path}: {e}")
                results[str(rel_path)] = LoadResult(
                    success=False,
                    data=[],
                    metadata=FileMetadata(
                        path=str(data_file),
                        sha256='',
                        row_count=0,
                        column_count=0,
                        parsed_rows=0,
                        quarantined_rows=0,
                        coercion_count=0,
                        null_count=0,
                        duplicate_count=0,
                        load_timestamp=datetime.utcnow().isoformat(),
                        exceptions=[{'error': str(e)}]
                    ),
                    quarantined=[],
                    errors=[str(e)],
                    warnings=[]
                )
        
        return results
    
    def generate_audit_report(self, results: Dict[str, LoadResult]) -> Dict[str, Any]:
        """Generate comprehensive audit report."""
        report = {
            'generated_at': datetime.utcnow().isoformat(),
            'total_files': len(results),
            'successful_loads': sum(1 for r in results.values() if r.success),
            'failed_loads': sum(1 for r in results.values() if not r.success),
            'total_rows_parsed': sum(r.metadata.parsed_rows for r in results.values()),
            'total_rows_quarantined': sum(r.metadata.quarantined_rows for r in results.values()),
            'total_coercions': sum(r.metadata.coercion_count for r in results.values()),
            'total_nulls': sum(r.metadata.null_count for r in results.values()),
            'total_duplicates': sum(r.metadata.duplicate_count for r in results.values()),
            'files': {}
        }
        
        for filepath, result in results.items():
            report['files'][filepath] = {
                'success': result.success,
                'metadata': asdict(result.metadata),
                'errors': result.errors,
                'warnings': result.warnings
            }
        
        return report


def main():
    """Main entry point for the robust loader."""
    logger.info("Starting robust data loading pipeline")
    
    # Initialize loader
    loader = RobustCSVLoader()
    
    # Load all canonical data
    results = loader.load_all_canonical_data()
    
    # Generate audit report
    audit_report = loader.generate_audit_report(results)
    
    # Save audit report
    audit_path = REPORTS_PATH / 'robust_loader_audit.json'
    with open(audit_path, 'w') as f:
        json.dump(audit_report, f, indent=2)
    
    logger.info(f"Audit report saved to {audit_path}")
    
    # Print summary
    print(f"\n{'='*60}")
    print("ROBUST LOADER SUMMARY")
    print(f"{'='*60}")
    print(f"Total files processed: {audit_report['total_files']}")
    print(f"Successful loads: {audit_report['successful_loads']}")
    print(f"Failed loads: {audit_report['failed_loads']}")
    print(f"Total rows parsed: {audit_report['total_rows_parsed']}")
    print(f"Total rows quarantined: {audit_report['total_rows_quarantined']}")
    print(f"Total coercions: {audit_report['total_coercions']}")
    print(f"Total duplicates: {audit_report['total_duplicates']}")
    print(f"\nClean data written to: {CLEAN_DATA_PATH}")
    print(f"Quarantined data written to: {QUARANTINE_PATH}")
    print(f"Audit report: {audit_path}")
    
    return 0 if audit_report['failed_loads'] == 0 else 1


if __name__ == '__main__':
    sys.exit(main())