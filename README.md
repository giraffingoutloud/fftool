# Fantasy Football Auction Draft Tool

A comprehensive fantasy football tool for ESPN 12-person PPR auction draft leagues for the 2025-2026 NFL season. Features advanced valuation models, real-time market analysis, strength of schedule integration, and data-driven draft recommendations powered by a robust ETL pipeline.

## Features

### Core Functionality
- **V2.1 Calibrated Valuation Model**: VORP-based valuations with balanced tier adjustments that pass all invariant tests
- **Real-Time Edge Calculations**: Shows value opportunities (Our Value - Market Price)
- **Strength of Schedule (SOS) Integration**: Season-long difficulty ratings for all 32 teams
- **Multi-Source ADP Aggregation**: Weighted averaging from 6 different fantasy sources
- **Smart Tier System**: Elite, Tier 1-3, and Replacement level classifications
- **Comprehensive Player Table**: Sortable columns with color-coded metrics
- **Three-Column Layout**: Organized dashboard with budget allocation, market tracking, and draft history

### Data Integration
The tool uses a Python ETL pipeline with TypeScript frontend integration:
- **Clean Data Pipeline**: Automated validation and deduplication via `robust_loader.py`
- **Player Projections**: Aggregated from FantasyPros, CBS, and baseline projections
- **ADP Sources**: 6 sources including ESPN, Sleeper, Fantrax, MFL, NFFC with AAV data
- **Strength of Schedule**: Team-by-team difficulty ratings for full season and playoffs
- **Market Values**: Actual Average Auction Values (AAV) from ESPN and other platforms
- **Player Matching**: Advanced name normalization and DST variation handling
- **Data Quality**: Integrity verification with quarantine for invalid records

## League Settings (ESPN Standard)
- 12 teams, $200 budget
- PPR scoring
- Roster: 1 QB, 2 RB, 2 WR, 1 TE, 1 FLEX, 1 DST, 1 K, 7 Bench

## Getting Started

1. **Install Dependencies**
```bash
npm install
```

2. **Run Data Pipeline** (if needed)
```bash
npm run data:refresh
```

3. **Start Development Server**
```bash
npm run dev
```
Or on a specific port:
```bash
PORT=3009 npm run dev
```

4. **Access Application**
Open http://localhost:3009 (or your configured port) in your browser

## Architecture

### Key Components

#### Data Layer (`src/lib/`)
- **`cleanDataLoader.ts`**: Loads validated data from Python ETL pipeline
- **`dataService.ts`**: Unified interface for all data operations
- **`dataIntegrationService.ts`**: Orchestrates data loading and aggregation
- **`projectionAggregator.ts`**: Weighted averaging of projection sources
- **`playerResolver.ts`**: Advanced player name and team matching
- **`sosLoader.ts`**: Loads and maps strength of schedule data

#### Valuation Engine (V2.1 Production Model)
- **`calibratedValuationModel.ts`**: V2.1 VORP-based valuation with balanced tier adjustments
- **`calibratedValuationService.ts`**: Service layer integrating valuations with UI
- **Market Price Integration**: Uses actual AAV data with 80/20 blending when available
- **Edge Calculations**: Real-time value opportunities (Intrinsic Value - Market Price)
- **Confidence Scoring**: Statistical confidence based on data quality and sources
- **Invariant Testing**: Automated tests ensure budget conservation and position balance

#### UI Components (`src/components/`)
- **`PlayerDataTable.tsx`**: Comprehensive sortable table with all metrics
- **`CalibrationDashboard.tsx`**: Compact top panel with key metrics
- **`BudgetAllocator.tsx`**: Visual budget allocation by position
- **`MarketTrackerCalibrated.tsx`**: Real-time market trend analysis
- **`TeamStrengthAnalyzer.tsx`**: Team composition and strength metrics
- **`DraftHistory.tsx`**: Track drafted players and spending

