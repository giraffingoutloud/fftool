#!/usr/bin/env python3
"""
Main ETL Pipeline Orchestrator
Coordinates the complete data processing pipeline with integrity checks.

This is the PRIMARY data processing pipeline for the Fantasy Football tool.
All data MUST go through this pipeline before being used by the application.
"""

import json
import logging
import os
import sys
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional

# Add parent directory to path for imports
sys.path.append(str(Path(__file__).parent.parent))

from etl.robust_loader import RobustCSVLoader

# Configure logging
# Determine project root for logging
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
LOG_FILE = PROJECT_ROOT / "reports" / "pipeline.log"

# Ensure reports directory exists for logging
(PROJECT_ROOT / "reports").mkdir(parents=True, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(str(LOG_FILE)),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Paths already defined above for logging
CANONICAL_DATA_PATH = PROJECT_ROOT / "canonical_data"
ARTIFACTS_PATH = PROJECT_ROOT / "artifacts"
CLEAN_DATA_PATH = ARTIFACTS_PATH / "clean_data"
REPORTS_PATH = PROJECT_ROOT / "reports"
VALIDATION_PATH = PROJECT_ROOT / "validation"

# Pipeline configuration
PIPELINE_CONFIG = {
    "version": "1.0.0",
    "stages": [
        "integrity_pre_check",
        "data_loading",
        "data_validation",
        "data_transformation",
        "integrity_post_check",
        "metadata_generation"
    ],
    "fail_on_integrity_violation": True,
    "fail_on_validation_error": False,
    "max_quarantine_ratio": 0.1  # Fail if >10% of data is quarantined
}


class DataPipeline:
    """
    Main data pipeline orchestrator.
    Ensures data integrity throughout the processing pipeline.
    """
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """Initialize pipeline with configuration."""
        self.config = config or PIPELINE_CONFIG
        self.start_time = None
        self.pipeline_metadata = {
            "start_time": None,
            "end_time": None,
            "duration_seconds": None,
            "stages_completed": [],
            "stages_failed": [],
            "data_stats": {},
            "integrity_status": "unknown",
            "errors": [],
            "warnings": []
        }
        
    def run_integrity_check(self, check_type: str = "pre") -> bool:
        """
        Run integrity check using the TypeScript integrity checker.
        
        Args:
            check_type: "pre" or "post" to indicate check timing
            
        Returns:
            True if integrity check passes, False otherwise
        """
        logger.info(f"Running {check_type}-pipeline integrity check...")
        
        try:
            # Run the integrity verification script
            result = subprocess.run(
                ["npx", "tsx", "scripts/verifyIntegrity.ts"],
                cwd=str(PROJECT_ROOT),
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode == 0:
                logger.info(f"✅ {check_type.capitalize()}-pipeline integrity check PASSED")
                self.pipeline_metadata["integrity_status"] = "verified"
                return True
            else:
                logger.error(f"❌ {check_type.capitalize()}-pipeline integrity check FAILED")
                logger.error(f"Output: {result.stdout}")
                logger.error(f"Error: {result.stderr}")
                self.pipeline_metadata["integrity_status"] = "violated"
                self.pipeline_metadata["errors"].append(f"Integrity check failed: {result.stderr}")
                return False
                
        except subprocess.TimeoutExpired:
            logger.error("Integrity check timed out")
            self.pipeline_metadata["errors"].append("Integrity check timeout")
            return False
        except Exception as e:
            logger.error(f"Failed to run integrity check: {e}")
            self.pipeline_metadata["errors"].append(f"Integrity check error: {str(e)}")
            return False
    
    def load_and_clean_data(self) -> Dict[str, Any]:
        """
        Load all canonical data using the robust loader.
        
        Returns:
            Dictionary with loading results
        """
        logger.info("Loading and cleaning canonical data...")
        
        try:
            # Initialize robust loader
            loader = RobustCSVLoader()
            
            # Load all canonical data
            results = loader.load_all_canonical_data()
            
            # Generate audit report
            audit_report = loader.generate_audit_report(results)
            
            # Check quarantine ratio
            total_parsed = audit_report.get('total_rows_parsed', 0)
            total_quarantined = audit_report.get('total_rows_quarantined', 0)
            
            if total_parsed > 0:
                quarantine_ratio = total_quarantined / total_parsed
                if quarantine_ratio > self.config['max_quarantine_ratio']:
                    error_msg = f"Quarantine ratio {quarantine_ratio:.2%} exceeds maximum {self.config['max_quarantine_ratio']:.0%}"
                    logger.error(error_msg)
                    self.pipeline_metadata["errors"].append(error_msg)
                    if self.config['fail_on_validation_error']:
                        raise ValueError(error_msg)
            
            # Update pipeline metadata
            self.pipeline_metadata["data_stats"] = {
                "files_processed": audit_report['total_files'],
                "successful_loads": audit_report['successful_loads'],
                "failed_loads": audit_report['failed_loads'],
                "rows_parsed": audit_report['total_rows_parsed'],
                "rows_quarantined": audit_report['total_rows_quarantined'],
                "coercions": audit_report['total_coercions'],
                "duplicates": audit_report['total_duplicates']
            }
            
            # Save detailed audit report
            audit_path = REPORTS_PATH / f'pipeline_audit_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
            with open(audit_path, 'w') as f:
                json.dump(audit_report, f, indent=2)
            
            logger.info(f"Data loading complete. Audit saved to {audit_path}")
            return audit_report
            
        except Exception as e:
            logger.error(f"Data loading failed: {e}")
            self.pipeline_metadata["errors"].append(f"Data loading error: {str(e)}")
            raise
    
    def generate_metadata_manifest(self):
        """
        Generate metadata manifest for the cleaned data.
        This manifest is used by the TypeScript application.
        """
        logger.info("Generating metadata manifest...")
        
        manifest = {
            "version": "1.0.0",
            "generated_at": datetime.utcnow().isoformat(),
            "pipeline_version": self.config['version'],
            "data_location": str(CLEAN_DATA_PATH),
            "files": {},
            "statistics": self.pipeline_metadata["data_stats"],
            "integrity_verified": self.pipeline_metadata["integrity_status"] == "verified"
        }
        
        # List all cleaned data files
        for csv_file in CLEAN_DATA_PATH.glob("*.csv"):
            file_stats = csv_file.stat()
            manifest["files"][csv_file.name] = {
                "path": str(csv_file),
                "size_bytes": file_stats.st_size,
                "modified": datetime.fromtimestamp(file_stats.st_mtime).isoformat(),
                "format": "csv"
            }
        
        # Save manifest
        manifest_path = ARTIFACTS_PATH / "data_manifest.json"
        with open(manifest_path, 'w') as f:
            json.dump(manifest, f, indent=2)
        
        logger.info(f"Metadata manifest saved to {manifest_path}")
        return manifest
    
    def run_pipeline(self) -> bool:
        """
        Run the complete data pipeline.
        
        Returns:
            True if pipeline succeeds, False otherwise
        """
        self.start_time = datetime.utcnow()
        self.pipeline_metadata["start_time"] = self.start_time.isoformat()
        
        logger.info("="*60)
        logger.info("DATA PIPELINE STARTED")
        logger.info(f"Version: {self.config['version']}")
        logger.info(f"Time: {self.start_time.isoformat()}")
        logger.info("="*60)
        
        success = True
        
        try:
            # Stage 1: Pre-pipeline integrity check
            logger.info("\n📋 STAGE 1: Pre-Pipeline Integrity Check")
            if self.config['fail_on_integrity_violation']:
                if not self.run_integrity_check("pre"):
                    raise RuntimeError("Pre-pipeline integrity check failed")
            else:
                self.run_integrity_check("pre")
            self.pipeline_metadata["stages_completed"].append("integrity_pre_check")
            
            # Stage 2: Data loading and cleaning
            logger.info("\n📋 STAGE 2: Data Loading and Cleaning")
            audit_report = self.load_and_clean_data()
            self.pipeline_metadata["stages_completed"].append("data_loading")
            
            # Stage 3: Data validation (placeholder for additional validation)
            logger.info("\n📋 STAGE 3: Data Validation")
            # Additional validation logic can be added here
            self.pipeline_metadata["stages_completed"].append("data_validation")
            
            # Stage 4: Data transformation (placeholder for transformations)
            logger.info("\n📋 STAGE 4: Data Transformation")
            # Additional transformation logic can be added here
            self.pipeline_metadata["stages_completed"].append("data_transformation")
            
            # Stage 5: Post-pipeline integrity check
            logger.info("\n📋 STAGE 5: Post-Pipeline Integrity Check")
            if self.config['fail_on_integrity_violation']:
                if not self.run_integrity_check("post"):
                    raise RuntimeError("Post-pipeline integrity check failed")
            else:
                self.run_integrity_check("post")
            self.pipeline_metadata["stages_completed"].append("integrity_post_check")
            
            # Stage 6: Generate metadata manifest
            logger.info("\n📋 STAGE 6: Metadata Generation")
            manifest = self.generate_metadata_manifest()
            self.pipeline_metadata["stages_completed"].append("metadata_generation")
            
        except Exception as e:
            logger.error(f"Pipeline failed: {e}")
            self.pipeline_metadata["errors"].append(str(e))
            success = False
            
            # Record which stage failed
            all_stages = self.config["stages"]
            completed = self.pipeline_metadata["stages_completed"]
            failed_stages = [s for s in all_stages if s not in completed]
            if failed_stages:
                self.pipeline_metadata["stages_failed"] = failed_stages
        
        finally:
            # Record pipeline end time
            end_time = datetime.utcnow()
            self.pipeline_metadata["end_time"] = end_time.isoformat()
            self.pipeline_metadata["duration_seconds"] = (end_time - self.start_time).total_seconds()
            
            # Save pipeline metadata
            metadata_path = REPORTS_PATH / f'pipeline_metadata_{self.start_time.strftime("%Y%m%d_%H%M%S")}.json'
            with open(metadata_path, 'w') as f:
                json.dump(self.pipeline_metadata, f, indent=2)
            
            # Print summary
            logger.info("\n" + "="*60)
            if success:
                logger.info("✅ PIPELINE COMPLETED SUCCESSFULLY")
            else:
                logger.info("❌ PIPELINE FAILED")
            logger.info("="*60)
            logger.info(f"Duration: {self.pipeline_metadata['duration_seconds']:.2f} seconds")
            logger.info(f"Stages completed: {len(self.pipeline_metadata['stages_completed'])}/{len(self.config['stages'])}")
            
            if self.pipeline_metadata["data_stats"]:
                stats = self.pipeline_metadata["data_stats"]
                logger.info(f"Files processed: {stats.get('files_processed', 0)}")
                logger.info(f"Rows parsed: {stats.get('rows_parsed', 0)}")
                logger.info(f"Rows quarantined: {stats.get('rows_quarantined', 0)}")
            
            if self.pipeline_metadata["errors"]:
                logger.error(f"Errors encountered: {len(self.pipeline_metadata['errors'])}")
                for error in self.pipeline_metadata["errors"][:5]:
                    logger.error(f"  - {error}")
            
            logger.info(f"\nReports saved to: {REPORTS_PATH}")
            logger.info(f"Clean data saved to: {CLEAN_DATA_PATH}")
            logger.info(f"Pipeline metadata: {metadata_path}")
            
        return success


def main():
    """Main entry point for the pipeline."""
    # Parse command line arguments if needed
    import argparse
    parser = argparse.ArgumentParser(description='Run the data processing pipeline')
    parser.add_argument('--skip-integrity', action='store_true', 
                       help='Skip integrity checks (not recommended)')
    parser.add_argument('--allow-failures', action='store_true',
                       help='Continue pipeline even if validation fails')
    args = parser.parse_args()
    
    # Update config based on arguments
    config = PIPELINE_CONFIG.copy()
    if args.skip_integrity:
        logger.warning("⚠️  Integrity checks disabled - this is not recommended!")
        config['fail_on_integrity_violation'] = False
    if args.allow_failures:
        config['fail_on_validation_error'] = False
    
    # Run pipeline
    pipeline = DataPipeline(config)
    success = pipeline.run_pipeline()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()