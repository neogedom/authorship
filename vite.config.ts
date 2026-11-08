import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

function readBody(req: import('node:http').IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk) => (data += chunk))
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

function devApi(): Plugin {
  return {
    name: 'dev-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || ''
        if (!url.startsWith('/api/')) return next()
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('Method Not Allowed')
          return
        }
        try {
          const body = await readBody(req)
          if (url.startsWith('/api/github/device/code')) {
            const upstream = await fetch('https://github.com/login/device/code', {
              method: 'POST',
              headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
              body,
            })
            res.statusCode = upstream.status
            res.setHeader('Content-Type', 'application/json')
            res.end(await upstream.text())
            return
          }
          if (url.startsWith('/api/github/device/token')) {
            const upstream = await fetch('https://github.com/login/oauth/access_token', {
              method: 'POST',
              headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
              body,
            })
            res.statusCode = upstream.status
            res.setHeader('Content-Type', 'application/json')
            res.end(await upstream.text())
            return
          }
          if (url.startsWith('/api/run')) {
            const parsed = JSON.parse(body || '{}') as { prompt?: string; templateId?: string }
            if (!parsed.prompt) {
              res.statusCode = 400
              res.end('Missing prompt')
              return
            }
            const key = process.env.OPENAI_API_KEY || process.env.LLM_API_KEY
            const model = process.env.LLM_MODEL || 'gpt-4.1-mini'
            if (!key) {
              res.setHeader('Content-Type', 'application/json')
              res.end(
                JSON.stringify({
                  text:
                    `Backend dev sem chave (defina OPENAI_API_KEY/LLM_API_KEY).\n\n` +
                    `Template: ${parsed.templateId || 'desconhecido'}\n` +
                    `Prévia do prompt:\n${parsed.prompt.slice(0, 1200)}`,
                }),
              )
              return
            }
            const upstream = await fetch('https://api.openai.com/v1/responses', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${key}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ model, input: parsed.prompt }),
            })
            res.statusCode = upstream.status
            res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json')
            res.end(await upstream.text())
            return
          }
          next()
        } catch (err) {
          res.statusCode = 500
          res.end(err instanceof Error ? err.message : String(err))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [
    devApi(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Autoria do Livro',
        short_name: 'Autoria',
        description: 'PWA para escrever e revisar capítulos com sync GitHub',
        theme_color: '#111827',
        background_color: '#f9fafb',
        display: 'standalone',
        start_url: '/',
        lang: 'pt-BR',
        icons: [
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 5,
            },
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
})
