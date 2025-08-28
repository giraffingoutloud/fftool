import type { 
  PlayerValuation, 
  Team, 
  DraftPick,
  Position 
} from '@/types';

type AuctionState = 
  | 'waiting'
  | 'player_nominated'
  | 'bidding_active'
  | 'going_once'
  | 'going_twice'
  | 'sold'
  | 'passed'
  | 'paused'
  | 'completed';

interface AuctionContext {
  currentPlayer: PlayerValuation | null;
  currentBid: number;
  currentBidder: string | null;
  nominatingTeam: string;
  timeRemaining: number;
  bidHistory: BidEvent[];
  teamBudgets: Map<string, number>;
  rosterSlots: Map<string, number>;
}

interface BidEvent {
  playerId: string;
  teamId: string;
  amount: number;
  timestamp: number;
  type: 'nomination' | 'bid' | 'win' | 'pass';
}

interface StateTransition {
  from: AuctionState;
  to: AuctionState;
  event: string;
  guard?: (context: AuctionContext) => boolean;
  action?: (context: AuctionContext) => void;
}

export class AuctionStateMachine {
  private currentState: AuctionState;
  private context: AuctionContext;
  private transitions: StateTransition[];
  private listeners: Map<string, Set<(event: any) => void>>;
  private timers: Map<string, NodeJS.Timeout>;
  
  constructor(initialBudgets: Map<string, number>) {
    this.currentState = 'waiting';
    this.context = {
      currentPlayer: null,
      currentBid: 0,
      currentBidder: null,
      nominatingTeam: '',
      timeRemaining: 0,
      bidHistory: [],
      teamBudgets: new Map(initialBudgets),
      rosterSlots: this.initializeRosterSlots(initialBudgets)
    };
    this.listeners = new Map();
    this.timers = new Map();
    
    this.transitions = this.defineTransitions();
  }
  
  private initializeRosterSlots(initialBudgets: Map<string, number>): Map<string, number> {
    const slots = new Map<string, number>();
    const teams = Array.from(initialBudgets.keys());
    teams.forEach(team => slots.set(team, 16)); // Standard roster size
    return slots;
  }
  
  private defineTransitions(): StateTransition[] {
    return [
      // Start auction
      {
        from: 'waiting',
        to: 'player_nominated',
        event: 'NOMINATE_PLAYER',
        action: (ctx) => this.startNomination(ctx)
      },
      
      // Begin bidding
      {
        from: 'player_nominated',
        to: 'bidding_active',
        event: 'OPEN_BIDDING',
        action: (ctx) => this.openBidding(ctx)
      },
      
      // Place bid
      {
        from: 'bidding_active',
        to: 'bidding_active',
        event: 'PLACE_BID',
        guard: (ctx) => this.canPlaceBid(ctx),
        action: (ctx) => this.processBid(ctx)
      },
      
      // Going once
      {
        from: 'bidding_active',
        to: 'going_once',
        event: 'NO_BIDS_TIMER',
        action: (ctx) => this.startGoingOnce(ctx)
      },
      
      // Reset to active bidding
      {
        from: 'going_once',
        to: 'bidding_active',
        event: 'PLACE_BID',
        guard: (ctx) => this.canPlaceBid(ctx),
        action: (ctx) => this.resetBidding(ctx)
      },
      
      // Going twice
      {
        from: 'going_once',
        to: 'going_twice',
        event: 'GOING_ONCE_TIMER',
        action: (ctx) => this.startGoingTwice(ctx)
      },
      
      // Reset from going twice
      {
        from: 'going_twice',
        to: 'bidding_active',
        event: 'PLACE_BID',
        guard: (ctx) => this.canPlaceBid(ctx),
        action: (ctx) => this.resetBidding(ctx)
      },
      
      // Sold
      {
        from: 'going_twice',
        to: 'sold',
        event: 'GOING_TWICE_TIMER',
        action: (ctx) => this.completeAuction(ctx)
      },
      
      // No bids - passed
      {
        from: 'player_nominated',
        to: 'passed',
        event: 'NO_OPENING_BID',
        action: (ctx) => this.passPlayer(ctx)
      },
      
      // Next player
      {
        from: 'sold',
        to: 'waiting',
        event: 'NEXT_PLAYER',
        action: (ctx) => this.resetForNext(ctx)
      },
      
      // Next after pass
      {
        from: 'passed',
        to: 'waiting',
        event: 'NEXT_PLAYER',
        action: (ctx) => this.resetForNext(ctx)
      },
      
      // Pause auction
      {
        from: 'bidding_active',
        to: 'paused',
        event: 'PAUSE',
        action: (ctx) => this.pauseAuction(ctx)
      },
      
      // Resume auction
      {
        from: 'paused',
        to: 'bidding_active',
        event: 'RESUME',
        action: (ctx) => this.resumeAuction(ctx)
      },
      
      // Complete auction
      {
        from: 'waiting',
        to: 'completed',
        event: 'COMPLETE_AUCTION',
        guard: (ctx) => this.isAuctionComplete(ctx),
        action: (ctx) => this.finalizeAuction(ctx)
      }
    ];
  }
  
