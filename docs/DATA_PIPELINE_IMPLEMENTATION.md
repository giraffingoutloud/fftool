# Data Pipeline Implementation

## Overview
The Fantasy Football Tool now uses a robust, two-stage data pipeline that ensures data integrity, quality, and consistency.

## Architecture

```
┌──────────────────┐
│ canonical_data/  │ (READ-ONLY)
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Python ETL       │ (robust_loader.py)
│ Pipeline         │ 
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ artifacts/       │
│ - clean_data/    │ (Validated CSV files)
│ - quarantine/    │ (Bad records)
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ TypeScript App   │ (dataLoaderV3.ts)
│ Data Service     │
└──────────────────┘
```

## Components

### 1. Python ETL Pipeline (`/etl/`)

#### `robust_loader.py`
- **Purpose**: Strict CSV parsing with schema enforcement
- **Features**:
  - Explicit dtype declarations
  - NA token handling (20+ variations)
  - Duplicate detection and quarantine
  - Range validation
  - Coercion tracking
  - SHA256 integrity verification
- **Output**: 
  - Clean data → `/artifacts/clean_data/`
  - Bad records → `/artifacts/quarantine/`

#### `pipeline.py`
- **Purpose**: Orchestrates the complete ETL process
- **Stages**:
  1. Pre-pipeline integrity check
  2. Data loading and cleaning
  3. Data validation
  4. Data transformation
  5. Post-pipeline integrity check
  6. Metadata generation
- **Output**: `data_manifest.json` with metadata

### 2. TypeScript Data Loaders (`/src/lib/`)

#### `cleanDataLoader.ts`
- **Purpose**: Loads pre-processed data from artifacts
- **Features**:
  - Manifest-based loading
  - Cache management (5-minute TTL)
  - Data freshness checking
  - Type-safe parsing

#### `dataLoaderV3.ts`
- **Purpose**: Primary application data loader
- **Features**:
  - Singleton pattern
  - Automatic ETL triggering
  - Integrity verification
  - Fallback handling
  - Cache management

#### `dataService.ts`
- **Purpose**: Unified data access interface
- **Features**:
  - Auto-initialization
  - Freshness checking
  - Statistics reporting
  - Error handling

### 3. Integrity System (`/validation/`)

#### `integrityChecker.ts`
- **Purpose**: Ensures canonical_data immutability
- **Features**:
  - SHA256 hash verification
  - Baseline generation
  - Integrity reports
  - Pipeline integration

## Usage

### Running the Pipeline

```bash
# Full pipeline with integrity checks
npm run data:refresh

# Pipeline only (faster, less safe)
npm run etl:pipeline

# Check data status
npm run data:check

# Verify integrity
npm run integrity:verify
```

### In the Application

```typescript
import { dataService } from '@/lib/dataService';

// Initialize on app start
await dataService.initialize();

// Get data
const data = await dataService.getData();

// Check freshness
const freshness = await dataService.checkDataFreshness();
if (!freshness.isFresh) {
  console.warn(freshness.message);
}

// Get statistics
const stats = await dataService.getDataStats();
```

## Data Flow

1. **Canonical Data** (Read-Only)
   - Source of truth
   - Never modified
   - SHA256 verified

2. **ETL Processing**
   - Strict parsing
   - Type validation
   - Duplicate removal
   - Quarantine bad records

3. **Clean Data**
   - Schema-compliant
   - Type-validated
   - Duplicate-free
   - Ready for use

4. **Application**
   - Loads clean data only
   - Caches for performance
   - Auto-refreshes when stale

## Quality Assurance

### Data Quality Score
Calculated based on:
- Load failures (−10 points each)
- Quarantine ratio (−20 points max)
- Coercions (−10 points max)

### Integrity Checks
- Before pipeline: Verify canonical data unchanged
- After pipeline: Verify canonical data still unchanged
- Continuous: SHA256 hashes tracked

### Validation Rules
- Required fields must have values
- Numeric fields must be in valid ranges
- Team abbreviations must be valid
- Positions must be recognized
- Duplicate players quarantined

## File Structure

```
fftool/
├── canonical_data/          # Source data (READ-ONLY)
│   ├── projections/
│   ├── adp/
│   └── ...
├── artifacts/              # Processed data
│   ├── clean_data/        # Valid, clean CSVs
│   ├── quarantine/        # Invalid/duplicate records
│   └── data_manifest.json # Metadata
├── etl/                   # Python ETL scripts
│   ├── robust_loader.py
│   └── pipeline.py
├── src/lib/              # TypeScript loaders
│   ├── cleanDataLoader.ts
│   ├── dataLoaderV3.ts
│   └── dataService.ts
└── reports/              # Audit reports
    ├── pipeline_audit_*.json
    ├── integrity_*.json
    └── ...
```

## Error Handling

### Missing Data
```
Error: No clean data available
Solution: npm run data:refresh
```

### Stale Data
```
Warning: Data is >24 hours old
Solution: npm run data:refresh
```

### Integrity Violation
```
Error: Canonical data modified
Solution: Restore original files, regenerate baseline
```

### High Quarantine Rate
```
Error: >10% of data quarantined
Solution: Check data quality, review quarantine files
```

## Performance

- Initial load: ~6 seconds (100 files, 35K rows)
- Cached load: <100ms
- Cache TTL: 5 minutes (configurable)
- Auto-refresh: When >1 hour old

## Future Enhancements

1. **Apache Parquet Support**
   - Better compression
   - Faster loading
   - Type safety

2. **Incremental Updates**
   - Delta processing
   - Change detection
   - Partial refreshes

3. **Data Profiling**
   - Statistical analysis
   - Anomaly detection
   - Quality trends

4. **Referential Integrity**
   - Cross-dataset validation
   - Foreign key checks
   - Consistency rules

## Compliance

✅ **Canonical data immutability**: Enforced via read-only access  
✅ **Explicit dtypes**: All columns have type specifications  
✅ **Schema enforcement**: Strict validation, fail on violations  
✅ **Duplicate handling**: Detection and quarantine  
✅ **Audit trail**: Complete lineage and metadata tracking  
✅ **Error recovery**: Graceful handling with clear messages  

## Commands Reference

| Command | Description |
|---------|-------------|
| `npm run data:refresh` | Run full pipeline with integrity checks |
| `npm run data:check` | Check data manifest status |
| `npm run etl:pipeline` | Run ETL pipeline only |
| `npm run integrity:verify` | Verify canonical data integrity |
| `npm run integrity:baseline` | Generate integrity baseline |

## Maintenance

### Daily
- Check data freshness: `npm run data:check`
- Review pipeline logs: `reports/pipeline.log`

### Weekly
- Review quarantine files
- Check data quality trends
- Update column specifications as needed

### As Needed
- Regenerate integrity baseline (after adding new files)
- Update schema definitions
- Tune validation rules