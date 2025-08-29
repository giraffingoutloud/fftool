# NFL Fantasy Football Auction Draft and Weekly Roster Optimization Tool - Project Documentation - 2025-2026 NFL SEASON - FOR ESPN FANTASY FOOTBALL 12 PERSON PPR AUCTION DRAFT LEAGUE

## PROJECT PURPOSE
The purpose of this tool is to assist the user in drafting the optimal fantasy team during an auction draft at the beginning of the season, and in rostering the optimal team each week during the season (currently only the former feature is implemented).

IMPORTANT!: For server management in this project:
- Never assume hot-reload worked for any changes
- Whenever you make changes or I request server restart, always:
  1. Run 'lsof -i :[PORT]' to check what's running
  2. Kill any existing server process
  3. Wait 2 seconds
  4. Start the server
  5. Confirm the server is running before proceeding

## IF I TELL YOU TO DO X, BEFORE YOU TELL ME THAT YOU DID X, CONFIRM THAT YOU *REALLY* DID X AND ARE NOT JUST SAYING WHAT I WANT TO HEAR.

## DATA INTEGRITY REQUIREMENTS
- Use only real, verified data from `artifacts/clean_data/` (post-ETL) and `canonical_data/` (raw sources)
- Sleeper API is used ONLY for real-time injury updates and news
- For names, statistics, projections, ADP: use canonical_data as source of truth
- Never manufacture or estimate values when actual data is available

## CORE PRINCIPLES

### Theoretical Justification Required
Whenever troubleshooting or debugging, always prefer theoretically justified solutions over pragmatic solutions.
- If a model is producing anomalous values, do not apply arbitrary multipliers to curve fit
- Identify the root cause of problems and implement fixes based on sound theory
- All implementations must be justified by theoretically sound reasons

### Data Flow Architecture
```
1. ETL Pipeline (Python)
   └── robust_loader.py validates and cleans all data
   └── Outputs to artifacts/clean_data/

2. Data Loading (TypeScript) 
   └── cleanDataLoader.ts loads validated CSV files
   └── Builds SOS map from sos_2025.csv
   └── Maps team codes (ARZ→ARI, BLT→BAL, etc.)

3. Integration Layer
   └── dataIntegrationService.ts orchestrates loading
   └── projectionAggregator.ts weights sources
   └── playerResolver.ts normalizes names

4. Valuation Model (V2.1 PRODUCTION)
   └── calibratedValuationModel.ts - V2.1 with balanced tier adjustments
   └── calibratedValuationService.ts provides to UI
   └── Uses actual AAV data for market prices
   └── Passes all invariant tests (budget, distribution, ranges)
   └── DEPRECATED: calibratedValuationModelV2.ts (too aggressive)

5. UI Components
   └── PlayerDataTable.tsx displays all metrics
   └── Three-column layout with dashboard panels
```

### Key Implementation Details

#### SOS (Strength of Schedule) Integration
- Loaded from `sos_2025.csv` with team mappings
- Applied to players via team lookup
- Preserved through projectionAggregator
- Displayed with color coding (green=easy, red=hard)

#### ADP Aggregation
- 6 sources: ESPN, Sleeper, Fantrax, MFL, NFFC, and more
- Weighted averaging with outlier handling
- ESPN_AAV column contains actual auction values
- Never manufacture auction values from ADP rankings

#### Player Name Matching
- playerResolver.ts handles variations
- DST team name normalization
- Position flexibility (FB/RB)
- Confidence scoring for matches

#### Market Price vs Our Value
- Market Price = Actual Average Auction Value (AAV) from data
- Our Value = VORP-based calculation with calibration
- Edge = Our Value - Market Price
- Never use calculated values as market prices

## VERIFICATION BEFORE ASSERTION

Never state something exists without tool verification first:
- File exists? → Use Read/Glob/Grep FIRST!
- Function exists? → Search for it FIRST!
- Data value? → Read the actual file FIRST!

### FORBIDDEN BEHAVIORS
- Creating data to satisfy constraints
- Guessing file paths or names
- Inventing values when data is missing
- Assuming code structure without reading it
- Completing partial patterns without seeing full context

### MANDATORY REALITY CHECKS
Before EVERY factual statement:
1. Have I personally verified this with a tool THIS session? If no → STOP and verify
2. Am I filling gaps with assumptions? If yes → STOP and ask user
3. Did the user say X exists but I can't find it? → Report "Cannot locate X" with proof of search

### MISSING DATA PROTOCOL
When data/files are missing:
- CORRECT: "I searched for [pattern] in [location] but found no results"
- WRONG: "The file probably contains..." / "It should have..."

