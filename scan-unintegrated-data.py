#!/usr/bin/env python3
"""
Scan canonical_data to identify unintegrated fantasy-relevant fields
"""

import os
import csv
import json
from collections import defaultdict

def scan_canonical_data():
    base_path = '/mnt/c/Users/giraf/Documents/projects/fftool/canonical_data'
    
    # Fantasy-relevant fields to look for
    fantasy_relevant_keywords = {
        # Player info
        'height', 'weight', 'college', 'year', 'draft',
        # Performance stats
        'yards', 'touchdowns', 'attempts', 'completions', 'targets', 'receptions',
        'rushing', 'passing', 'receiving', 'carries', 'catches',
        # Advanced metrics
        'grade', 'snap', 'pff', 'separation', 'target_share', 'air_yards',
        'redzone', 'goal_line', 'broken_tackles', 'yards_after',
        # Team/matchup
        'opponent', 'strength_of_schedule', 'sos', 'defense_rank',
        # Injury/status
        'status', 'injury', 'questionable', 'probable', 'doubtful',
        # Depth chart
        'depth', 'starter', 'backup', 'roster_position'
    }
    
    findings = defaultdict(list)
    file_headers = {}
    
    # Scan all CSV files
    for root, dirs, files in os.walk(base_path):
        for file in files:
            if file.endswith('.csv'):
                filepath = os.path.join(root, file)
                rel_path = filepath.replace(base_path + '/', '')
                
                try:
                    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                        reader = csv.reader(f)
                        headers = next(reader, [])
                        
                        # Clean headers
                        headers = [h.strip().strip('"').lower() for h in headers]
                        file_headers[rel_path] = headers
                        
                        # Check for fantasy-relevant fields
                        for header in headers:
                            for keyword in fantasy_relevant_keywords:
                                if keyword in header:
                                    findings[keyword].append({
                                        'file': rel_path,
                                        'column': header
                                    })
                except Exception as e:
                    print(f"Error reading {rel_path}: {e}")
    
    # Identify key unintegrated data
    unintegrated = {
        'height_weight': [],
        'college_draft': [],
        'advanced_stats': [],
        'snap_counts': [],
        'redzone_stats': [],
        'strength_of_schedule': [],
        'depth_chart': [],
        'status_injury': []
    }
    
    # Categorize findings
    for keyword, occurrences in findings.items():
        if keyword in ['height', 'weight']:
            unintegrated['height_weight'].extend(occurrences)
        elif keyword in ['college', 'year', 'draft']:
            unintegrated['college_draft'].extend(occurrences)
        elif keyword in ['grade', 'pff', 'separation', 'air_yards']:
            unintegrated['advanced_stats'].extend(occurrences)
        elif 'snap' in keyword:
            unintegrated['snap_counts'].extend(occurrences)
        elif keyword in ['redzone', 'goal_line']:
            unintegrated['redzone_stats'].extend(occurrences)
        elif keyword in ['strength_of_schedule', 'sos', 'defense_rank']:
            unintegrated['strength_of_schedule'].extend(occurrences)
        elif keyword in ['depth', 'starter', 'backup']:
            unintegrated['depth_chart'].extend(occurrences)
        elif keyword in ['status', 'injury', 'questionable']:
            unintegrated['status_injury'].extend(occurrences)
    
    # Remove duplicates
    for category in unintegrated:
        seen = set()
        unique = []
        for item in unintegrated[category]:
            key = f"{item['file']}:{item['column']}"
            if key not in seen:
                seen.add(key)
                unique.append(item)
        unintegrated[category] = unique
    
    return unintegrated, file_headers

if __name__ == '__main__':
    unintegrated, headers = scan_canonical_data()
    
    print("=== Unintegrated Fantasy-Relevant Data ===\n")
    
    for category, items in unintegrated.items():
        if items:
            print(f"\n{category.replace('_', ' ').title()}:")
            # Show first 3 examples per category
            for item in items[:3]:
                print(f"  - {item['file']}: {item['column']}")
            if len(items) > 3:
                print(f"  ... and {len(items) - 3} more")
    
    # Specific high-value findings
    print("\n=== High-Value Unintegrated Data ===")
    
    # Check for specific files
    key_files = {
        'adp/adp2_2025.csv': ['status', 'fantasy score'],
        'advanced_data/2025-2026/49ers.csv': ['height', 'weight', 'college', 'off_grade', 'recv_grade'],
        'projections/FantasyPros_Fantasy_Football_Projections_RB.csv': ['att', 'yds', 'tds', 'rec', 'fl'],
        'strength_of_schedule/strength_of_schedule_2025.txt': []
    }
    
    for file_key, expected_cols in key_files.items():
        for path, cols in headers.items():
            if file_key in path:
                print(f"\n{path}:")
                for col in cols[:10]:  # First 10 columns
                    if any(exp in col for exp in expected_cols) or not expected_cols:
                        print(f"  - {col}")
    
    # Save to JSON for reference
    output = {
        'unintegrated_categories': {k: len(v) for k, v in unintegrated.items() if v},
        'total_files_scanned': len(headers),
        'recommendations': []
    }
    
    # Add recommendations
    if unintegrated['height_weight']:
        output['recommendations'].append("Integrate height/weight from team roster files for size-adjusted metrics")
    if unintegrated['redzone_stats']:
        output['recommendations'].append("Integrate redzone targets/touches for scoring opportunity analysis")
    if unintegrated['snap_counts']:
        output['recommendations'].append("Integrate snap counts to identify usage trends")
    if unintegrated['status_injury']:
        output['recommendations'].append("Integrate injury status from adp2_2025.csv")
    if unintegrated['strength_of_schedule']:
        output['recommendations'].append("Integrate strength of schedule for matchup-adjusted projections")
    
    with open('/mnt/c/Users/giraf/Documents/projects/fftool/unintegrated_data_report.json', 'w') as f:
        json.dump(output, f, indent=2)
    
    print(f"\n=== Summary ===")
    print(f"Files scanned: {len(headers)}")
    print(f"Categories with unintegrated data: {len([k for k, v in unintegrated.items() if v])}")
    print("\nReport saved to: unintegrated_data_report.json")