### Data Flow
1. **ETL Pipeline**: Python `robust_loader.py` validates and cleans all data sources
2. **Data Loading**: `cleanDataLoader` loads artifacts with SOS integration
3. **Integration**: `dataIntegrationService` aggregates projections and ADP data
4. **Player Matching**: `playerResolver` normalizes names across sources
5. **Valuation**: `calibratedValuationModel` calculates VORP-based values
6. **Market Analysis**: Compare intrinsic values with actual AAV data
7. **UI Display**: Three-column layout with sortable table and visualizations

## Model Validation & Invariant Tests

The V2.1 valuation model passes all critical invariant tests to ensure fair and balanced auction values:

### ✅ Invariant Test Results
1. **Budget Conservation**: Top 192 players = $2,338 (97.4% of $2,400 target) ✅
2. **Position Distribution**: All positions within historical spending patterns ✅
   - RB: 45.3% (target: 45-50%)
   - WR: 39.9% (target: 35-40%) 
   - QB: 6.6% (target: 5-10%)
   - TE: 7.1% (target: 5-10%)
3. **No Negative Values**: All 572 players have positive values ✅
4. **Reasonable Ranges**: Max values within realistic limits ✅
   - Max RB: $75 (limit: $80)
   - Max WR: $59 (limit: $75)

### Running Invariant Tests
```bash
npx tsx scripts/testV2Invariants.ts
```

This ensures the model maintains fairness across all roster positions and league sizes.

## Data Sources

### Clean Data (Post-ETL)
Processed data in `artifacts/clean_data/`:
- **Projections**: `projections_2025.csv` (aggregated from multiple sources)
- **ADP Data**: `adp0_2025.csv` through `adp5_2025.txt` (6 different sources)
- **SOS Data**: `sos_2025.csv` (team strength of schedule)
- **Team Data**: Individual team CSV files
- **Historical Stats**: `fantasy-stats-*_2024.csv`

### Raw Data
Original data in `canonical_data/`:
- **FantasyPros**: Projections, rankings, advanced stats
- **CBS**: Position-specific projections
- **Sleeper API**: Real-time updates (injuries, news)
- **Team Metrics**: Performance and efficiency data

## Valuation Model

### Calibrated VORP System
The calibrated valuation model uses Value Over Replacement Player (VORP) with market corrections:

1. **Replacement Level Calculation**
   - Position-specific baselines (QB12, RB30, WR36, TE12)
   - FLEX-aware adjustments for RB/WR/TE
   - Dynamic updates based on available players

2. **Value Calculation**
   - Points Above Replacement (PAR) = Projected Points - Replacement Points
   - Raw Auction Value = (PAR / Total PAR) × Total Budget × Position Multiplier
   - Market Adjustment = Calibration factor based on actual AAV data

3. **Confidence Scoring**
   - Based on number of projection sources
   - Data quality metrics
   - Historical accuracy for similar players

### Position-Specific Factors

#### Running Backs
- Yards before/after contact
- Target share and receiving usage
- Red zone carries
- Goal-line role

#### Wide Receivers
- Target share and air yards
- Yards after catch
- Separation metrics
- Red zone targets

#### Quarterbacks
- TD rate and yards per attempt
- Pressure/sack rates
- Supporting cast quality
- Offensive system fit

## Strength of Schedule (SOS)

### Implementation
SOS data is loaded from `sos_2025.csv` and mapped to players by team:
- **Season SOS**: Full season difficulty rating (0-10 scale)
- **Playoff SOS**: Weeks 15-17 difficulty for fantasy playoffs
- **Team Mappings**: Handles variations (ARZ→ARI, BLT→BAL, etc.)

### Display
- Color-coded in player table (green=easy, red=hard)
- Sortable column for strategic planning
- Integrated into valuation adjustments

## Key Algorithms

### Edge Calculation
```
Edge = Our Valuation - Market Price (AAV)
```
- Positive edge = undervalued opportunity
- Negative edge = overpriced player
- Displayed as both dollar amount and percentage

### Tier Classification
- **Elite**: Top 3 at position
- **Tier 1**: Ranks 4-8
- **Tier 2**: Ranks 9-20
- **Tier 3**: Startable with value > $5
- **Replacement**: Below starter threshold