  transition(event: string, data?: any): boolean {
    const validTransitions = this.transitions.filter(
      t => t.from === this.currentState && t.event === event
    );
    
    for (const transition of validTransitions) {
      if (!transition.guard || transition.guard(this.context)) {
        // Execute action if defined
        if (transition.action) {
          // Pass event data through context update
          this.updateContext(data);
          transition.action(this.context);
        }
        
        // Update state
        const previousState = this.currentState;
        this.currentState = transition.to;
        
        // Emit state change event
        this.emit('stateChange', {
          from: previousState,
          to: this.currentState,
          event,
          context: this.context
        });
        
        return true;
      }
    }
    
    return false;
  }
  
  private updateContext(data: any): void {
    if (data?.player) {
      this.context.currentPlayer = data.player;
    }
    if (data?.bid) {
      this.context.currentBid = data.bid;
    }
    if (data?.bidder) {
      this.context.currentBidder = data.bidder;
    }
    if (data?.nominator) {
      this.context.nominatingTeam = data.nominator;
    }
  }
  
  // Action methods
  private startNomination(ctx: AuctionContext): void {
    ctx.timeRemaining = 10; // 10 seconds to open bidding
    this.startTimer('nomination', 10000, () => {
      this.transition('NO_OPENING_BID');
    });
  }
  
  private openBidding(ctx: AuctionContext): void {
    ctx.currentBid = ctx.currentPlayer?.marketPrice || 1;
    ctx.timeRemaining = 30; // 30 seconds initial bidding
    this.startTimer('bidding', 30000, () => {
      this.transition('NO_BIDS_TIMER');
    });
  }
  
  private processBid(ctx: AuctionContext): void {
    if (!ctx.currentPlayer) return;
    
    ctx.bidHistory.push({
      playerId: ctx.currentPlayer.id,
      teamId: ctx.currentBidder!,
      amount: ctx.currentBid,
      timestamp: Date.now(),
      type: 'bid'
    });
    
    // Reset bidding timer
    this.clearTimer('bidding');
    ctx.timeRemaining = 10; // 10 seconds after each bid
    this.startTimer('bidding', 10000, () => {
      this.transition('NO_BIDS_TIMER');
    });
  }
  
  private startGoingOnce(ctx: AuctionContext): void {
    ctx.timeRemaining = 3; // 3 seconds for "going once"
    this.startTimer('going_once', 3000, () => {
      this.transition('GOING_ONCE_TIMER');
    });
  }
  
  private startGoingTwice(ctx: AuctionContext): void {
    ctx.timeRemaining = 3; // 3 seconds for "going twice"
    this.startTimer('going_twice', 3000, () => {
      this.transition('GOING_TWICE_TIMER');
    });
  }
  
  private resetBidding(ctx: AuctionContext): void {
    this.clearTimer('going_once');
    this.clearTimer('going_twice');
    this.processBid(ctx);
  }
  
  private completeAuction(ctx: AuctionContext): void {
    if (!ctx.currentPlayer || !ctx.currentBidder) return;
    
    // Update budgets
    const currentBudget = ctx.teamBudgets.get(ctx.currentBidder) || 0;
    ctx.teamBudgets.set(ctx.currentBidder, currentBudget - ctx.currentBid);
    
    // Update roster slots
    const currentSlots = ctx.rosterSlots.get(ctx.currentBidder) || 0;
    ctx.rosterSlots.set(ctx.currentBidder, currentSlots - 1);
    
    // Record win
    ctx.bidHistory.push({
      playerId: ctx.currentPlayer.id,
      teamId: ctx.currentBidder,
      amount: ctx.currentBid,
      timestamp: Date.now(),
      type: 'win'
    });
    
    // Emit sold event
    this.emit('playerSold', {
      player: ctx.currentPlayer,
      team: ctx.currentBidder,
      amount: ctx.currentBid
    });
  }
  
