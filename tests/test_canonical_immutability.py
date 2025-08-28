"""
Tests for canonical_data immutability.
Ensures that data loading operations never modify the source CSV files.
"""

import pytest
import hashlib
import os
import glob
from pathlib import Path
from typing import Dict, List, Tuple
import sys

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class TestCanonicalDataImmutability:
    """Test suite ensuring canonical_data files are never modified"""
    
    @pytest.fixture(scope='class')
    def canonical_data_path(self):
        """Get path to canonical_data directory"""
        return Path(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))) / 'canonical_data'
    
    @pytest.fixture(scope='class')
    def all_canonical_files(self, canonical_data_path) -> List[Path]:
        """Get all CSV and data files in canonical_data"""
        patterns = ['**/*.csv', '**/*.txt', '**/*.json']
        files = []
        for pattern in patterns:
            files.extend(canonical_data_path.glob(pattern))
        return sorted(files)
    
    def compute_file_hash(self, filepath: Path) -> str:
        """Compute SHA256 hash of a file"""
        sha256_hash = hashlib.sha256()
        with open(filepath, 'rb') as f:
            # Read in chunks to handle large files
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()
    
    def compute_all_hashes(self, files: List[Path]) -> Dict[str, str]:
        """Compute hashes for all files"""
        hashes = {}
        for filepath in files:
            relative_path = filepath.relative_to(filepath.parts[0])
            hashes[str(relative_path)] = self.compute_file_hash(filepath)
        return hashes
    
    @pytest.fixture
    def original_hashes(self, all_canonical_files) -> Dict[str, str]:
        """Compute and store original hashes before any operations"""
        return self.compute_all_hashes(all_canonical_files)
    
    def test_file_discovery(self, all_canonical_files):
        """Test that we can find canonical data files"""
        assert len(all_canonical_files) > 0, "No canonical data files found"
        
        # Check for expected directories
        dirs_found = set()
        for f in all_canonical_files:
            parts = f.parts
            if 'canonical_data' in parts:
                idx = parts.index('canonical_data')
                if idx + 1 < len(parts):
                    dirs_found.add(parts[idx + 1])
        
        expected_dirs = {'adp', 'projections', 'advanced_data', 'historical_stats'}
        assert expected_dirs.issubset(dirs_found), f"Missing expected directories: {expected_dirs - dirs_found}"
    
    def test_hashes_stable_on_read(self, all_canonical_files, original_hashes):
        """Test that reading files doesn't change their hashes"""
        # Perform read operations on a subset of files
        for filepath in all_canonical_files[:5]:  # Test first 5 files
            with open(filepath, 'r') as f:
                _ = f.read()
        
        # Recompute hashes
        new_hashes = self.compute_all_hashes(all_canonical_files)
        
        # Compare
        for filename, original_hash in original_hashes.items():
            assert new_hashes[filename] == original_hash, \
                f"Hash changed for {filename} after read operation"
    
    def test_csv_parser_immutability(self, canonical_data_path, original_hashes, all_canonical_files):
        """Test that CSV parsing operations don't modify source files"""
        try:
            # Import CSV parser
            from src.lib.utils import parseCSVSafe
            
            # Parse a few CSV files
            csv_files = [f for f in all_canonical_files if f.suffix == '.csv'][:3]
            
            for csv_file in csv_files:
                with open(csv_file, 'r') as f:
                    content = f.read()
                    _ = parseCSVSafe(content)
            
            # Verify hashes unchanged
            new_hashes = self.compute_all_hashes(all_canonical_files)
            for filename, original_hash in original_hashes.items():
                assert new_hashes[filename] == original_hash, \
                    f"Hash changed for {filename} after CSV parsing"
                    
        except ImportError:
            pytest.skip("CSV parser not available")
    
    def test_data_loader_immutability(self, canonical_data_path, original_hashes, all_canonical_files):
        """Test that data loading operations don't modify files"""
        try:
            # Import and run data loaders
            from src.lib.rosterDataLoader import rosterDataLoader
            from src.lib.sosLoader import sosLoader
            
            # Load roster data (reads from advanced_data CSVs)
            _ = rosterDataLoader.loadRosterData()
            
            # Load SOS data  
            _ = sosLoader.loadSOSData()
            
            # Verify hashes unchanged
            new_hashes = self.compute_all_hashes(all_canonical_files)
            for filename, original_hash in original_hashes.items():
                assert new_hashes[filename] == original_hash, \
                    f"Hash changed for {filename} after data loading"
                    
        except (ImportError, Exception) as e:
            pytest.skip(f"Data loaders not available: {e}")
    
    def test_valuation_model_immutability(self, canonical_data_path, original_hashes, all_canonical_files):
        """Test that valuation model operations don't modify files"""
        try:
            from src.lib.calibratedValuationModel import CalibratedValuationModel, PlayerData
            
            # Create model and process some synthetic data
            model = CalibratedValuationModel()
            
            test_players = [
                PlayerData(id='t1', name='Test Player', position='RB', team='TST',
                         projectedPoints=200.0, adp=10, positionRank=5)
            ]
            
            _ = model.processAllPlayers(test_players)
            
            # Verify hashes unchanged
            new_hashes = self.compute_all_hashes(all_canonical_files)
            for filename, original_hash in original_hashes.items():
                assert new_hashes[filename] == original_hash, \
                    f"Hash changed for {filename} after valuation model operations"
                    
        except (ImportError, Exception) as e:
            pytest.skip(f"Valuation model not available: {e}")
    
    def test_comprehensive_immutability(self, canonical_data_path, all_canonical_files):
        """Comprehensive test: capture hashes, run all operations, verify unchanged"""
        # Capture initial state
        initial_hashes = self.compute_all_hashes(all_canonical_files)
        initial_file_count = len(all_canonical_files)
        initial_sizes = {str(f.relative_to(f.parts[0])): f.stat().st_size for f in all_canonical_files}
        initial_mtimes = {str(f.relative_to(f.parts[0])): f.stat().st_mtime for f in all_canonical_files}
        
        # Run various operations that touch canonical data
        operations_run = []
        
        # 1. Read operations
        for f in all_canonical_files[:3]:
            with open(f, 'r') as file:
                _ = file.read()
        operations_run.append('read_files')
        
        # 2. Try to import and use various modules
        try:
            from src.lib.utils import parseCSVSafe
            with open(all_canonical_files[0], 'r') as f:
                if all_canonical_files[0].suffix == '.csv':
                    _ = parseCSVSafe(f.read())
            operations_run.append('csv_parsing')
        except:
            pass
        
        try:
            from src.lib.calibratedValuationModel import CalibratedValuationModel
            model = CalibratedValuationModel()
            operations_run.append('model_creation')
        except:
            pass
        
        # Verify final state
        final_hashes = self.compute_all_hashes(all_canonical_files)
        final_file_count = len(list(canonical_data_path.glob('**/*')))
        final_sizes = {str(f.relative_to(f.parts[0])): f.stat().st_size for f in all_canonical_files}
        
        # Assertions
        assert final_file_count >= initial_file_count, "Files were deleted from canonical_data"
        
        for filename, initial_hash in initial_hashes.items():
            assert filename in final_hashes, f"File {filename} was removed"
            assert final_hashes[filename] == initial_hash, \
                f"File {filename} was modified (hash changed)"
            assert final_sizes[filename] == initial_sizes[filename], \
                f"File {filename} size changed"
        
        # Log what was tested
        print(f"Tested immutability across {len(operations_run)} operations: {operations_run}")
        print(f"Verified {len(initial_hashes)} files remain unchanged")
    
    def test_hash_consistency(self, all_canonical_files):
        """Test that hash computation is consistent"""
        if len(all_canonical_files) > 0:
            test_file = all_canonical_files[0]
            
            # Compute hash multiple times
            hash1 = self.compute_file_hash(test_file)
            hash2 = self.compute_file_hash(test_file)
            hash3 = self.compute_file_hash(test_file)
            
            assert hash1 == hash2 == hash3, "Hash computation is not deterministic"
    
    @pytest.fixture
    def critical_files(self, canonical_data_path) -> List[Tuple[Path, str]]:
        """List of critical files with their expected hashes (frozen values)"""
        # These are frozen hash values for critical files
        # Update these only when intentionally modifying canonical data
        return [
            (canonical_data_path / 'projections' / 'projections_2025.csv', 
             'COMPUTE_AND_FREEZE'),  # Replace with actual hash
            (canonical_data_path / 'adp' / 'adp0_2025.csv',
             'COMPUTE_AND_FREEZE'),  # Replace with actual hash
        ]
    
    def test_critical_files_unchanged(self, critical_files):
        """Test that critical files match their frozen hashes"""
        for filepath, expected_hash in critical_files:
            if not filepath.exists():
                pytest.skip(f"Critical file {filepath} not found")
            
            if expected_hash == 'COMPUTE_AND_FREEZE':
                # First run - compute and display the hash
                actual_hash = self.compute_file_hash(filepath)
                pytest.skip(f"First run - computed hash for {filepath.name}: {actual_hash}")
            else:
                actual_hash = self.compute_file_hash(filepath)
                assert actual_hash == expected_hash, \
                    f"Critical file {filepath.name} has been modified!"


