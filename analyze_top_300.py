#!/usr/bin/env python3
"""
Analyze and organize top 300 fantasy football players from ADP and projections data.
"""

import pandas as pd
import numpy as np
from typing import Dict, List, Tuple
import json

def load_and_clean_data(adp_path: str, projections_path: str) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """Load and clean the ADP and projections data."""
    # Load ADP data
    adp_df = pd.read_csv(adp_path)
    
    # Clean column names
    adp_df.columns = adp_df.columns.str.strip()
    
    # Load projections data  
    proj_df = pd.read_csv(projections_path)
    proj_df.columns = proj_df.columns.str.strip()
    
    return adp_df, proj_df

def prepare_player_data(adp_df: pd.DataFrame, proj_df: pd.DataFrame) -> pd.DataFrame:
    """Prepare and merge player data from ADP and projections."""
    
    # Sort by ADP (ascending) to get proper draft order
    adp_sorted = adp_df.sort_values('ADP').reset_index(drop=True)
    
    # Take top 300 players by ADP
    top_300 = adp_sorted.head(300).copy()
    
    # Add rank column
    top_300['Rank'] = range(1, 301)
    
    # Create player matching key for projections
    top_300['player_key'] = (top_300['Full Name'].str.lower().str.strip() + '_' + 
                            top_300['Team Abbreviation'].str.lower().str.strip())
    
    proj_df['player_key'] = (proj_df['playerName'].str.lower().str.strip() + '_' + 
                            proj_df['teamName'].str.lower().str.strip())
    
    # Merge with projections to get fantasy points
    merged_df = pd.merge(top_300, 
                        proj_df[['player_key', 'fantasyPoints', 'games']], 
                        on='player_key', 
                        how='left')
    
    # Rename columns for clarity
    merged_df = merged_df.rename(columns={
        'fantasyPoints': 'Projected_Fantasy_Points',
        'Projected Points': 'ADP_Projected_Points',
        'games': 'Projected_Games'
    })
    
    # Use ADP projected points if projection data is missing
    merged_df['Final_Fantasy_Points'] = merged_df['Projected_Fantasy_Points'].fillna(
        merged_df['ADP_Projected_Points']
    )
    
    return merged_df

def analyze_segments(df: pd.DataFrame) -> Dict:
    """Analyze the data in 50-player segments."""
    segments = {}
    
    segment_ranges = [
        (1, 50, "Top 50 (Rounds 1-4 in 12-team)"),
        (51, 100, "Players 51-100 (Rounds 5-8)"), 
        (101, 150, "Players 101-150 (Rounds 9-12)"),
        (151, 200, "Players 151-200 (Rounds 13-16)"),
        (201, 250, "Players 201-250 (Rounds 17-20)"),
        (251, 300, "Players 251-300 (Rounds 21-25)")
    ]
    
    for start, end, label in segment_ranges:
        segment_data = df[(df['Rank'] >= start) & (df['Rank'] <= end)]
        
        # Position distribution
        pos_dist = segment_data['Position'].value_counts().to_dict()
        
        # Average auction value (exclude null values)
        avg_auction = segment_data['Auction Value'].replace(0, np.nan).mean()
        
        # Notable players (highest projected points in segment)
        notable = segment_data.nlargest(5, 'Final_Fantasy_Points')[
            ['Rank', 'Full Name', 'Team Abbreviation', 'Position', 'ADP', 'Auction Value', 'Final_Fantasy_Points']
        ].to_dict('records')
        
        # ADP range
        adp_range = f"{segment_data['ADP'].min():.1f} - {segment_data['ADP'].max():.1f}"
        
        segments[label] = {
            'rank_range': f"{start}-{end}",
            'player_count': len(segment_data),
            'position_distribution': pos_dist,
            'avg_auction_value': round(avg_auction, 2) if not pd.isna(avg_auction) else None,
            'adp_range': adp_range,
            'notable_players': notable
        }
    
    return segments

