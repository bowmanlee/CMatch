import {
  setSecurityHeaders,
  handleCors,
  sendJson,
} from '../server/core.mjs'
import { getSubmissionsSafe } from '../server/practitioner-storage.mjs'

// ═══════════════════════════════════════════════════════════════════════════════
// VERCEL SERVERLESS HANDLER — admin view of practitioner submissions
// ═══════════════════════════════════════════════════════════════════════════════

const EXTRA_ORIGINS = process.env.ALLOWED_ORIGIN
  ? [process.env.ALLOWED_ORIGIN]
  : []

function checkAdminPassword(request) {
  const adminPassword = process.env.CMATCH_ADMIN_PASSWORD || ''
  if (!adminPassword) {
    // If no admin password is set, fall back to site password for safety
    const sitePassword = process.env.CMATCH_SITE_PASSWORD || ''
    if (!sitePassword) return { ok: true }
    const provided = request.headers['x-admin-password'] || request.headers['x-site-password'] || ''
    if (provided === sitePassword) return { ok: true }
    return { ok: false, error: 'unauthorized', message: 'Invalid admin password.' }
  }
  const provided = request.headers['x-admin-password'] || ''
  if (provided === adminPassword) return { ok: true }
  return { ok: false, error: 'unauthorized', message: 'Invalid admin password.' }
}

export default async function handler(request, response) {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`)

  setSecurityHeaders(response)
  if (handleCors(request, response, EXTRA_ORIGINS)) {
    response.writeHead(204)
    response.end()
    return
  }

  if (request.method !== 'GET' || url.pathname !== '/api/admin/practitioner-submissions') {
    sendJson(response, 404, { error: 'not_found', message: 'Unknown route.' })
    return
  }

  const pwdCheck = checkAdminPassword(request)
  if (!pwdCheck.ok) {
    sendJson(response, 401, { error: pwdCheck.error, message: pwdCheck.message })
    return
  }

  try {
    const submissions = getSubmissionsSafe()
    sendJson(response, 200, { submissions })
  } catch (error) {
    sendJson(response, 500, {
      error: 'server_error',
      message: error instanceof Error ? error.message : 'Failed to load submissions.',
    })
  }
}
