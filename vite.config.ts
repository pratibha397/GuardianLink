
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all envs regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '');
  
  // Create a mapping of environment variables to be defined in the client.
  // We explicitly include the ones needed for Aegis Mesh.
  const envDefinitions = Object.keys(env).reduce((acc, key) => {
    if (key.startsWith('FIREBASE_') || key === 'API_KEY') {
      acc[`process.env.${key}`] = JSON.stringify(env[key]);
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
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      emptyOutDir: true
    }
  };
});