## Usage

### Main Interface
The application uses a three-column layout:

**Left Column:**
- Budget Allocator: Visual budget distribution by position
- Team Strength Analyzer: Roster composition metrics

**Center Column:**
- Player Data Table: Comprehensive sortable player list
- Calibration Dashboard: Key metrics and model parameters

**Right Column:**
- Market Tracker: Real-time value trends
- Draft History: Track selections and spending

### Table Columns
- **Name/Team**: Player identification with team colors
- **Tier**: Elite/Tier1-3/Replacement classification
- **Rank**: Overall value ranking
- **Our Value**: Model's calculated fair value
- **Max Bid**: Maximum recommended bid (85% of value)
- **Market**: Actual Average Auction Value (AAV)
- **Edge**: Value opportunity (Our Value - Market)
- **Edge%**: Percentage value over market
- **Points**: Projected fantasy points
- **ADP**: Average Draft Position across sources
- **VORP**: Value Over Replacement Player
- **Confidence**: Model confidence (0-10)
- **SOS**: Strength of Schedule (0-10)

## Recommendation Categories
- **STRONG BUY**: Significant positive edge, high confidence
- **BUY**: Moderate positive edge
- **FAIR**: Near market value
- **PASS**: Slightly overpriced
- **AVOID**: Significantly overpriced or roster doesn't need

## Technologies Used

### Frontend
- **React 18** + **TypeScript**: Type-safe component architecture
- **Vite**: Fast build tooling and HMR
- **TailwindCSS**: Utility-first styling
- **Lucide Icons**: Consistent icon system
- **Papa Parse**: CSV parsing with duplicate column handling

### Data Pipeline
- **Python ETL**: `robust_loader.py` for data validation
- **TypeScript Integration**: Clean data loader with caching
- **Player Matching**: Advanced name normalization
- **Data Quality**: Quarantine system for invalid records

## Performance Optimizations
- **Data Structures**: Map-based lookups for O(1) access
- **Parallel Loading**: Promise.all for concurrent data fetching
- **Caching**: 5-minute TTL cache for clean data
- **Lazy Loading**: Show More/Less functionality in tables
- **Efficient Aggregation**: Single-pass projection weighting
- **Component Optimization**: React.memo for expensive renders

## Data Quality & Validation

### ETL Pipeline Features
- **Schema Validation**: Type checking and range validation
- **Deduplication**: Intelligent conflict resolution
- **Name Normalization**: Handles variations and nicknames
- **DST Matching**: Comprehensive team defense variations
- **Data Quarantine**: Invalid records isolated for review
- **Integrity Verification**: Post-load validation checks

### Player Resolver
- Handles name variations ("A.J." vs "AJ")
- DST team variations ("49ers D/ST" vs "San Francisco DST")
- Position flexibility (FB/RB interchangeability)
- Confidence scoring for matches

## Development Guidelines

### Code Principles
1. **Theoretically Justified**: All implementations must have sound theoretical basis
2. **Root Cause Fixes**: Address underlying issues, not symptoms
3. **Type Safety**: Full TypeScript coverage with proper interfaces
4. **Data Integrity**: Never manufacture data; use actual sources
5. **Performance**: Optimize for large datasets (500+ players)

### Project Structure
```
fftool/
├── artifacts/          # ETL output data
│   └── clean_data/    # Validated CSV files
├── canonical_data/    # Original data sources
├── etl/              # Python data pipeline
├── src/
│   ├── components/   # React components
│   ├── lib/         # Core business logic
│   ├── types/       # TypeScript definitions
│   └── utils/       # Helper functions
└── scripts/         # Build and data scripts
```

### Running Tests
```bash
npm run test          # Run test suite
npm run typecheck     # TypeScript validation
npm run lint         # Code quality checks
```

## Notes
- All valuations update dynamically as players are drafted
- The tool accounts for roster construction and positional scarcity
- Advanced metrics provide deeper insights than raw projections
- Data integrity maintained through canonical sources only