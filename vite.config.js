import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The `/rpc` proxy mirrors the netlify.toml redirect so the same relative URLs
// work in dev and in production. `/api` is served by Netlify Functions — run
// `npm run netlify:dev` to exercise them locally; plain `npm run dev` proxies
// /api to the Netlify dev server if it happens to be running on 8888.
export default defineConfig({
  plugins: [react()],
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
    proxy: {
      '/rpc': {
        target: 'https://rpc.xerisweb.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/rpc/, ''),
      },
      '/api': {
        target: 'http://localhost:8888',
        changeOrigin: true,
      },
    },
  },
})
