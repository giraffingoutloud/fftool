import axios from 'axios';
import type { Player } from '@/types';

interface SleeperPlayer {
  player_id: string;
  first_name: string;
  last_name: string;
  team: string;
  position: string;
  injury_status?: 'Q' | 'D' | 'O' | 'IR' | 'PUP' | 'SUS' | null;
  injury_notes?: string;
  news_updated?: string;
  status?: string;
  age?: number;
}

interface SleeperNews {
  player_id: string;
  news: string;
  timestamp: string;
}

export class SleeperAPI {
  private readonly BASE_URL = 'https://api.sleeper.app/v1';
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private lastRequest = 0;
  private readonly MIN_REQUEST_INTERVAL = 100; // 100ms between requests

  // ONLY expose injury update functionality
  async getInjuryUpdatesOnly(players: Player[]): Promise<Map<string, Partial<Player>>> {
    const injuryMap = new Map<string, Partial<Player>>();
    
    try {
      const sleeperPlayers = await this.fetchPlayerInjuryData();
      
      for (const player of players) {
        const match = this.findSleeperMatch(player, sleeperPlayers);
        if (match && match.injury_status) {
          // ONLY update injury status, nothing else
          injuryMap.set(player.id, {
            injuryStatus: match.injury_status as Player['injuryStatus']
          });
        }
      }
    } catch (error) {
      console.warn('Failed to fetch Sleeper injury updates, continuing without:', error);
      // Return empty map on failure - don't break the app
    }
    
    return injuryMap;
  }
  
  async getPlayerUpdates(players: Player[]): Promise<Map<string, Partial<Player>>> {
    // Redirect old method to new injury-only method
    return this.getInjuryUpdatesOnly(players);
  }

  private async throttledRequest<T>(url: string): Promise<T> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequest;
    
    if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
      await new Promise(resolve => 
        setTimeout(resolve, this.MIN_REQUEST_INTERVAL - timeSinceLastRequest)
      );
    }
    
    this.lastRequest = Date.now();
    const response = await axios.get<T>(url);
    return response.data;
  }
  
  private async fetchPlayerInjuryData(): Promise<any[]> {
    const cacheKey = 'injury_data';
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }
    
    const data = await this.throttledRequest<{ [key: string]: SleeperPlayer }>(
      `${this.BASE_URL}/players/nfl`
    );
    
    // Filter to only players with injury status
    const injuredPlayers = Object.values(data).filter(
      (p: any) => p.injury_status && p.injury_status !== null
    );
    
    this.cache.set(cacheKey, { data: injuredPlayers, timestamp: Date.now() });
    return injuredPlayers;
  }

  private findSleeperMatch(
    player: Player, 
    sleeperPlayers: SleeperPlayer[]
  ): SleeperPlayer | null {
    const normalizedName = this.normalizeName(player.name);
    
    const exactMatch = sleeperPlayers.find(sp => {
      const sleeperName = this.normalizeName(`${sp.first_name} ${sp.last_name}`);
      return sleeperName === normalizedName && sp.position === player.position;
    });
    
    if (exactMatch) return exactMatch;
    
    const fuzzyMatch = sleeperPlayers.find(sp => {
      const sleeperName = `${sp.first_name} ${sp.last_name}`;
      return this.isNameMatch(player.name, sleeperName) && 
             sp.position === player.position;
    });
    
    return fuzzyMatch || null;
  }

  private normalizeName(name: string): string {
    return name.toLowerCase()
      .replace(/[^a-z\s]/g, '')
      .replace(/\s+/g, ' ')
      .replace(/(jr|sr|ii|iii|iv|v)$/g, '')
      .trim();
  }

  private isNameMatch(name1: string, name2: string): boolean {
    const n1 = this.normalizeName(name1);
    const n2 = this.normalizeName(name2);
    
    if (n1 === n2) return true;
    
    const parts1 = n1.split(' ');
    const parts2 = n2.split(' ');
    
    if (parts1[0] === parts2[0] && parts1[parts1.length - 1] === parts2[parts2.length - 1]) {
      return true;
    }
    
    return false;
  }

  async getTrendingPlayers(): Promise<{ player_id: string; count: number }[]> {
    try {
      const response = await axios.get(
        `${this.BASE_URL}/players/nfl/trending/add`
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching trending players:', error);
      return [];
    }
  }
}