  private passPlayer(ctx: AuctionContext): void {
    if (!ctx.currentPlayer) return;
    
    ctx.bidHistory.push({
      playerId: ctx.currentPlayer.id,
      teamId: ctx.nominatingTeam,
      amount: 0,
      timestamp: Date.now(),
      type: 'pass'
    });
    
    this.emit('playerPassed', {
      player: ctx.currentPlayer
    });
  }
  
  private resetForNext(ctx: AuctionContext): void {
    ctx.currentPlayer = null;
    ctx.currentBid = 0;
    ctx.currentBidder = null;
    ctx.timeRemaining = 0;
    this.clearAllTimers();
  }
  
  private pauseAuction(ctx: AuctionContext): void {
    this.clearAllTimers();
    this.emit('auctionPaused', { context: ctx });
  }
  
  private resumeAuction(ctx: AuctionContext): void {
    // Restart timer with remaining time
    if (ctx.timeRemaining > 0) {
      this.startTimer('bidding', ctx.timeRemaining * 1000, () => {
        this.transition('NO_BIDS_TIMER');
      });
    }
    this.emit('auctionResumed', { context: ctx });
  }
  
  private finalizeAuction(ctx: AuctionContext): void {
    this.clearAllTimers();
    this.emit('auctionCompleted', { 
      bidHistory: ctx.bidHistory,
      finalBudgets: ctx.teamBudgets 
    });
  }
  
  // Guard methods
  private canPlaceBid(ctx: AuctionContext): boolean {
    if (!ctx.currentBidder || !ctx.currentPlayer) return false;
    
    const budget = ctx.teamBudgets.get(ctx.currentBidder) || 0;
    const slots = ctx.rosterSlots.get(ctx.currentBidder) || 0;
    const minRequired = slots - 1; // Must save $1 for each remaining slot
    
    return ctx.currentBid <= budget - minRequired;
  }
  
  private isAuctionComplete(ctx: AuctionContext): boolean {
    // Check if all teams have full rosters
    for (const [team, slots] of ctx.rosterSlots) {
      if (slots > 0) return false;
    }
    return true;
  }
  
  // Timer management
  private startTimer(name: string, delay: number, callback: () => void): void {
    this.clearTimer(name);
    this.timers.set(name, setTimeout(callback, delay));
  }
  
  private clearTimer(name: string): void {
    const timer = this.timers.get(name);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(name);
    }
  }
  
  private clearAllTimers(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }
  
  // Event management
  on(event: string, callback: (data: any) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }
  
  off(event: string, callback: (data: any) => void): void {
    this.listeners.get(event)?.delete(callback);
  }
  
  private emit(event: string, data: any): void {
    this.listeners.get(event)?.forEach(callback => callback(data));
  }
  
  // Public methods
  getState(): AuctionState {
    return this.currentState;
  }
  
  getContext(): Readonly<AuctionContext> {
    return { ...this.context };
  }
  
  canBid(teamId: string, amount: number): boolean {
    const budget = this.context.teamBudgets.get(teamId) || 0;
    const slots = this.context.rosterSlots.get(teamId) || 0;
    const minRequired = slots - 1;
    
    return amount <= budget - minRequired && amount > this.context.currentBid;
  }
  
  getBidHistory(playerId?: string): BidEvent[] {
    if (playerId) {
      return this.context.bidHistory.filter(b => b.playerId === playerId);
    }
    return [...this.context.bidHistory];
  }
  
  getTeamStatus(teamId: string): {
    budget: number;
    spent: number;
    rostersSlots: number;
    maxBid: number;
  } {
    const budget = this.context.teamBudgets.get(teamId) || 0;
    const slots = this.context.rosterSlots.get(teamId) || 0;
    const initialBudget = 200; // Standard budget
    
    return {
      budget,
      spent: initialBudget - budget,
      rostersSlots: slots,
      maxBid: Math.max(1, budget - (slots - 1))
    };
  }
}