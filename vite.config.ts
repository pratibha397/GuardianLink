
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  const envDefinitions = Object.keys(env).reduce((acc, key) => {
    // Pass through critical environment keys for production and local use
    if (key.startsWith('FIREBASE_') || key === 'API_KEY') {
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
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      emptyOutDir: true,
      rollupOptions: {
        input: {
          main: './index.html'
        }
      }
    }
  };
});
