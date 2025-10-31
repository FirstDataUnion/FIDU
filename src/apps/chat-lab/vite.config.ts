import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // Determine if we should drop console logs
  // Keep console logs in development mode or when VITE_KEEP_CONSOLE_LOGS is true
  const shouldDropConsole = mode === 'production' && process.env.VITE_KEEP_CONSOLE_LOGS !== 'true'
  
  return {
    plugins: [react()],
    base: '/fidu-chat-lab/',
    server: {
      proxy: {
        // Direct API calls (when pathname does not include base)
        '/api': {
          target: 'http://localhost:8080',
          changeOrigin: true,
          // Rewrite to backend's BASE_PATH so FastAPI routes match
          rewrite: (path) => `/fidu-chat-lab${path}`,
        },
        // API calls when the app is served under the base path in dev
        '/fidu-chat-lab/api': {
          target: 'http://localhost:8080',
          changeOrigin: true,
        },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            mui: ['@mui/material', '@mui/icons-material'],
            redux: ['@reduxjs/toolkit', 'react-redux'],
            utils: ['dayjs', 'uuid']
          }
        }
      },
      chunkSizeWarningLimit: 1000,
      sourcemap: mode === 'development', // Enable sourcemaps in development
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: shouldDropConsole, // Conditionally remove console.log
          drop_debugger: true
        }
      }
    },
    optimizeDeps: {
      include: ['react', 'react-dom', '@mui/material', '@mui/icons-material']
    }
  }
})