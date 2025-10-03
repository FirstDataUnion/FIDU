import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // Determine if we should drop console logs
  // Keep console logs in development mode or when VITE_KEEP_CONSOLE_LOGS is true
  const shouldDropConsole = mode === 'production' && process.env.VITE_KEEP_CONSOLE_LOGS !== 'true'
  
  return {
    plugins: [react()],
    base: '/fidu-chat-lab/',
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