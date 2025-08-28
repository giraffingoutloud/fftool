# Validation Issues Analysis and Fix Plan

## Issue Analysis

### 1. Foreign Key Mismatches (Primary Issue)
**Problem**: 158 player name mismatches between projections and ADP datasets
- 109 players in projections but not in ADP
- 49 players in ADP but not in projections

**Root Causes Identified:**
1. **DST Naming Inconsistency**: 
   - Projections: `"Bears DST"` → normalized to `"bears dst_dst"`
   - ADP: Different format or missing DST entries

2. **Multiple ADP Files**: 
   - adp0_2025.csv: 512 rows but uses "Full Name" column
   - adp1_2025.csv: 4091 rows but has unnamed columns (likely malformed)
   - adp2_2025.csv: 77 rows with "Name" column
   - adp3_2025.csv: 300 rows with "Player" column (most complete)

3. **Column Name Inconsistency**:
   - Player name columns: "playerName", "Player", "Full Name", "Name"
   - Position columns: "position", "Position"
   - Team columns: "teamName", "Team", "Team Abbreviation"

### 2. Data Quality Issues
- **Duplicate Records**: 122 rows quarantined across files
- **Missing Values**: Some auction values and rookie flags missing
- **Team Code Inconsistencies**: BLT, LA, HST, ARZ, CLV not in valid teams list

## Fix Plan

### Phase 1: Create Player Name Normalization Service
1. Build fuzzy matching algorithm for player names
2. Create canonical player registry with all name variations
3. Map DST team names to consistent format

### Phase 2: Standardize Column Names
1. Create column mapping configuration
2. Update robust_loader.py to apply mappings
3. Ensure consistent output column names

### Phase 3: Fix Team Code Mappings
1. Add team code aliases (LA → LAR/LAC, ARZ → ARI, etc.)
2. Update validation rules to accept historical codes

### Phase 4: Improve Foreign Key Validation
1. Use fuzzy matching with confidence threshold
2. Create exception list for known mismatches
3. Generate mapping table for manual review

## Implementation Priority
1. **High**: Player name normalization (fixes 158 errors)
2. **Medium**: Team code mappings (fixes 5+ warnings)
3. **Low**: Column standardization (improves maintainability)

## Success Metrics
- Foreign key validation passes with < 5% mismatches
- No team code warnings
- All DST entries properly matched
- Duplicate detection maintains < 1% rate