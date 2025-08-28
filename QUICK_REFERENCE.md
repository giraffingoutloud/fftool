# Quick Reference: Data Ingestion Commands

## 🚀 Most Common Commands

### Weekly Update (During Season)
```bash
# Run every week when you add new data files
npm run weekly:update
```

### Check for New Files
```bash
# See what files aren't tracked yet
npm run integrity:detect-new
```

### Register New Data Source
```bash
# Analyze and register a specific file
npm run data:register path/to/new/file.csv

# Register all detected new files
npm run data:register
```

## 📊 Data Management Commands

### Integrity Checks
```bash
# Verify all files match baseline (no modifications)
npm run integrity:verify

# Update baseline after adding new files
npm run integrity:update

# Generate initial baseline (only needed once)
npm run integrity:baseline
```

### ETL Pipeline
```bash
# Run complete ETL pipeline
npm run etl:pipeline

# Run ETL with integrity checks
npm run etl:pipeline:safe
```

### Validation
```bash
# Run complete validation suite
npm run validate:complete

# Check validation results
cat reports/validation_summary_complete.json | jq .
```

## 📁 Where to Add New Data

```
canonical_data/
├── injuries/        # Injury reports (weekly)
├── weather/         # Weather data (game day)
├── betting/         # Betting lines (weekly)
├── performance/     # Actual stats (weekly)
├── adp/            # ADP updates
├── projections/    # Updated projections
└── [new_category]/ # Create new folder for new data types
```

## 🔄 Standard Weekly Workflow

### Monday Morning (After Week Completes)
1. Download new data files (injuries, stats, etc.)
2. Place files in appropriate canonical_data/ folders
3. Run: `npm run weekly:update`
4. Review any validation warnings
5. Check quarantined duplicates if any

### Quick Add Single File
```bash
# 1. Add file to canonical_data/
cp ~/downloads/week5_injuries.csv canonical_data/injuries/

# 2. Detect and verify
npm run integrity:detect-new

# 3. If looks good, update everything
npm run data:update-all
```

## 🚨 Troubleshooting

### "Integrity Check Failed"
```bash
# Check what changed
npm run integrity:detect-new

# If files were deleted/modified (bad!)
git status canonical_data/
git diff canonical_data/
```

### "Validation Failed"
```bash
# Check detailed validation report
cat reports/validation_summary_complete.json

# Check specific validation errors
ls reports/validation/
```

### "ETL Pipeline Failed"
```bash
# Check ETL logs
cat logs/etl_pipeline.log

# Check quarantined data
ls artifacts/quarantine/
```

## 📈 Monitor Data Health

### Quick Status Check
```bash
# See current data status
npm run data:check

# Count files
find canonical_data -name "*.csv" -o -name "*.txt" | wc -l

# Check last update
ls -la reports/weekly_update_*.json | tail -1
```

### Full Health Check
```bash
# Run all checks
npm run integrity:verify && \
npm run validate:complete && \
echo "✅ All systems healthy"
```

## 🔑 Key Principles

1. **NEVER** modify files in canonical_data/
2. **ALWAYS** run integrity check before and after updates
3. **REVIEW** validation warnings (some are expected)
4. **CHECK** quarantined data for important rows
5. **BACKUP** before major updates

## 📝 File Formats

### Expected CSV/TXT Structure
- First row must be headers
- Comma-separated values
- UTF-8 encoding
- No BOM (Byte Order Mark)
- Consistent column names

### Common Column Names
- Player: `player_name`, `player`, `name`
- Team: `team`, `team_name`, `tm`
- Position: `position`, `pos`
- Week: `week`, `wk`
- Stats: snake_case (e.g., `passing_yards`, `rushing_tds`)

## 🎯 Quick Wins

### Add Injury Report
```bash
# ESPN/Yahoo injury format works directly
cp ~/downloads/injuries.csv canonical_data/injuries/week5_injuries.csv
npm run weekly:update
```

### Add Weather Data
```bash
# Weather.com CSV format
cp ~/downloads/weather_week5.csv canonical_data/weather/
npm run weekly:update
```

### Update ADP
```bash
# FantasyPros ADP format
cp ~/downloads/adp_latest.csv canonical_data/adp/adp6_2025.csv
npm run weekly:update
```

## 📞 Help

- Documentation: `/docs/NEW_DATA_INGESTION_PROTOCOL.md`
- Column Specs: `/specs/columns/`
- Validation Rules: `/validation/rules/`
- Example Files: Check existing files in `canonical_data/`

---

**Remember**: The system is designed to fail safely. If something goes wrong, your data is protected!