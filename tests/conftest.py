"""
Pytest configuration and shared fixtures for all tests.
"""

import pytest
import sys
import os
from pathlib import Path

# Add src directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))


@pytest.fixture(scope='session')
def project_root():
    """Get the project root directory"""
    return Path(__file__).parent.parent


@pytest.fixture(scope='session')
def canonical_data_dir(project_root):
    """Get the canonical_data directory path"""
    return project_root / 'canonical_data'


@pytest.fixture(scope='session')
def src_dir(project_root):
    """Get the src directory path"""
    return project_root / 'src'


@pytest.fixture(scope='session')
def test_data_dir(project_root):
    """Get the test data directory path"""
    test_dir = project_root / 'tests' / 'test_data'
    test_dir.mkdir(parents=True, exist_ok=True)
    return test_dir


def pytest_configure(config):
    """Configure pytest with custom markers"""
    config.addinivalue_line(
        "markers", "slow: marks tests as slow (deselect with '-m \"not slow\"')"
    )
    config.addinivalue_line(
        "markers", "integration: marks tests as integration tests"
    )
    config.addinivalue_line(
        "markers", "unit: marks tests as unit tests"
    )
    config.addinivalue_line(
        "markers", "golden: marks tests that use golden/frozen values"
    )
    config.addinivalue_line(
        "markers", "immutability: marks tests that verify data immutability"
    )


def pytest_collection_modifyitems(config, items):
    """Automatically mark test types based on their location/name"""
    for item in items:
        # Mark tests in test_canonical_immutability as immutability tests
        if "immutability" in item.nodeid:
            item.add_marker(pytest.mark.immutability)
        
        # Mark tests with 'integration' in name as integration tests
        if "integration" in item.nodeid.lower():
            item.add_marker(pytest.mark.integration)
        
        # Mark tests with 'golden' in name as golden tests
        if "golden" in item.nodeid.lower():
            item.add_marker(pytest.mark.golden)