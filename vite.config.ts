
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Load env file from the current directory. 
  // Third parameter '' allows loading variables without VITE_ prefix (needed for Vercel's API_KEY)
  // Cast process to any to resolve the 'cwd' does not exist error if Node types are not picked up correctly.
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  return {
    plugins: [react()],
    define: {
      // This is the CRITICAL fix. It replaces every instance of process.env.API_KEY 
      // in your code with the actual string from your Vercel/env settings.
      'process.env.API_KEY': JSON.stringify(env.API_KEY || '')
    },
    server: {
      port: 5173,
      host: true
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      emptyOutDir: true
    }
  };
});
