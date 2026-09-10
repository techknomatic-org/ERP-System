import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const rawApiUrl = env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api';
  // Strip trailing /api for Vite proxy target
  const proxyTarget = rawApiUrl.startsWith('http') 
    ? rawApiUrl.replace(/\/api\/?$/, '') 
    : 'http://127.0.0.1:8000';

  return {
    appType: 'spa',
    plugins: [react()],
    server: {
      port: 5173,
      host: '0.0.0.0',
      strictPort: true,
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
          secure: false,
        }
      }
    }
  }
})

