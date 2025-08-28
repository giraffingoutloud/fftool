import { DepthChartEntry, DepthChartTeam, Position } from '@/types';
import { normalizeTeamName } from './teamMappings';

// Parse depth chart file with custom state-machine parser
function parseDepthChartFile(content: string): DepthChartTeam[] {
  const lines = content.trim().split('\n');
  const teams: DepthChartTeam[] = [];
  
  let currentTeam: DepthChartTeam | null = null;
  let currentSection: 'QB' | 'RB' | 'WR' | 'TE' | null = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines
    if (!line) {
      continue;
    }
    
    // Check if it's a team header (quoted team name)
    if (line.startsWith('"') && line.endsWith('"')) {
      const teamName = line.replace(/"/g, '');
      const teamAbbr = normalizeTeamName(teamName);
      
      if (teamAbbr) {
        // Save previous team if exists
        if (currentTeam) {
          teams.push(currentTeam);
        }
        
        // Start new team
        currentTeam = {
          team: teamAbbr,
          QB: [],
          RB: [],
          WR: [],
          TE: []
        };
        currentSection = null;
      }
      continue;
    }
    
    // Check if it's a position header line
    if (line.includes('Quarterbacks') || line.includes('Running Backs') || 
        line.includes('Wide Receivers') || line.includes('Tight Ends')) {
      // This is the header row with positions
      continue;
    }
    
    // Parse data rows
    if (currentTeam && line.includes(',')) {
      const values = line.split(',').map(v => v.replace(/"/g, '').trim());
      
      // Parse each position column (ECR, Name pairs)
      let colIndex = 0;
      
      // QB (columns 0-1)
      if (colIndex < values.length - 1) {
        const qbEcr = values[colIndex];
        const qbName = values[colIndex + 1];
        if (qbEcr && qbName && qbName !== '') {
          currentTeam.QB.push({
            team: currentTeam.team,
            position: 'QB' as Position,
            name: qbName,
            ecr: parseInt(qbEcr) || 999,
            depthOrder: currentTeam.QB.length + 1
          });
        }
        colIndex += 2;
      }
      
      // RB (columns 2-3)
      if (colIndex < values.length - 1) {
        const rbEcr = values[colIndex];
        const rbName = values[colIndex + 1];
        if (rbEcr && rbName && rbName !== '') {
          currentTeam.RB.push({
            team: currentTeam.team,
            position: 'RB' as Position,
            name: rbName,
            ecr: parseInt(rbEcr) || 999,
            depthOrder: currentTeam.RB.length + 1
          });
        }
        colIndex += 2;
      }
      
      // WR (columns 4-5)
      if (colIndex < values.length - 1) {
        const wrEcr = values[colIndex];
        const wrName = values[colIndex + 1];
        if (wrEcr && wrName && wrName !== '') {
          currentTeam.WR.push({
            team: currentTeam.team,
            position: 'WR' as Position,
            name: wrName,
            ecr: parseInt(wrEcr) || 999,
            depthOrder: currentTeam.WR.length + 1
          });
        }
        colIndex += 2;
      }
      
      // TE (columns 6-7)
      if (colIndex < values.length - 1) {
        const teEcr = values[colIndex];
        const teName = values[colIndex + 1];
        if (teEcr && teName && teName !== '') {
          currentTeam.TE.push({
            team: currentTeam.team,
            position: 'TE' as Position,
            name: teName,
            ecr: parseInt(teEcr) || 999,
            depthOrder: currentTeam.TE.length + 1
          });
        }
      }
    }
  }
  
  // Add last team
  if (currentTeam) {
    teams.push(currentTeam);
  }
  
  return teams;
}

// Load depth charts from file
export async function loadDepthCharts(): Promise<{
  teams: DepthChartTeam[];
  byPlayer: Map<string, DepthChartEntry>;
  byTeam: Map<string, DepthChartTeam>;
}> {
  try {
    const response = await fetch('/canonical_data/advanced_data/fantasy_pros_data/FantasyPros_Fantasy_Football_2025_Depth_Charts.csv');
    const content = await response.text();
    
    const teams = parseDepthChartFile(content);
    
    // Create lookup maps
    const byPlayer = new Map<string, DepthChartEntry>();
    const byTeam = new Map<string, DepthChartTeam>();
    
    for (const team of teams) {
      byTeam.set(team.team, team);
      
      // Add all players to byPlayer map
      for (const qb of team.QB) {
        const key = `${qb.name.toLowerCase().trim()}_QB`;
        byPlayer.set(key, qb);
      }
      
      for (const rb of team.RB) {
        const key = `${rb.name.toLowerCase().trim()}_RB`;
        byPlayer.set(key, rb);
      }
      
      for (const wr of team.WR) {
        const key = `${wr.name.toLowerCase().trim()}_WR`;
        byPlayer.set(key, wr);
      }
      
      for (const te of team.TE) {
        const key = `${te.name.toLowerCase().trim()}_TE`;
        byPlayer.set(key, te);
      }
    }
    
    return { teams, byPlayer, byTeam };
  } catch (error) {
    console.warn('Failed to load depth charts:', error);
    return {
      teams: [],
      byPlayer: new Map(),
      byTeam: new Map()
    };
  }
}

// Helper to determine player role based on depth order
export function getPlayerRole(depthOrder: number, position: Position): 'starter' | 'backup' | 'depth' {
  switch (position) {
    case 'QB':
      return depthOrder === 1 ? 'starter' : depthOrder === 2 ? 'backup' : 'depth';
    case 'RB':
      return depthOrder <= 2 ? 'starter' : depthOrder === 3 ? 'backup' : 'depth';
    case 'WR':
      return depthOrder <= 3 ? 'starter' : depthOrder <= 5 ? 'backup' : 'depth';
    case 'TE':
      return depthOrder === 1 ? 'starter' : depthOrder === 2 ? 'backup' : 'depth';
    default:
      return 'depth';
  }
}

// Helper to get ADP tier from ECR
export function getADPTierFromECR(ecr: number, position: Position): number {
  // Convert ECR to tier (0-5 scale)
  // Position-specific tier breaks
  const tierBreaks: Record<Position, number[]> = {
    QB: [6, 12, 18, 24, 32],    // Elite, Very Good, Good, Average, Below Average, Replacement
    RB: [12, 24, 36, 48, 60],
    WR: [12, 24, 36, 48, 60],
    TE: [6, 12, 18, 24, 32],
    DST: [6, 12, 18, 24, 32],
    K: [6, 12, 18, 24, 32]
  };
  
  const breaks = tierBreaks[position] || [12, 24, 36, 48, 60];
  
  for (let tier = 5; tier >= 1; tier--) {
    if (ecr <= breaks[5 - tier]) {
      return tier;
    }
  }
  
  return 0; // Replacement level
}