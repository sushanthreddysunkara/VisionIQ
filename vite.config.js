import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (err, _req, res) => {
            if (res && res.writeHead && !res.headersSent) {
              res.writeHead(502, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: 'Backend connecting...' }))
            }
          })
        },
      },
      '/socket.io': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        ws: true,
        configure: (proxy) => {
          proxy.on('error', () => {
            // Gracefully handle transient socket reconnects during backend restarts
          })
        },
      },
      '/evidence': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
      '/images': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
    },
  },
})
