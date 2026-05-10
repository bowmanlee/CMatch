import {
  setSecurityHeaders,
  handleCors,
  sendJson,
  readJsonBody,
  checkSitePassword,
} from '../server/core.mjs'
import { addSubmissionSafe } from '../server/practitioner-storage.mjs'

// ═══════════════════════════════════════════════════════════════════════════════
// VERCEL SERVERLESS HANDLER — practitioner signup submission
// ═══════════════════════════════════════════════════════════════════════════════

const EXTRA_ORIGINS = process.env.ALLOWED_ORIGIN
  ? [process.env.ALLOWED_ORIGIN]
  : []

export default async function handler(request, response) {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`)

  setSecurityHeaders(response)
  if (handleCors(request, response, EXTRA_ORIGINS)) {
    response.writeHead(204)
    response.end()
    return
  }

  if (request.method !== 'POST' || url.pathname !== '/api/practitioner-signup') {
    sendJson(response, 404, { error: 'not_found', message: 'Unknown route.' })
    return
  }

  const pwdCheck = checkSitePassword(request)
  if (!pwdCheck.ok) {
    sendJson(response, 403, { error: pwdCheck.error, message: pwdCheck.message })
    return
  }

  try {
    const payload = await readJsonBody(request)

    // Basic validation
    const required = ['fullName', 'email', 'phone', 'clinicName', 'districts', 'specialties', 'modalities', 'bio']
    const missing = required.filter((key) => {
      const val = payload[key]
      if (Array.isArray(val)) return val.length === 0
      return !val || (typeof val === 'string' && !val.trim())
    })

    if (missing.length > 0) {
      sendJson(response, 400, { error: 'validation_failed', message: `Missing fields: ${missing.join(', ')}` })
      return
    }

    const submission = addSubmissionSafe(payload)
    sendJson(response, 201, { ok: true, id: submission.id })
  } catch (error) {
    sendJson(response, 500, {
      error: 'server_error',
      message: error instanceof Error ? error.message : 'Failed to save submission.',
    })
  }
}
