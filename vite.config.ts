
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Use casting to any for process to fix the "Property 'cwd' does not exist on type 'Process'" error
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  const envDefinitions = Object.keys(env).reduce((acc, key) => {
    if (key.startsWith('FIREBASE_') || key === 'API_KEY' || key === 'AZURE_MAPS_KEY') {
      acc[`process.env.${key}`] = JSON.stringify(env[key] || "");
    }
    return acc;
  }, {} as Record<string, string>);

  return {
    plugins: [react()],
    define: {
      ...envDefinitions,
      'process.env.NODE_ENV': JSON.stringify(mode),
    },
    server: {
      port: 5173,
      host: true
    }
  };
});
