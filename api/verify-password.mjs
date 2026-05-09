import {
  setSecurityHeaders,
  handleCors,
  sendJson,
  checkSitePassword,
} from '../server/core.mjs'

// ═══════════════════════════════════════════════════════════════════════════════
// VERCEL SERVERLESS HANDLER — lightweight password check
// ═══════════════════════════════════════════════════════════════════════════════

export default async function handler(request, response) {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`)

  setSecurityHeaders(response)
  if (handleCors(request, response)) {
    response.writeHead(204)
    response.end()
    return
  }

  if (request.method !== 'POST' || url.pathname !== '/api/verify-password') {
    sendJson(response, 404, { error: 'not_found', message: 'Unknown route.' })
    return
  }

  const pwdCheck = checkSitePassword(request)
  if (!pwdCheck.ok) {
    sendJson(response, 403, { error: pwdCheck.error, message: pwdCheck.message })
    return
  }

  sendJson(response, 200, { ok: true })
}
