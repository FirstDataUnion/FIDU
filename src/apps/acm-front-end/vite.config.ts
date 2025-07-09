import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '')
  
  return {
    plugins: [react()],
    base: '/acm-lab/',
    server: {
      proxy: {
        '^/api/nlp-workbench/.*': {
          target: 'https://wb.nlp-processing.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/nlp-workbench/, '/api/public'),
          configure: (proxy, _options) => {
            proxy.on('proxyReq', (proxyReq, _req, _res) => {
              // Add the API key header on the server side
              if (env.VITE_NLP_WORKBENCH_AGENT_API_KEY) {
                proxyReq.setHeader('X-API-Key', env.VITE_NLP_WORKBENCH_AGENT_API_KEY);
              } else {
                console.warn('NLP Workbench API key not set. Please set VITE_NLP_WORKBENCH_AGENT_API_KEY environment variable.');
              }
            });
          }
        }
      }
    }
  }
})
