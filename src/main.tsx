import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './AppWithVersionToggle'; // App with version toggle
import './index.css';

// Import validation functions for browser console access
import './lib/validateAllData';
import './lib/quickDataTest';
import './lib/testStrictParsing';
import './lib/runFullValidation';
import './lib/fullZeroToleranceAudit';
import './lib/runAuditNow';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);