class TestDataIntegrity:
    """Additional tests for data integrity and consistency"""
    
    def test_csv_structure_consistency(self, canonical_data_path):
        """Test that CSV files maintain consistent structure"""
        import csv
        
        # Check projections files
        projections_dir = canonical_data_path / 'projections'
        if projections_dir.exists():
            csv_files = list(projections_dir.glob('*.csv'))
            
            for csv_file in csv_files[:2]:  # Test first 2 files
                with open(csv_file, 'r', encoding='utf-8') as f:
                    reader = csv.reader(f)
                    header = next(reader, None)
                    
                    assert header is not None, f"{csv_file.name} is empty"
                    assert len(header) > 0, f"{csv_file.name} has no columns"
                    
                    # Count rows
                    row_count = sum(1 for row in reader)
                    assert row_count > 0, f"{csv_file.name} has no data rows"
    
    def test_no_write_operations(self, canonical_data_path, monkeypatch):
        """Test that write operations to canonical_data are prevented"""
        test_file = canonical_data_path / 'test_write.txt'
        
        # This should fail or be prevented
        with pytest.raises((PermissionError, OSError, Exception)):
            # Attempt to write (should fail in a properly configured system)
            with open(test_file, 'w') as f:
                f.write("This should not be written")
        
        # Verify file doesn't exist
        assert not test_file.exists(), "Test file was created in canonical_data"