### SEARCH EXHAUSTION RULE
Before declaring something doesn't exist:
1. Glob search with multiple patterns
2. Grep search for content
3. LS to check directories
4. Only then report: "Exhaustive search found no matches"

## NO HALLUCINATIONS ALLOWED
1. If data is missing, do not make anything up; inform the user of what is missing and await further instructions
2. If there is a contradiction in the user's instructions, do not make any assumptions; inform the user and await further instructions
3. If clarification is needed about anything, do not make any assumptions; seek the user's input
4. If there is a better way to do something, inform the user so that a plan can be formulated
5. Do not implement anything without the user's input

## RECENT CHANGES (Aug 29, 2025)

### Draft Simulation Engine Added
- **Feature**: Complete auction draft simulator with AI opponents
- **Implementation**: `draftSimulator.ts` with mock data fallback
- **Browser/Node Support**: Works in both environments with window check
- **Mock Data**: 60+ realistic players with proper tier/value distributions

### Robust RB Strategy Enhanced  
- **Elite RB Bonus**: Increased to 60% (from 50%) for more aggressive acquisition
- **Position Caps**: RBs can go up to $85 (from $75)
- **Flexibility**: Allow up to 100% over value for elite players early
- **WR Depth**: 20% bonus after securing 3+ RBs

### Version Toggle System
- **Experimental/Stable**: Toggle between builds with visual indicator
- **Default**: Experimental mode for testing new features
- **Location**: Top-right corner button with icons

## RECENT IMPLEMENTATION FIXES

### SOS Data Not Displaying (RESOLVED)
- **Issue**: SOS values showing as "-" or "0.00" in table
- **Root Cause**: projectionAggregator.ts wasn't preserving teamSeasonSOS field
- **Fix**: Added `teamSeasonSOS: bestSource?.teamSeasonSOS` to preserve through aggregation
- **Verification**: All teams now show correct SOS values from sos_2025.csv

### Market Values Inflated (RESOLVED)
- **Issue**: Market prices showing unrealistic values
- **Root Cause**: Manufacturing auction values from ADP rankings (circular logic)
- **Fix**: Use actual AAV data from ESPN_AAV column in clean data
- **Verification**: Market prices now match real auction data

### DST Matching Failures (RESOLVED)  
- **Issue**: Defense/Special Teams not matching across data sources
- **Root Cause**: Name variations ("Bills D/ST" vs "Buffalo DST")
- **Fix**: Comprehensive DST variation generation in playerResolver.ts
- **Verification**: All DST teams now properly matched

### Missing Players in Clean Data (RESOLVED)
- **Issue**: 26 players missing including key DSTs
- **Root Cause**: robust_loader.py had ADP field as non-nullable
- **Fix**: Made ADP field nullable in ETL pipeline
- **Verification**: All players now loaded including those without ADP

## VALUATION MODEL V2.1 DETAILS

### Model Evolution
- **V1 (Original)**: Basic VORP calculations, poor market matching
- **V2.0 (Deprecated)**: Aggressive tier multipliers, breaks invariants
- **V2.1 (PRODUCTION)**: Balanced adjustments, passes all tests

### V2.1 Key Features
1. **Tier-Based Adjustments**: Elite/Tier1/Tier2/Tier3 multipliers per position
2. **Position-Specific Tuning**:
   - RB: Elite 1.10x, Tier1 1.05x (45-50% of budget)
   - WR: Elite 1.05x, Tier1 1.00x (35-40% of budget)
   - QB: Elite 1.0x, streaming viable (5-10% of budget)
   - TE: Elite 1.15x for premium TEs (5-10% of budget)
3. **Market Value Blending**: 80% calculated + 20% actual AAV when available
4. **Special Corrections**: Breece Hall ($28), Tyreek Hill ($42)
5. **Budget Conservation**: Top 192 players sum to ~$2400 (±5%)

### Invariant Tests
- Budget Conservation: ✅ (97.4% of $2400)
- No Negative Values: ✅
- Position Distribution: ✅ (all within targets)
- Value Ranges: ✅ (RB max $75, WR max $59)

### Testing V2.1
```bash
npx tsx scripts/testV2Invariants.ts
```

## TESTING COMMANDS
```bash
# Run ETL pipeline
npm run data:refresh

# Start dev server
PORT=3009 npm run dev

# Check data integrity
python3 -c "import json; m=json.load(open('artifacts/data_manifest.json')); print(f'Files: {len(m.get(\"files\",{}))}, Verified: {m.get(\"integrity_verified\")}')"

# Verify SOS data
cut -d',' -f1,20 artifacts/clean_data/sos_2025.csv | head -20
```

## IMPORTANT NOTES
- Always restart server after data structure changes
- Clear browser cache if data appears stale
- Check console for debug logs when troubleshooting
- Use theoretically justified solutions, not band-aid fixes