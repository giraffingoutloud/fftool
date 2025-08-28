# New Data Ingestion Protocol
**Version**: 1.0.0  
**Last Updated**: 2025-08-27  
**Author**: Data Provenance & Valuation Auditor

## 🎯 Executive Summary
This protocol ensures that new data sources added throughout the season are automatically detected, validated, and integrated into the fantasy football valuation system while maintaining strict data integrity and immutability constraints.

## 📋 Core Principles
1. **Immutability First**: Never modify original data files
2. **Automatic Detection**: New files trigger validation workflows
3. **Schema Evolution**: Support new data structures without breaking existing ones
4. **Audit Everything**: Complete provenance tracking
5. **Fail Safe**: Bad data never corrupts good data

## 🔄 New Data Ingestion Workflow

### Step 1: Add New Data File
```bash
# Place new file in appropriate canonical_data subdirectory
canonical_data/
├── adp/           # ADP data from various sources
├── projections/   # Player projections
├── injuries/      # NEW: Injury reports
├── weather/       # NEW: Weather data
└── betting/       # NEW: Betting lines
```

### Step 2: Register Data Source
Run the registration script to automatically detect and catalog the new file:
```bash
npm run data:register
```

### Step 3: Generate Column Specifications
Automatically infer or manually define column specs:
```bash
npm run data:analyze <filepath>
```

### Step 4: Update Systems
Run the comprehensive update workflow:
```bash
npm run data:update-all
```

### Step 5: Validate Integration
```bash
npm run validate:complete
```

## 📁 Directory Structure for New Data

### Recommended Categories
```
canonical_data/
├── real_time/          # In-season updates
│   ├── injuries/       # Injury reports
│   ├── weather/        # Game day weather
│   └── news/           # Player news
├── market_data/        # Market-based valuations
│   ├── betting/        # Betting lines
│   ├── dfs/           # DFS salaries
│   └── trade_values/   # Dynasty trade values
└── performance/        # Actual performance data
    ├── weekly_stats/   # Weekly actuals
    ├── snap_counts/    # Usage metrics
    └── targets/        # Target share data
```

## 🔧 Automated Integration Scripts

### 1. New File Detector (`detectNewFiles.ts`)
```typescript
// Automatically detects files not in baseline
// Runs on schedule or manually
npm run integrity:detect-new
```

### 2. Schema Analyzer (`analyzeSchema.py`)
```python
# Analyzes new file structure and suggests column specs
python3 scripts/analyzeSchema.py <filepath>
```

### 3. Validation Rule Generator (`generateValidation.ts`)
```typescript
// Creates validation rules based on data patterns
npm run validation:generate <filepath>
```

### 4. Update All Script (`updateAll.sh`)
```bash
#!/bin/bash
# Master update script that runs all necessary updates
npm run data:update-all
```

## 📊 Column Specification Template

For each new data source, create a specification:

```json
{
  "filename": "injuries_week1_2025.csv",
  "source": "official_injury_report",
  "frequency": "weekly",
  "columns": {
    "player_name": {
      "type": "string",
      "required": true,
      "normalize": true
    },
    "team": {
      "type": "string",
      "enum": ["ARI", "ATL", "BAL", ...],
      "required": true
    },
    "injury_status": {
      "type": "string",
      "enum": ["OUT", "DOUBTFUL", "QUESTIONABLE", "PROBABLE", "HEALTHY"],
      "required": true
    },
    "body_part": {
      "type": "string",
      "required": false
    },
    "practice_participation": {
      "type": "string",
      "enum": ["DNP", "LIMITED", "FULL", null],
      "required": false
    }
  },
  "composite_key": ["player_name", "team", "week"],
  "validation_rules": {
    "no_duplicate_players": true,
    "valid_week_range": [1, 18],
    "status_transitions": {
      "OUT": ["DOUBTFUL", "OUT"],
      "DOUBTFUL": ["QUESTIONABLE", "OUT", "DOUBTFUL"],
      "QUESTIONABLE": ["PROBABLE", "HEALTHY", "DOUBTFUL", "QUESTIONABLE"]
    }
  }
}
```

## 🚀 Quick Start Commands

### For Weekly Updates (Most Common)
```bash
# 1. Add new files to canonical_data/
cp ~/downloads/week5_injuries.csv canonical_data/injuries/

# 2. Run the weekly update workflow
npm run weekly:update

# This automatically:
# - Detects new files
# - Updates integrity baseline
# - Processes through ETL
# - Validates all data
# - Generates report
```

### For New Data Source Types
```bash
# 1. Add first file of new type
cp ~/downloads/weather_data.csv canonical_data/weather/

# 2. Analyze and register new source
npm run data:register-new weather_data.csv

# 3. Review and adjust generated specs
code specs/columns/weather_data.json

# 4. Run full integration
npm run data:integrate-new
```

## 🔒 Integrity Maintenance

### Automatic Baseline Updates
When new files are detected:
1. Compute SHA256 hash
2. Add to baseline with metadata
3. Version the baseline (git commit)
4. Run integrity verification

### Rollback Capability
```bash
# If bad data is detected, rollback to previous baseline
npm run integrity:rollback

# View baseline history
npm run integrity:history
```

## 📈 Validation Rules by Data Type

### Injury Data
- Player names must match existing rosters
- Status transitions must be logical
- Dates must be within current season

### Weather Data
- Temperature ranges: -20°F to 120°F
- Wind speed: 0-60 mph
- Precipitation: 0-100%
- Stadium must exist

