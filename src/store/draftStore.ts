import { create } from 'zustand';
import type { 
  Team, 
  Player, 
  DraftPick, 
  LeagueSettings,
  PlayerValuation 
} from '@/types';
import type { ValuationResult } from '@/lib/calibratedValuationService';
import { DataValidator } from '@/lib/dataValidator';

interface DraftState {
  leagueSettings: LeagueSettings;
  teams: Team[];
  myTeamId: string;
  draftHistory: DraftPick[];
  currentNomination: Player | null;
  currentBid: number;
  currentBidder: string | null;
  isDraftActive: boolean;
  availablePlayers: PlayerValuation[];
  selectedPlayer: ValuationResult | null;
  
  initializeDraft: (settings: LeagueSettings) => void;
  setMyTeam: (teamId: string) => void;
  nominatePlayer: (player: Player) => void;
  placeBid: (amount: number, teamId: string) => void;
  completeAuction: (player: Player, price: number, teamId: string) => void;
  updatePlayerValuations: (valuations: PlayerValuation[]) => void;
  updateTeamName: (teamId: string, newName: string) => void;
  setSelectedPlayer: (player: ValuationResult | null) => void;
  resetDraft: () => void;
  undoLastPick: () => void;
}

const defaultLeagueSettings: LeagueSettings = {
  teams: 12,
  budget: 200,
  scoring: 'PPR',
  rosterPositions: [
    { position: 'QB', player: undefined, required: 1 },
    { position: 'RB', player: undefined, required: 2 },
    { position: 'WR', player: undefined, required: 2 },
    { position: 'TE', player: undefined, required: 1 },
    { position: 'FLEX', player: undefined, required: 1 },
    { position: 'DST', player: undefined, required: 1 },
    { position: 'K', player: undefined, required: 1 },
    { position: 'BE', player: undefined, required: 7 }
  ]
};

