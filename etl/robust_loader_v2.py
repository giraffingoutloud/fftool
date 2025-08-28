#!/usr/bin/env python3
"""
Robust CSV Loader V2 - With Integrity Fixes
Handles known data issues while preserving original values
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

# Add project to path
sys.path.append('/mnt/c/Users/giraf/Documents/projects/fftool')
from etl.player_normalizer import PlayerNormalizer

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Constants
CANONICAL_DATA_PATH = Path("/mnt/c/Users/giraf/Documents/projects/fftool/canonical_data")
ARTIFACTS_PATH = Path("/mnt/c/Users/giraf/Documents/projects/fftool/artifacts")
CLEAN_DATA_PATH = ARTIFACTS_PATH / "clean_data"
QUARANTINE_PATH = ARTIFACTS_PATH / "quarantine"
REPORTS_PATH = Path("/mnt/c/Users/giraf/Documents/projects/fftool/reports")

# Ensure output directories exist
CLEAN_DATA_PATH.mkdir(parents=True, exist_ok=True)
QUARANTINE_PATH.mkdir(parents=True, exist_ok=True)
REPORTS_PATH.mkdir(parents=True, exist_ok=True)

# NA tokens that should be treated as null/missing
NA_TOKENS = {
    '', 'NA', 'N/A', 'n/a', 'null', 'NULL', 'None', 
    'nan', 'NaN', '#N/A', '#NULL!', '--', '-'
}

@dataclass
class FileMetadata:
    """Metadata about file processing."""
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
    normalizations_applied: Dict[str, int] = None

class RobustCSVLoaderV2:
    """Enhanced loader with data integrity fixes."""
    
    def __init__(self):
        self.normalizer = PlayerNormalizer()
        self.load_history = []
        
        # Files with known header issues
        self.files_with_metadata = {
            'adp5_2025.txt': 7,  # Skip first 7 lines
            'adp4_2025.txt': 7,  # Also has metadata
        }
        
        # Files with column count issues (for logging)
        self.files_with_column_issues = {
            '49ers.csv': 'Known column count inconsistencies'
        }
    
    def detect_encoding(self, filepath: Path) -> str:
        """Detect file encoding."""
        encodings = ['utf-8', 'latin-1', 'cp1252', 'iso-8859-1']
        
        for encoding in encodings:
            try:
                with open(filepath, 'r', encoding=encoding) as f:
                    f.read()
                return encoding
            except UnicodeDecodeError:
                continue
        
        logger.warning(f"Could not detect encoding for {filepath}, defaulting to utf-8 with errors='replace'")
        return 'utf-8'
    
    def compute_file_hash(self, filepath: Path) -> str:
        """Compute SHA256 hash of file."""
        sha256_hash = hashlib.sha256()
        with open(filepath, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()
    
    def should_skip_metadata(self, filename: str) -> int:
        """Check if file has metadata rows to skip."""
        return self.files_with_metadata.get(filename, 0)
    
    def normalize_team_code(self, team: str) -> Tuple[str, bool]:
        """
        Normalize team code and track if normalization occurred.
        Returns (normalized_code, was_normalized)
        """
        if not team or team in NA_TOKENS:
            return team, False
        
        original = str(team).strip()
        normalized = self.normalizer.normalize_team_code(original)
        
        return normalized, (normalized != original)
    
    def normalize_player_name(self, name: str, position: str = None) -> Tuple[str, bool]:
        """
        Normalize player name for consistency.
        Returns (normalized_name, was_normalized)
        """
        if not name or name in NA_TOKENS:
            return name, False
            
        original = str(name).strip()
        normalized = self.normalizer.normalize_player_name(original, position)
        
        # For DST, use uppercase format
        if position and position.upper() == 'DST':
            normalized = normalized.upper()
        
        return normalized, (normalized.lower() != original.lower())
    
    def parse_value(self, value: Any, column: str = None) -> Any:
        """Parse value with NA token handling."""
        if value in NA_TOKENS:
            return None
        
        # Try to convert numeric strings
        if isinstance(value, str):
            # Remove percentage signs
            if value.endswith('%'):
                try:
                    return float(value.rstrip('%')) / 100
                except:
                    pass
            
            # Try numeric conversion
            try:
                if '.' in value:
                    return float(value)
                else:
                    return int(value)
            except:
                pass
        
        return value
    
    def detect_duplicates(self, data: List[Dict[str, Any]], key_columns: List[str]) -> Tuple[List[Dict], List[Dict]]:
        """Detect and separate duplicate records."""
        seen_keys = {}
        unique = []
        duplicates = []
        
        for row in data:
            # Create composite key
            key_values = []
            for col in key_columns:
                val = row.get(col, '')
                if isinstance(val, str):
                    val = val.lower().strip()
                key_values.append(str(val))
            key = '|'.join(key_values)
            
            if key in seen_keys:
                dup_record = {
                    **row,
                    '_duplicate_of_row': seen_keys[key],
                    '_duplicate_key': key
                }
                duplicates.append(dup_record)
            else:
                seen_keys[key] = len(unique) + 1
                unique.append(row)
        
        return unique, duplicates
    
    def load_csv(self, filepath: Path, strict: bool = False) -> LoadResult:
        """Load CSV/TXT file with integrity fixes."""
        if isinstance(filepath, str):
            filepath = Path(filepath)
            
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
        
        # Get filename
        filename = filepath.name
        
        # Check for metadata to skip
        skip_rows = self.should_skip_metadata(filename)
        
        # Track normalizations
        normalizations = {
            'team_codes': 0,
            'player_names': 0
        }
        
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
                # Skip metadata rows if needed
                for _ in range(skip_rows):
                    next(f, None)
                    
                # Detect dialect
                sample = f.read(8192)
                f.seek(0)
                
                # Skip metadata again after seek
                for _ in range(skip_rows):
                    next(f, None)
                
                try:
                    dialect = csv.Sniffer().sniff(sample)
                except:
                    dialect = csv.excel()
                
                # Read CSV
                reader = csv.DictReader(f, dialect=dialect)
                
                for row_num, row in enumerate(reader, 1):
                    total_rows += 1
                    
                    # Process each field
                    processed_row = {}
                    row_errors = []
                    
                    for col, value in row.items():
                        if col is None:
                            continue
                        
                        # Parse value
                        parsed_val = self.parse_value(value, col)
                        
                        if parsed_val is None:
                            null_count += 1
                        
                        # Apply normalizations based on column name
                        col_lower = col.lower()
                        
                        # Team normalization
                        if any(term in col_lower for term in ['team', 'tm', 'club']) and 'name' not in col_lower:
                            normalized, was_normalized = self.normalize_team_code(parsed_val)
                            if was_normalized:
                                normalizations['team_codes'] += 1
                                # Store original value in separate field with underscore prefix
                                processed_row[f'_original_{col}'] = parsed_val
                            parsed_val = normalized
                        
                        # Player name normalization
                        elif any(term in col_lower for term in ['player', 'name']) and 'team' not in col_lower:
                            # Get position if available
                            pos = row.get('Position') or row.get('position') or row.get('Pos') or row.get('pos')
                            normalized, was_normalized = self.normalize_player_name(parsed_val, pos)
                            if was_normalized:
                                normalizations['player_names'] += 1
                                # Store original value in separate field
                                processed_row[f'_original_{col}'] = parsed_val
                            parsed_val = normalized
                        
                        processed_row[col] = parsed_val
                    
                    if row_errors and strict:
                        quarantined_rows.append({
                            **processed_row,
                            '_row_number': row_num,
                            '_errors': row_errors
                        })
                    else:
                        parsed_data.append(processed_row)
                        if row_errors:
                            warnings.extend(row_errors)
        
        except Exception as e:
            errors.append(f"Error parsing file: {str(e)}")
            exceptions.append({'error': str(e), 'type': type(e).__name__})
        
        # Detect duplicates if we have data
        duplicate_count = 0
        if parsed_data:
            # Determine key columns
            all_columns = list(parsed_data[0].keys())
            
            # Identify potential key columns
            key_columns = []
            for col in all_columns:
                col_lower = col.lower()
                if any(term in col_lower for term in ['player', 'name', 'team']):
                    key_columns.append(col)
            
            if not key_columns:
                key_columns = all_columns[:2]  # Use first two columns as fallback
            
            # Detect duplicates
            unique_data, duplicates = self.detect_duplicates(parsed_data, key_columns)
            
            if duplicates:
                duplicate_count = len(duplicates)
                quarantined_rows.extend(duplicates)
                parsed_data = unique_data
                warnings.append(f"Found and quarantined {duplicate_count} duplicate rows")
        
        # Create metadata
        metadata = FileMetadata(
            path=str(filepath),
            sha256=file_hash,
            row_count=total_rows,
            column_count=len(parsed_data[0].keys()) if parsed_data else 0,
            parsed_rows=len(parsed_data),
            quarantined_rows=len(quarantined_rows),
            coercion_count=coercion_count,
            null_count=null_count,
            duplicate_count=duplicate_count,
            load_timestamp=datetime.utcnow().isoformat(),
            exceptions=exceptions
        )
        
        # Log normalizations if any
        if normalizations['team_codes'] > 0:
            logger.info(f"Normalized {normalizations['team_codes']} team codes")
        if normalizations['player_names'] > 0:
            logger.info(f"Normalized {normalizations['player_names']} player names")
        
        # Check for known issues
        if filename in self.files_with_column_issues:
            warnings.append(self.files_with_column_issues[filename])
        
        # Write clean data
        if parsed_data and not errors:
            clean_file = CLEAN_DATA_PATH / filename
            self._write_clean_data(clean_file, parsed_data)
            logger.info(f"Wrote {len(parsed_data)} clean rows to {clean_file}")
        
        # Write quarantine file if needed
        if quarantined_rows:
            base_name = filename.replace('.csv', '').replace('.txt', '')
            ext = '.csv' if filename.endswith('.csv') else '.txt'
            quarantine_file = QUARANTINE_PATH / f"{base_name}_quarantine{ext}"
            self._write_quarantine(quarantine_file, quarantined_rows)
            warnings.append(f"Quarantined {len(quarantined_rows)} rows to {quarantine_file}")
        
        return LoadResult(
            success=len(errors) == 0,
            data=parsed_data,
            metadata=metadata,
            quarantined=quarantined_rows,
            errors=errors,
            warnings=warnings,
            normalizations_applied=normalizations
        )
    
    def _write_quarantine(self, filepath: Path, data: List[Dict[str, Any]]):
        """Write quarantined data."""
        if not data:
            return
            
        with open(filepath, 'w', newline='', encoding='utf-8') as f:
            fieldnames = list(data[0].keys())
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(data)
    
    def _write_clean_data(self, filepath: Path, data: List[Dict[str, Any]]):
        """Write clean data."""
        if not data:
            return
            
        # Remove internal fields but keep original value tracking
        clean_data = []
        for row in data:
            clean_row = {}
            for k, v in row.items():
                # Keep original value columns for audit
                if not k.startswith('_'):
                    clean_row[k] = v
            clean_data.append(clean_row)
        
        with open(filepath, 'w', newline='', encoding='utf-8') as f:
            fieldnames = list(clean_data[0].keys())
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(clean_data)


if __name__ == '__main__':
    # Test the enhanced loader
    loader = RobustCSVLoaderV2()
    
    test_files = [
        CANONICAL_DATA_PATH / 'adp' / 'adp5_2025.txt',
        CANONICAL_DATA_PATH / 'advanced_data' / '2025-2026' / '49ers.csv',
        CANONICAL_DATA_PATH / 'other' / 'preseason_rankings_2025.csv'
    ]
    
    print("TESTING ENHANCED LOADER V2")
    print("=" * 60)
    
    for file in test_files:
        print(f"\nTesting: {file.name}")
        result = loader.load_csv(file, strict=False)
        
        print(f"  Success: {result.success}")
        print(f"  Rows parsed: {result.metadata.parsed_rows}")
        print(f"  Rows quarantined: {result.metadata.quarantined_rows}")
        
        if result.normalizations_applied:
            print(f"  Team codes normalized: {result.normalizations_applied['team_codes']}")
            print(f"  Player names normalized: {result.normalizations_applied['player_names']}")
        
        if result.warnings:
            print(f"  Warnings: {result.warnings[:2]}")
        
        if result.errors:
            print(f"  Errors: {result.errors[:2]}")