### Betting Data
- Lines must be numeric
- Over/under must be positive
- Spreads within reasonable range (-50 to +50)

### Performance Data
- Stats must be non-negative
- Snap counts ≤ total team snaps
- Targets ≤ team pass attempts

## 🎭 Testing New Data Sources

### 1. Dry Run Mode
```bash
# Process new data without writing to production
npm run etl:dry-run canonical_data/new_source/

# Review what would change
cat reports/dry_run_summary.json
```

### 2. Sandbox Testing
```bash
# Test in isolated environment
npm run test:sandbox new_data.csv

# Compare results
npm run test:diff-sandbox
```

## 📝 Checklist for New Data Sources

### Pre-Addition Checklist
- [ ] Data source is reputable and consistent
- [ ] File format is CSV or TXT (comma-delimited)
- [ ] Column headers are present and consistent
- [ ] Data license allows usage
- [ ] Update frequency is documented

### Post-Addition Checklist
- [ ] File placed in correct canonical_data subdirectory
- [ ] SHA256 baseline updated
- [ ] Column specifications created
- [ ] Validation rules defined
- [ ] ETL pipeline processes successfully
- [ ] No foreign key violations introduced
- [ ] Valuation models still converge
- [ ] All tests pass

### Weekly Maintenance
- [ ] Run integrity check before updates
- [ ] Add new week's data files
- [ ] Run update workflow
- [ ] Review validation reports
- [ ] Check for anomalies
- [ ] Commit baseline changes
- [ ] Document any issues

## 🚨 Common Issues and Solutions

### Issue: Player Name Mismatches
**Solution**: Use fuzzy matching with confidence threshold
```python
# In robust_loader.py
if confidence < 0.9:
    quarantine_with_reason("name_mismatch")
```

### Issue: New Column in Existing Source
**Solution**: Schema evolution support
```json
{
  "version": "2.0",
  "backwards_compatible": true,
  "new_columns": ["new_metric"],
  "default_values": {"new_metric": null}
}
```

### Issue: Duplicate Data
**Solution**: Composite key detection
```python
# Automatically detect and quarantine
duplicates = detect_duplicates(data, composite_key)
```

## 📊 Monitoring and Alerts

### Health Checks
```bash
# Run daily health check
npm run health:check

# Checks:
# - File count matches baseline
# - No hash mismatches  
# - Validation pass rate > 95%
# - ETL pipeline success
# - Foreign key integrity
```

### Alert Conditions
- New file detected (info)
- Validation failure rate > 5% (warning)
- Integrity check failed (critical)
- Foreign key violations > 10% (warning)
- ETL pipeline failure (critical)

## 🔄 Continuous Integration

### GitHub Actions Workflow
```yaml
name: Data Integrity Check
on:
  schedule:
    - cron: '0 */6 * * *'  # Every 6 hours
  push:
    paths:
      - 'canonical_data/**'
      
jobs:
  integrity-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - run: npm install
      - run: npm run integrity:verify
      - run: npm run validate:complete
      - name: Alert on failure
        if: failure()
        run: |
          echo "Data integrity check failed!"
          # Send alert (email, Slack, etc.)
```

## 📚 API for Programmatic Updates

### Add New Data Source
```typescript
import { DataIngestion } from './lib/dataIngestion';

const ingestion = new DataIngestion();

// Register new source
await ingestion.registerSource({
  path: 'canonical_data/injuries/week5.csv',
  type: 'injury_report',
  frequency: 'weekly',
  autoValidate: true
});

// Process with validation
const result = await ingestion.process();
console.log(result.summary);
```

## 🎯 Season-Long Workflow

### Pre-Season
1. Baseline all projection sources
2. Set up monitoring
3. Test update workflows

### Weekly (During Season)
1. Monday: Add injury reports
2. Tuesday: Update practice reports  
3. Wednesday: Add weather forecasts
4. Thursday: Final injury designations
5. Friday: Betting lines
6. Saturday: Final updates
7. Sunday: Validate all data

### Post-Week
1. Add actual performance data
2. Reconcile projections vs actuals
3. Update models if needed

## 🔑 Key Scripts

### Weekly Update
```bash
#!/bin/bash
# weekly_update.sh
echo "Starting weekly update..."

# 1. Verify integrity
npm run integrity:verify || exit 1

# 2. Detect new files
NEW_FILES=$(npm run integrity:detect-new --silent)

# 3. Process new files
if [ -n "$NEW_FILES" ]; then
  npm run data:register
  npm run integrity:baseline
fi

# 4. Run ETL
npm run etl:pipeline

# 5. Validate
npm run validate:complete

# 6. Generate report
npm run report:weekly

echo "Weekly update complete!"
```

## 📞 Support Contacts

### Issue Escalation
1. **Data Quality Issues**: Review validation reports
2. **Integration Failures**: Check ETL logs
3. **Performance Issues**: Monitor pipeline metrics
4. **Unknown File Formats**: Run schema analyzer

### Documentation
- This guide: `/docs/NEW_DATA_INGESTION_PROTOCOL.md`
- Column specs: `/specs/columns/`
- Validation rules: `/validation/rules/`
- ETL logs: `/logs/etl/`

## 🎬 Next Steps

1. Implement the automated scripts
2. Set up CI/CD pipeline
3. Create monitoring dashboard
4. Test with sample new data sources

---

Remember: **Every new file must be validated before use. When in doubt, quarantine.**