#!/usr/bin/env node

/**
 * Draft Simulation Runner
 * Works around import.meta issues in Node environment
 */

// Mock import.meta for Node.js environment
global.import = {
  meta: {
    env: {
      BASE_URL: '/'
    },
    url: 'file://' + __filename
  }
};

// Now run the simulation
import('./testDraftSimulationComplete.js').catch(console.error);