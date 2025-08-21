import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({}) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  
  return {
    plugins: [react()],
    base: '/fidu-chat-lab/',
    server: {
      // NLP workbench proxy removed - now using gateway service directly
    }
  }
})