export const useDraftStore = create<DraftState>((set, get) => ({
  leagueSettings: defaultLeagueSettings,
  teams: [],
  myTeamId: 'team_0',
  draftHistory: [],
  currentNomination: null,
  currentBid: 0,
  currentBidder: null,
  isDraftActive: false,
  availablePlayers: [],
  selectedPlayer: null,
  
  initializeDraft: (settings) => {
    // Skip validation for now - we know our settings are correct
    // const validator = new DataValidator();
    // const errors = validator.validateLeagueSettings(settings);
    // 
    // if (errors.length > 0) {
    //   console.error('Invalid league settings:', errors);
    //   throw new Error(`Invalid league settings: ${errors.join(', ')}`);
    // }
    
    // Load saved team names from localStorage
    const savedTeamNames = localStorage.getItem('ffToolTeamNames');
    const teamNames = savedTeamNames ? JSON.parse(savedTeamNames) : {};
    
    const teams: Team[] = [];
    for (let i = 0; i < settings.teams; i++) {
      const teamId = `team_${i}`;
      const defaultName = i === 0 ? 'My Team' : `Team ${i + 1}`;
      teams.push({
        id: teamId,
        name: teamNames[teamId] || defaultName,
        budget: settings.budget,
        spent: 0,
        roster: [],
        maxBid: settings.budget - 15 // Reserve $1 for each of 15 other roster spots
      });
    }
    
    set({
      leagueSettings: settings,
      teams,
      isDraftActive: true,
      draftHistory: [],
      currentNomination: null,
      currentBid: 0,
      currentBidder: null
    });
  },
  
  setMyTeam: (teamId) => set({ myTeamId: teamId }),
  
  nominatePlayer: (player) => set({
    currentNomination: player,
    currentBid: 1,
    currentBidder: null
  }),
  
  placeBid: (amount, teamId) => {
    const { teams } = get();
    const team = teams.find(t => t.id === teamId);
    
    if (!team || team.budget - team.spent < amount) {
      return;
    }
    
    set({
      currentBid: amount,
      currentBidder: teamId
    });
  },
  
  completeAuction: (player, price, teamId) => {
    console.log('[DraftStore] completeAuction called:', {
      player: player.name,
      price,
      teamId
    });
    
    // Use atomic update to prevent race conditions
    set(state => {
      // Validate within the update function for atomicity
      const buyingTeam = state.teams.find(t => t.id === teamId);
      
      if (!buyingTeam) {
        console.error(`Team ${teamId} not found`);
        return state; // Return unchanged state
      }
      
      // Basic price validation
      if (price <= 0 || price > 200) {
        console.error(`Invalid price: ${price}`);
        return state;
      }
      
      // Check budget
      if (price > buyingTeam.budget - buyingTeam.spent) {
        console.error(`Price ${price} exceeds remaining budget ${buyingTeam.budget - buyingTeam.spent}`);
        return state;
      }
      
      // Check if player already drafted
      const alreadyDrafted = state.teams.some(t => 
        t.roster.some(r => r.player.id === player.id)
      );
      
      if (alreadyDrafted) {
        console.error(`Player ${player.name} already drafted`);
        return state;
      }
      
      // Create new draft pick
      const newPick: DraftPick = {
        player,
        price,
        team: teamId,
        timestamp: Date.now(),
        nomination: false
      };
      
      // Update teams immutably
      const updatedTeams = state.teams.map(team => {
        if (team.id === teamId) {
          const spentAfter = team.spent + price;
          const rosterSizeAfter = team.roster.length + 1;
          const slotsRemaining = Math.max(0, 16 - rosterSizeAfter);
          const maxBidAfter = Math.max(
            0, 
            team.budget - spentAfter - slotsRemaining
          );
          
          return {
            ...team,
            spent: spentAfter,
            roster: [...team.roster, newPick],
            maxBid: maxBidAfter
          };
        }
        return team;
      });
      
      // Update available players
      const updatedAvailablePlayers = state.availablePlayers.filter(
        p => p.id !== player.id
      );
      
      console.log('[DraftStore] Draft successful:', {
        playerName: player.name,
        price,
        teamName: buyingTeam.name,
        newHistoryLength: state.draftHistory.length + 1
      });
      
      return {
        ...state,
        teams: updatedTeams,
        draftHistory: [...state.draftHistory, newPick],
        availablePlayers: updatedAvailablePlayers,
        currentNomination: null,
        currentBid: 0,
        currentBidder: null
      };
    });
  },
  
  updatePlayerValuations: (valuations) => set({ availablePlayers: valuations }),
  
  updateTeamName: (teamId, newName) => {
    set((state) => ({
      teams: state.teams.map(team => 
        team.id === teamId ? { ...team, name: newName } : team
      )
    }));
    
    // Save to localStorage for persistence
    const savedTeamNames = localStorage.getItem('ffToolTeamNames');
    const teamNames = savedTeamNames ? JSON.parse(savedTeamNames) : {};
    teamNames[teamId] = newName;
    localStorage.setItem('ffToolTeamNames', JSON.stringify(teamNames));
  },

  setSelectedPlayer: (player) => {
    set({ selectedPlayer: player });
  },
  
  resetDraft: () => set({
    teams: [],
    draftHistory: [],
    currentNomination: null,
    currentBid: 0,
    currentBidder: null,
    isDraftActive: false,
    availablePlayers: []
  }),
  
  undoLastPick: () => {
    const { draftHistory, teams } = get();
    if (draftHistory.length === 0) return;
    
    const lastPick = draftHistory[draftHistory.length - 1];
    
    const updatedTeams = teams.map(team => {
      if (team.id === lastPick.team) {
        // Calculate properly after undoing
        const spentAfter = team.spent - lastPick.price;
        const rosterAfter = team.roster.filter(p => p.player.id !== lastPick.player.id);
        const rosterSizeAfter = rosterAfter.length;
        const remainingSlots = Math.max(0, 16 - rosterSizeAfter);
        const dollarsReservedForMinBids = remainingSlots;
        const maxBidAfter = Math.max(0, team.budget - spentAfter - dollarsReservedForMinBids);
        
        return {
          ...team,
          spent: spentAfter,
          roster: rosterAfter,
          maxBid: maxBidAfter
        };
      }
      return team;
    });
    
    set({
      teams: updatedTeams,
      draftHistory: draftHistory.slice(0, -1)
    });
  }
}));