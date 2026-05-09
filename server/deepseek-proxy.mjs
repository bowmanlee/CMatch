import { createServer } from 'node:http'
import { existsSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  DEEPSEEK_MODEL,
  setSecurityHeaders,
  handleCors,
  sendJson,
  readJsonBody,
  conversationWithDeepSeek,
  checkSitePassword,
} from './core.mjs'

// ═══════════════════════════════════════════════════════════════════════════════
// LOAD .env / .env.local — for local development only
// ═══════════════════════════════════════════════════════════════════════════════
const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
for (const envPath of [resolve(root, '.env'), resolve(root, '.env.local')]) {
  if (existsSync(envPath)) {
    const lines = readFileSync(envPath, 'utf8').split(/\r?\n/)
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const separatorIndex = trimmed.indexOf('=')
      if (separatorIndex === -1) continue
      const key = trimmed.slice(0, separatorIndex).trim()
      const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, '')
      if (key) process.env[key] = value
    }
  }
}

const HOST = process.env.CMATCH_API_HOST ?? '127.0.0.1'
const PORT = Number.parseInt(process.env.CMATCH_API_PORT ?? '8787', 10)

// ═══════════════════════════════════════════════════════════════════════════════
// NOTE: RATE LIMITING
// In-memory rate limiting does NOT work on serverless (Vercel).
// For production, use one of:
//   - Vercel Edge Middleware with Edge Config or Upstash Redis
//   - Cloudflare WAF / AWS WAF at the CDN edge
// This local dev server has no rate limiting — deploy behind a reverse proxy
// or WAF that handles it.
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// HTTP SERVER
// ═══════════════════════════════════════════════════════════════════════════════

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? `${HOST}:${PORT}`}`)

  setSecurityHeaders(response)
  if (handleCors(request, response)) {
    response.writeHead(204)
    response.end()
    return
  }

  if (request.method === 'GET' && url.pathname === '/api/health') {
    sendJson(response, 200, {
      ok: true,
      service: 'cmatch-api',
      model: DEEPSEEK_MODEL,
      deepseekConfigured: Boolean(process.env.DEEPSEEK_API_KEY),
    })
    return
  }

  const isConversation = request.method === 'POST' && (url.pathname === '/api/conversation' || url.pathname === '/api/deepseek/conversation')
  if (isConversation) {
    const pwdCheck = checkSitePassword(request)
    if (!pwdCheck.ok) {
      sendJson(response, 403, { error: pwdCheck.error, message: pwdCheck.message })
      return
    }
    try {
      const payload = await readJsonBody(request)
      const result = await conversationWithDeepSeek(payload)
      sendJson(response, result.statusCode, result.payload)
    } catch (error) {
      sendJson(response, 400, {
        error: error instanceof Error ? error.message : 'invalid_request',
        message: 'The request could not be processed.',
      })
    }
    return
  }

  if (request.method === 'POST' && url.pathname === '/api/verify-password') {
    const pwdCheck = checkSitePassword(request)
    if (!pwdCheck.ok) {
      sendJson(response, 403, { error: pwdCheck.error, message: pwdCheck.message })
      return
    }
    sendJson(response, 200, { ok: true })
    return
  }

  if (request.method === 'POST' && url.pathname === '/api/deepseek/analyze') {
    sendJson(response, 410, { error: 'deprecated', message: 'Use /api/deepseek/conversation instead.' })
    return
  }

  if (request.method === 'POST' && url.pathname === '/api/deepseek/analyze-stream') {
    sendJson(response, 410, { error: 'deprecated', message: 'Use /api/deepseek/conversation instead.' })
    return
  }

  sendJson(response, 404, { error: 'not_found', message: 'Unknown CMatch API route.' })
})

server.listen(PORT, HOST, () => {
  console.log(`[cmatch-api] listening on http://${HOST}:${PORT}`)
  console.log(`[cmatch-api] model=${DEEPSEEK_MODEL} deepseekConfigured=${Boolean(process.env.DEEPSEEK_API_KEY)}`)
})
