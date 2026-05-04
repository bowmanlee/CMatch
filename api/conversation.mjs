import { z } from 'zod'
import {
  DEEPSEEK_MODEL,
  setSecurityHeaders,
  handleCors,
  sendJson,
  readJsonBody,
  conversationWithDeepSeek,
} from '../server/core.mjs'

// ═══════════════════════════════════════════════════════════════════════════════
// INPUT VALIDATION (Zod)
// ═══════════════════════════════════════════════════════════════════════════════

const MessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(8000),
})

const ConversationPayloadSchema = z.object({
  messages: z.array(MessageSchema).min(1).max(50),
  currentSchema: z.record(z.any()).optional(),
})

// ═══════════════════════════════════════════════════════════════════════════════
// CORS ORIGINS
// ═══════════════════════════════════════════════════════════════════════════════

const EXTRA_ORIGINS = process.env.ALLOWED_ORIGIN
  ? [process.env.ALLOWED_ORIGIN]
  : []

// ═══════════════════════════════════════════════════════════════════════════════
// VERCEL SERVERLESS HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

export default async function handler(request, response) {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`)

  setSecurityHeaders(response)
  if (handleCors(request, response, EXTRA_ORIGINS)) {
    response.writeHead(204)
    response.end()
    return
  }

  if (request.method === 'GET' && url.pathname === '/api/health') {
    sendJson(response, 200, { ok: true, service: 'cmatch-api' })
    return
  }

  if (request.method !== 'POST' || url.pathname !== '/api/conversation') {
    sendJson(response, 404, { error: 'not_found', message: 'Unknown route.' })
    return
  }

  try {
    const payload = await readJsonBody(request)
    const parseResult = ConversationPayloadSchema.safeParse(payload)

    if (!parseResult.success) {
      const issues = parseResult.error.issues.map(i => i.message).join('; ')
      sendJson(response, 400, { error: 'invalid_request', message: issues })
      return
    }

    const result = await conversationWithDeepSeek(parseResult.data)
    sendJson(response, result.statusCode, result.payload)
  } catch (error) {
    sendJson(response, 400, {
      error: 'bad_request',
      message: error instanceof Error ? error.message : 'Invalid request',
    })
  }
}