def create_analysis_report(df: pd.DataFrame, segments: Dict) -> Dict:
    """Create comprehensive analysis report."""
    
    # Overall statistics
    overall_stats = {
        'total_players': len(df),
        'position_breakdown': df['Position'].value_counts().to_dict(),
        'avg_auction_value': round(df['Auction Value'].replace(0, np.nan).mean(), 2),
        'adp_range': f"{df['ADP'].min():.1f} - {df['ADP'].max():.1f}",
        'teams_represented': df['Team Abbreviation'].nunique(),
        'rookies_count': (df['Is Rookie'] == 'Yes').sum()
    }
    
    # Top players by position
    top_by_position = {}
    for pos in ['QB', 'RB', 'WR', 'TE', 'K', 'DST']:
        pos_players = df[df['Position'] == pos].head(10)
        top_by_position[pos] = pos_players[
            ['Rank', 'Full Name', 'Team Abbreviation', 'ADP', 'Auction Value', 'Final_Fantasy_Points']
        ].to_dict('records')
    
    # Value analysis (players with highest auction values)
    high_value_players = df.nlargest(20, 'Auction Value')[
        ['Rank', 'Full Name', 'Team Abbreviation', 'Position', 'ADP', 'Auction Value', 'Final_Fantasy_Points']
    ].to_dict('records')
    
    # ADP vs Auction Value correlation
    correlation_stats = {
        'adp_auction_correlation': df[['ADP', 'Auction Value']].corr().iloc[0, 1] if len(df) > 1 else None,
        'avg_adp': round(df['ADP'].mean(), 2),
        'median_adp': round(df['ADP'].median(), 2)
    }
    
    return {
        'analysis_summary': {
            'description': 'Top 300 Fantasy Football Players Analysis - 2025 Season',
            'data_source': 'ADP and Projections data',
            'methodology': 'Players sorted by ADP (Average Draft Position) ascending order'
        },
        'overall_statistics': overall_stats,
        'segment_analysis': segments,
        'top_players_by_position': top_by_position,
        'high_value_players': high_value_players,
        'correlation_analysis': correlation_stats,
        'data_quality': {
            'complete_data_players': (df['Data Status'] == 'Complete').sum(),
            'partial_data_players': (df['Data Status'] == 'Partial Data').sum(),
            'insufficient_data_players': (df['Data Status'] == 'Insufficient Data').sum()
        }
    }

def main():
    """Main analysis function."""
    try:
        # File paths
        adp_path = '/mnt/c/Users/giraf/Documents/projects/fftool/artifacts/clean_data/adp0_2025.csv'
        proj_path = '/mnt/c/Users/giraf/Documents/projects/fftool/artifacts/clean_data/projections_2025.csv'
        
        print("Loading data...")
        adp_df, proj_df = load_and_clean_data(adp_path, proj_path)
        
        print("Preparing player data...")
        top_300_df = prepare_player_data(adp_df, proj_df)
        
        print("Analyzing segments...")
        segments = analyze_segments(top_300_df)
        
        print("Creating comprehensive report...")
        analysis_report = create_analysis_report(top_300_df, segments)
        
        # Save detailed player list
        output_file = '/mnt/c/Users/giraf/Documents/projects/fftool/top_300_players_detailed.csv'
        top_300_df[['Rank', 'Full Name', 'Team Abbreviation', 'Position', 'ADP', 
                   'Auction Value', 'Final_Fantasy_Points', 'Is Rookie', 'Data Status']].to_csv(
            output_file, index=False
        )
        
        # Save analysis report
        report_file = '/mnt/c/Users/giraf/Documents/projects/fftool/top_300_analysis_comprehensive.json'
        with open(report_file, 'w') as f:
            json.dump(analysis_report, f, indent=2, default=str)
        
        print(f"\nAnalysis complete!")
        print(f"Detailed player list saved to: {output_file}")
        print(f"Analysis report saved to: {report_file}")
        
        # Print summary
        print(f"\n=== TOP 300 FANTASY FOOTBALL PLAYERS ANALYSIS ===")
        print(f"Total Players Analyzed: {analysis_report['overall_statistics']['total_players']}")
        print(f"ADP Range: {analysis_report['overall_statistics']['adp_range']}")
        print(f"Average Auction Value: ${analysis_report['overall_statistics']['avg_auction_value']}")
        print(f"Teams Represented: {analysis_report['overall_statistics']['teams_represented']}")
        print(f"Rookies: {analysis_report['overall_statistics']['rookies_count']}")
        
        print(f"\n=== POSITION BREAKDOWN ===")
        for pos, count in analysis_report['overall_statistics']['position_breakdown'].items():
            print(f"{pos}: {count} players")
            
        return analysis_report
        
    except Exception as e:
        print(f"Error during analysis: {str(e)}")
        import traceback
        traceback.print_exc()
        return None

if __name__ == "__main__":
    main()