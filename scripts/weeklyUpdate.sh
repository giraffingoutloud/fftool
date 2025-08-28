#!/bin/bash

#############################################
# Weekly Data Update Script
# Automates the process of integrating new data files
# Run this each week during the season
#############################################

set -e  # Exit on error

echo "=============================================="
echo "WEEKLY DATA UPDATE"
echo "Date: $(date)"
echo "=============================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    if [ "$1" = "success" ]; then
        echo -e "${GREEN}✅ $2${NC}"
    elif [ "$1" = "error" ]; then
        echo -e "${RED}❌ $2${NC}"
    elif [ "$1" = "warning" ]; then
        echo -e "${YELLOW}⚠️  $2${NC}"
    else
        echo "$2"
    fi
}

# Step 1: Pre-update integrity check
echo "Step 1: Pre-Update Integrity Check"
echo "-----------------------------------"
if npx tsx scripts/verifyIntegrity.ts; then
    print_status "success" "Integrity check passed"
else
    print_status "error" "Integrity check failed! Aborting update."
    exit 1
fi
echo ""

# Step 2: Detect new files
echo "Step 2: Detecting New Files"
echo "---------------------------"
NEW_FILES_OUTPUT=$(npx tsx scripts/detectNewFiles.ts 2>&1)
echo "$NEW_FILES_OUTPUT"

if echo "$NEW_FILES_OUTPUT" | grep -q "Found [1-9]"; then
    print_status "warning" "New files detected"
    NEW_FILES_FOUND=true
else
    print_status "success" "No new files detected"
    NEW_FILES_FOUND=false
fi
echo ""

# Step 3: Register new data sources (if any)
if [ "$NEW_FILES_FOUND" = true ]; then
    echo "Step 3: Registering New Data Sources"
    echo "------------------------------------"
    
    if npx tsx scripts/registerDataSource.ts; then
        print_status "success" "New data sources registered"
    else
        print_status "error" "Failed to register data sources"
        exit 1
    fi
    echo ""
    
    # Step 3a: Update integrity baseline
    echo "Step 3a: Updating Integrity Baseline"
    echo "------------------------------------"
    
    if npx tsx scripts/updateIntegrityBaseline.ts; then
        print_status "success" "Integrity baseline updated"
    else
        print_status "error" "Failed to update baseline"
        exit 1
    fi
    echo ""
else
    echo "Step 3: Skipping Registration (no new files)"
    echo ""
fi

# Step 4: Run ETL Pipeline
echo "Step 4: Running ETL Pipeline"
echo "----------------------------"

ETL_OUTPUT=$(npm run etl:pipeline 2>&1)
if echo "$ETL_OUTPUT" | grep -q "PIPELINE COMPLETED SUCCESSFULLY"; then
    print_status "success" "ETL pipeline completed"
    
    # Extract statistics
    FILES_PROCESSED=$(echo "$ETL_OUTPUT" | grep "Files processed:" | cut -d: -f2 | xargs)
    ROWS_PARSED=$(echo "$ETL_OUTPUT" | grep "Total rows parsed:" | cut -d: -f2 | xargs)
    ROWS_QUARANTINED=$(echo "$ETL_OUTPUT" | grep "Rows quarantined:" | cut -d: -f2 | xargs)
    
    echo "  Files processed: $FILES_PROCESSED"
    echo "  Rows parsed: $ROWS_PARSED"
    echo "  Rows quarantined: $ROWS_QUARANTINED"
else
    print_status "error" "ETL pipeline failed"
    echo "$ETL_OUTPUT"
    exit 1
fi
echo ""

# Step 5: Run Validation Suite
echo "Step 5: Running Validation Suite"
echo "--------------------------------"

VALIDATION_OUTPUT=$(python3 validation/validate_data_complete.py 2>&1)
if echo "$VALIDATION_OUTPUT" | grep -q "COMPLETE VALIDATION FINISHED"; then
    print_status "success" "Validation completed"
    
    # Extract results
    PASS_COUNT=$(echo "$VALIDATION_OUTPUT" | grep '"pass_count":' | cut -d: -f2 | cut -d, -f1 | xargs)
    FAIL_COUNT=$(echo "$VALIDATION_OUTPUT" | grep '"fail_count":' | cut -d: -f2 | cut -d, -f1 | xargs)
    
    echo "  Checks passed: $PASS_COUNT"
    echo "  Checks failed: $FAIL_COUNT"
    
    if [ "$FAIL_COUNT" -gt "30" ]; then
        print_status "warning" "High number of validation failures"
    fi
else
    print_status "error" "Validation failed"
    echo "$VALIDATION_OUTPUT"
    exit 1
fi
echo ""

# Step 6: Post-update integrity check
echo "Step 6: Post-Update Integrity Check"
echo "-----------------------------------"
if npx tsx scripts/verifyIntegrity.ts; then
    print_status "success" "Post-update integrity verified"
else
    print_status "error" "Post-update integrity check failed!"
    exit 1
fi
echo ""

# Step 7: Generate summary report
echo "Step 7: Generating Summary Report"
echo "---------------------------------"

REPORT_DATE=$(date +%Y%m%d_%H%M%S)
REPORT_FILE="reports/weekly_update_${REPORT_DATE}.json"

cat > "$REPORT_FILE" << EOF
{
  "updateDate": "$(date -Iseconds)",
  "week": "$(date +%V)",
  "newFilesFound": $NEW_FILES_FOUND,
  "filesProcessed": ${FILES_PROCESSED:-0},
  "rowsParsed": ${ROWS_PARSED:-0},
  "rowsQuarantined": ${ROWS_QUARANTINED:-0},
  "validationPassed": ${PASS_COUNT:-0},
  "validationFailed": ${FAIL_COUNT:-0},
  "integrityStatus": "verified",
  "status": "success"
}
EOF

print_status "success" "Report saved to $REPORT_FILE"
echo ""

# Step 8: Git commit (optional - uncomment if desired)
# echo "Step 8: Committing Changes"
# echo "--------------------------"
# git add canonical_data/ reports/ specs/
# git commit -m "Weekly update: Week $(date +%V) - $(date +%Y-%m-%d)"
# print_status "success" "Changes committed"
# echo ""

# Final summary
echo "=============================================="
echo "WEEKLY UPDATE COMPLETE"
echo "=============================================="
print_status "success" "All steps completed successfully"

if [ "$NEW_FILES_FOUND" = true ]; then
    print_status "info" "New files have been integrated"
fi

if [ "$FAIL_COUNT" -gt "0" ]; then
    print_status "warning" "Review validation failures in reports/validation/"
fi

echo ""
echo "Next steps:"
echo "1. Review validation reports for any issues"
echo "2. Check quarantined data if any rows were quarantined"
echo "3. Run valuation models with updated data"
echo ""

exit 0