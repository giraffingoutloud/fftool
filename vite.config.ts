import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: '/fftool/', // GitHub repo name for GitHub Pages
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
  build: {
    outDir: 'dist',
    sourcemap: true,
    // Ensure assets are properly handled
    assetsDir: 'assets',
    // Copy public files to dist
    copyPublicDir: true
  }
});