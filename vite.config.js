import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Social scrapers (X, Discord, Telegram, Slack) will not follow a relative
 * `og:image` — a card with a relative path renders with no image at all. They
 * need an absolute URL, which means the site's own origin has to be known at
 * build time.
 *
 * Netlify sets `URL` to the site's primary address during a build, so on
 * Netlify this is automatic. Locally, or on another host, set SITE_URL.
 * `%SITE_URL%` placeholders in index.html are replaced with the result.
 */
function siteUrl() {
  const raw = process.env.SITE_URL || process.env.URL || 'http://localhost:5173'
  return raw.replace(/\/$/, '')
}

function injectSiteUrl() {
  return {
    name: 'inject-site-url',
    transformIndexHtml(html) {
      return html.replaceAll('%SITE_URL%', siteUrl())
    },
  }
}

export default defineConfig({
  plugins: [react(), injectSiteUrl()],
  build: {
    // The landing page is the only route most visitors ever see, and they see
    // it on a phone. Splitting the heavy, rarely-first-visited libraries keeps
    // that first paint small without hand-maintaining a chunk map.
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          motion: ['framer-motion'],
        },
      },
    },
  },
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
    proxy: {
      // Mirrors the netlify.toml redirect so the same relative URLs work in
      // dev and in production.
      '/rpc': {
        target: 'https://rpc.xerisweb.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/rpc/, ''),
      },
      // Netlify Functions. Run `npx netlify dev` to exercise them locally;
      // plain `npm run dev` proxies through to it if it is running on 8888.
      '/api': {
        target: 'http://localhost:8888',
        changeOrigin: true,
      },
    },
  },
})
