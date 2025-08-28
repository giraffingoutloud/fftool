import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: parseInt(process.env.PORT || '3000'),
    host: true,
    fs: {
      // Allow serving files from project root
      strict: false,
      allow: ['..']
    }
  },
});