# Canonical Data Integrity System

## Overview
A comprehensive integrity verification system has been implemented to ensure the immutability of the `canonical_data` directory throughout all data processing operations.

## Hard Constraints Enforced
✅ **Canonical data is treated as immutable and read-only**
- No modifications, writes, moves, renames, or deletions allowed
- All processing done via in-memory transformations
- Derived artifacts written to separate directories

✅ **Integrity verification before and after pipelines**
- SHA256 hashes computed for all files
- Pipeline fails if any hash changes detected
- Integrity reports saved to `./reports/`

✅ **Clean data separation**
- Cleaned data: `./artifacts/clean_data/`
- Quarantined records: `./artifacts/quarantine/`
- Reports: `./reports/`

## System Components

### 1. Integrity Checker (`/validation/integrityChecker.ts`)
- Computes SHA256 hashes for all CSV files
- Tracks file size and modification times
- Generates comprehensive integrity reports
- Verifies against baseline
- Logs all integrity checks

### 2. Scripts
- `generateIntegrityBaseline.ts` - Creates initial integrity snapshot
- `verifyIntegrity.ts` - Verifies current state against baseline
- `safePipeline.ts` - Wrapper ensuring integrity throughout pipeline

### 3. NPM Commands
```bash
npm run integrity:baseline  # Generate baseline
npm run integrity:verify    # Verify integrity
npm run integrity:check     # Alias for verify
npm run pipeline:safe       # Run pipeline with integrity checks
```

## Integrity Report Structure
```json
{
  "version": "1.0.0",
  "generatedAt": "2025-08-27T15:26:15.423Z",
  "canonicalDataPath": "/path/to/canonical_data",
  "totalFiles": 100,
  "totalSizeBytes": 6013646,
  "files": [
    {
      "path": "absolute/path",
      "relativePath": "relative/path",
      "sha256": "hash",
      "sizeBytes": 12345,
      "lastModifiedMs": 1755715969000,
      "category": "category_name"
    }
  ],
  "summary": {
    "byCategory": { "adp": 4, "projections": 5, ... },
    "byExtension": { "csv": 100 }
  }
}
```

## Current Status
- **Baseline Generated**: ✅ 2025-08-27T15:26:15.423Z
- **Total Files**: 100 CSV files
- **Total Size**: 5.74 MB
- **Categories**: 
  - adp: 4 files
  - advanced_data: 81 files
  - historical_stats: 6 files
  - other: 3 files
  - projections: 5 files
  - strength_of_schedule: 1 file

## Usage Example

### Before Any Data Processing:
```bash
# Verify integrity before starting
npm run integrity:verify

# Or use safe pipeline wrapper
npm run pipeline:safe
```

### Safe Pipeline Execution:
```bash
# Automatically checks integrity before and after
npx tsx scripts/safePipeline.ts

# Skip checks if needed (not recommended)
npx tsx scripts/safePipeline.ts --skip-pre-check --skip-post-check

# Custom pipeline command
npx tsx scripts/safePipeline.ts --pipeline "npm run custom:pipeline"
```

## Failure Scenarios

### If Integrity Check Fails:
1. Pipeline immediately halts
2. Error report generated showing:
   - Modified files (hash mismatches)
   - Missing files
   - New unexpected files
3. Exit code 1 returned
4. No processing continues

### Recovery:
```bash
# Regenerate baseline if changes are intentional
npm run integrity:baseline

# Verify again
npm run integrity:verify
```

## Monitoring
- All integrity checks logged to: `./reports/integrity_check_log.json`
- Last 100 checks retained
- Each log entry includes timestamp, results, and violations

## Best Practices
1. **Always run integrity:verify before processing**
2. **Never modify canonical_data directly**
3. **Write all outputs to ./artifacts/**
4. **Use safePipeline.ts wrapper for all pipelines**
5. **Regenerate baseline only when new canonical data is intentionally added**

## Compliance
This system ensures full compliance with the hard constraints:
- ✅ Canonical data immutability enforced
- ✅ SHA256 verification before/after pipelines
- ✅ Pipeline fails on any integrity violation
- ✅ Clean separation of source and derived data