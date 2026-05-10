import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const PRACTITIONERS = require('../shared/practitioners.json')

// ═══════════════════════════════════════════════════════════════════════════════
// ENVIRONMENT
// ═══════════════════════════════════════════════════════════════════════════════

export const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com'
export const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL ?? 'deepseek-chat'
export const MAX_BODY_BYTES = 32_768
export const REQUEST_TIMEOUT_MS = 30_000

const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY ?? ''

// ═══════════════════════════════════════════════════════════════════════════════
// TURNSTILE VERIFICATION
// ═══════════════════════════════════════════════════════════════════════════════

export async function verifyTurnstile(token) {
  if (!TURNSTILE_SECRET_KEY) {
    // If no secret key is configured, skip verification (local dev)
    return { success: true }
  }
  if (!token || typeof token !== 'string') {
    return { success: false, error: 'missing_turnstile_token' }
  }
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        secret: TURNSTILE_SECRET_KEY,
        response: token,
      }),
    })
    const data = await response.json()
    if (!data.success) {
      return { success: false, error: data['error-codes']?.join(', ') || 'turnstile_failed' }
    }
    return { success: true }
  } catch (err) {
    return { success: false, error: 'turnstile_verify_error' }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECURITY HEADERS & CORS
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_ALLOWED_ORIGINS = new Set([
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
])

export function setSecurityHeaders(response) {
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('X-Frame-Options', 'DENY')
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.setHeader('Cache-Control', 'no-store')
}

export function handleCors(request, response, extraOrigins = []) {
  const origin = request.headers.origin
  const allowed = new Set([...DEFAULT_ALLOWED_ORIGINS, ...extraOrigins])
  if (origin && allowed.has(origin)) {
    response.setHeader('Access-Control-Allow-Origin', origin)
  }
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  response.setHeader('Access-Control-Allow-Headers', 'content-type')
  return request.method === 'OPTIONS'
}

export function sendJson(response, statusCode, payload) {
  setSecurityHeaders(response)
  response.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify(payload))
}

// ═══════════════════════════════════════════════════════════════════════════════
// SITE PASSWORD CHECK
// ═══════════════════════════════════════════════════════════════════════════════

export function checkSitePassword(request) {
  const sitePassword = process.env.CMATCH_SITE_PASSWORD || ''
  if (!sitePassword) {
    return { ok: true }
  }
  const provided = request.headers['x-site-password'] || ''
  if (provided === sitePassword) {
    return { ok: true }
  }
  return { ok: false, error: 'invalid_password', message: 'Invalid password.' }
}

// ═══════════════════════════════════════════════════════════════════════════════
// BODY PARSING
// ═══════════════════════════════════════════════════════════════════════════════

export function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = ''
    request.on('data', (chunk) => {
      body += chunk
      if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
        reject(new Error('request_body_too_large'))
        request.destroy()
      }
    })
    request.on('end', () => {
      if (!body.trim()) { resolve({}); return }
      try { resolve(JSON.parse(body)) } catch { reject(new Error('invalid_json')) }
    })
    request.on('error', reject)
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEMA METADATA
// ═══════════════════════════════════════════════════════════════════════════════

export const SCHEMA_META = {
  'complaint.domains': {
    type: 'string[]',
    enum: ['pain_musculoskeletal', 'pain_headache', 'neurological', 'digestive', 'respiratory_allergy', 'skin_dermatology', 'sleep_energy', 'mental_emotional', 'women_health', 'men_health', 'cardiovascular_circulation', 'urinary_kidney', 'ent', 'eye_vision', 'dental_oral', 'endocrine_metabolic', 'oncology_support', 'wellness_prevention', 'unknown'],
    description: 'Symptom-based domain(s) of the patient complaint.',
    examples: {
      'I twisted my ankle playing basketball': ['pain_musculoskeletal'],
      'I have lower back pain and poor sleep': ['pain_musculoskeletal', 'sleep_energy'],
    },
  },
  'complaint.bodyRegions': {
    type: 'string[]',
    enum: ['head_face', 'neck', 'shoulder', 'arm_elbow_hand', 'chest', 'upper_back', 'lower_back', 'abdomen', 'pelvis_hip', 'knee', 'ankle_foot', 'skin_general', 'whole_body', 'unknown'],
    description: 'Body part(s) affected by the complaint.',
  },
  'complaint.symptomQualities': {
    type: 'string[]',
    freeText: true,
    description: 'Specific symptoms or qualities described by the user.',
  },
  'complaint.duration': {
    type: 'string',
    enum: ['acute', 'subacute', 'chronic', 'recurrent', 'unknown'],
    description: 'How long the complaint has been present.',
  },
  'complaint.severity': {
    type: 'number',
    min: 1,
    max: 10,
    fallback: 'unknown',
    description: 'Pain or symptom severity on a scale of 1 to 10, where 1 is barely noticeable and 10 is the worst possible.',
  },
  'complaint.functionalImpact': {
    type: 'string[]',
    freeText: true,
    description: 'How the complaint affects daily activities.',
  },
  'safety.route': {
    type: 'string',
    enum: ['emergency_now', 'urgent_western_medical_review', 'human_review_before_matching', 'ok_to_match'],
    description: 'Safety assessment route.',
  },
  'safety.redFlags': {
    type: 'string[]',
    freeText: true,
    description: 'Identified safety concerns.',
  },
  'patientContext.ageBand': {
    type: 'string',
    enum: ['adult_18_64', 'older_adult_65_plus', 'teen_13_17', 'child_2_12', 'unknown'],
    nullable: true,
    fallback: 'unknown',
  },
  'patientContext.pregnancyStatus': {
    type: 'string',
    enum: ['not_applicable', 'pregnant', 'possibly_pregnant', 'postpartum', 'unknown'],
    nullable: true,
    fallback: 'unknown',
  },
  'preferences.districtsPreferred': {
    type: 'string[]',
    enum: ['central_and_western', 'wan_chai', 'eastern', 'southern', 'yau_tsim_mong', 'sham_shui_po', 'kowloon_city', 'wong_tai_sin', 'kwun_tong', 'kwai_tsing', 'tsuen_wan', 'tuen_mun', 'yuen_long', 'north', 'tai_po', 'sha_tin', 'sai_kung', 'islands', 'remote_or_no_preference'],
  },
  'preferences.languagesPreferred': {
    type: 'string[]',
    enum: ['cantonese', 'english', 'mandarin', 'no_preference'],
  },
  'preferences.treatmentPreferences': {
    type: 'string[]',
    enum: ['herbal_medicine', 'acupuncture', 'tuina', 'bonesetting', 'cupping', 'moxibustion', 'diet_lifestyle_guidance', 'integrative_referral'],
  },
  'preferences.treatmentAvoidances': {
    type: 'string[]',
    enum: ['herbal_medicine', 'acupuncture', 'tuina', 'bonesetting', 'cupping', 'moxibustion', 'diet_lifestyle_guidance', 'integrative_referral'],
  },
  'extractionMeta.missingImportantFields': {
    type: 'string[]',
    freeText: true,
  },
  'extractionMeta.needsHumanReview': {
    type: 'boolean',
  },
}

export const FIELD_PATHS = Object.keys(SCHEMA_META)
export const ENUM_VALUES = {}
for (const [path, meta] of Object.entries(SCHEMA_META)) {
  if (meta.enum) ENUM_VALUES[path] = new Set(meta.enum)
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEMA MANIPULATION
// ═══════════════════════════════════════════════════════════════════════════════

export function setPath(obj, path, value) {
  const parts = path.split('.')
  let current = obj
  for (let i = 0; i < parts.length - 1; i++) {
    if (!current[parts[i]]) current[parts[i]] = {}
    current = current[parts[i]]
  }
  current[parts[parts.length - 1]] = value
}

export function getPath(obj, path) {
  const parts = path.split('.')
  let current = obj
  for (const part of parts) {
    if (current == null) return undefined
    current = current[part]
  }
  return current
}

export function applyFieldUpdates(previousSchema, changedFields) {
  if (!previousSchema) return null
  if (!changedFields || typeof changedFields !== 'object') return previousSchema
  const merged = JSON.parse(JSON.stringify(previousSchema))
  for (const [path, value] of Object.entries(changedFields)) {
    setPath(merged, path, value)
  }
  return merged
}

// ═══════════════════════════════════════════════════════════════════════════════
// NORMALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

export function normalizeField(path, value) {
  const meta = SCHEMA_META[path]
  if (!meta) return value

  if (value == null && meta.nullable) {
    return meta.fallback ?? null
  }

  if (meta.type === 'string' && (value === '' || value == null)) {
    return meta.fallback ?? 'unknown'
  }

  if (meta.type === 'string' && meta.enum) {
    if (meta.enum.includes(value)) return value
    const lower = String(value).toLowerCase()
    const match = meta.enum.find(e => e.toLowerCase() === lower)
    if (match) return match
    return meta.fallback ?? 'unknown'
  }

  if (meta.type === 'string[]' && meta.enum && !meta.freeText) {
    if (!Array.isArray(value)) return []
    return value
      .map(v => {
        if (meta.enum.includes(v)) return v
        const lower = String(v).toLowerCase()
        const match = meta.enum.find(e => e.toLowerCase() === lower)
        return match
      })
      .filter(Boolean)
  }

  if (meta.type === 'string[]' && meta.freeText) {
    if (!Array.isArray(value)) return []
    return value.map(v => String(v)).filter(v => v.length > 0)
  }

  if (meta.type === 'boolean|null') {
    if (value === true || value === false) return value
    if (value === null) return null
    return meta.fallback ?? null
  }

  if (meta.type === 'number') {
    const num = Number(value)
    if (!Number.isNaN(num)) {
      const min = meta.min ?? -Infinity
      const max = meta.max ?? Infinity
      if (num >= min && num <= max) return num
    }
    return meta.fallback ?? 'unknown'
  }

  if (meta.type === 'boolean') {
    return Boolean(value)
  }

  return value
}

export function normalizeSchema(schema) {
  if (!schema) return null
  const normalized = JSON.parse(JSON.stringify(schema))
  if (!normalized.patientContext) normalized.patientContext = {}
  if (!normalized.complaint) normalized.complaint = {}
  if (!normalized.safety) normalized.safety = {}
  if (!normalized.preferences) normalized.preferences = {}
  if (!normalized.extractionMeta) normalized.extractionMeta = {}

  for (const path of FIELD_PATHS) {
    const currentValue = getPath(normalized, path)
    const normalizedValue = normalizeField(path, currentValue)
    setPath(normalized, path, normalizedValue)
  }

  normalized.schemaVersion = 'cmatch.intake.v1'
  if (!normalized.source) normalized.source = { rawText: '', language: 'unknown' }

  return normalized
}

export function normalizeChangedFields(changedFields) {
  if (!changedFields || typeof changedFields !== 'object') return {}
  const normalized = {}
  for (const [path, value] of Object.entries(changedFields)) {
    const meta = SCHEMA_META[path]
    if (!meta) continue
    const normalizedValue = normalizeField(path, value)
    normalized[path] = normalizedValue
  }
  return normalized
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROMPTS
// ═══════════════════════════════════════════════════════════════════════════════

function buildSchemaReference() {
  const lines = ['## Schema Reference\n']
  for (const [path, meta] of Object.entries(SCHEMA_META)) {
    lines.push(`### ${path}`)
    lines.push(`- Type: ${meta.type}`)
    if (meta.enum && !meta.freeText) {
      lines.push(`- Valid values: ${meta.enum.join(', ')}`)
    }
    lines.push(`- Description: ${meta.description}`)
    if (meta.examples) {
      lines.push('- Examples:')
      for (const [input, output] of Object.entries(meta.examples)) {
        lines.push(`  - "${input}" → ${JSON.stringify(output)}`)
      }
    }
    lines.push('')
  }
  return lines.join('\n')
}

const FIRST_TURN_RESPONSE_FORMAT = `Return ONLY valid JSON. No markdown, no code blocks.

Extract a complete schema from the user's initial message.

{
  "text": "Warm natural response...",
  "schema": {
    "schemaVersion": "cmatch.intake.v1",
    "source": { "rawText": "...", "language": "en | zh-HK | zh-CN | mixed | unknown" },
    "patientContext": { "ageBand": "...", "pregnancyStatus": "..." },
    "complaint": { "domains": ["..."], "bodyRegions": ["..."], "symptomQualities": ["..."], "duration": "...", "severity": 5, "functionalImpact": ["..."] },
    "safety": { "route": "...", "redFlags": ["..."] },
    "preferences": { "districtsPreferred": ["..."], "languagesPreferred": ["..."], "treatmentPreferences": ["..."], "treatmentAvoidances": ["..."] },
    "extractionMeta": { "missingImportantFields": ["..."], "needsHumanReview": false }
  },
  "status": "needs_clarification | ready_to_match | showing_matches",
  "matches": []
}`

const FOLLOW_UP_RESPONSE_FORMAT = `Return ONLY valid JSON. No markdown, no code blocks.

The user has sent a follow-up message. Your job is to identify what fields changed.

Use the conversation context and the Previous Schema State to determine which fields the user's latest message refers to.

CRITICAL rules:
- ONLY include fields that actually changed based on the LATEST message.
- If the user corrects a previous answer, include the new value in changedFields.
- If a field is already known and the user did NOT mention it again, do NOT include it.
- Use ONLY valid enum values from the Schema Reference above.

{
  "text": "Warm natural response acknowledging the change...",
  "changedFields": { "field.path": "new_value" },
  "status": "needs_clarification | ready_to_match | showing_matches",
  "matches": []
}`

const BASE_SYSTEM_PROMPT = `You are CMatch, an AI intake assistant for a Hong Kong Chinese Medicine practitioner finder.

Your job is to understand patient concerns and extract structured information. Match the user's language (English / 中文 / 廣東話).

## Safety Rules
- Do NOT diagnose. Do NOT provide treatment advice.
- If chest pain, stroke symptoms, severe bleeding, breathing difficulty, or pregnancy bleeding: flag as emergency.

## Response Tone
- Be factual and direct. No sympathy, no fluff.
- Start with a brief acknowledgment: "I understand you have..."
- Do NOT say things like "that can be quite uncomfortable", "I'm sorry to hear", "I'd like to understand", or "let me help you".
- Keep responses to 1–2 sentences maximum.

## Conversation Flow (Category by Category)
Extract everything you can from each user message. Then ask ONE clarifying question focused on the FIRST incomplete category below.

### Category 1 — Chief Complaint (highest priority)
Fields: complaint.domains, complaint.bodyRegions, complaint.symptomQualities, complaint.duration, complaint.severity, complaint.functionalImpact
- If any of these are "unknown" or empty, ask ONE question about the most important missing piece.

### Category 2 — Patient Profile
Fields: patientContext.ageBand, patientContext.pregnancyStatus
- Only ask after ALL complaint fields are populated (not "unknown").

### Category 3 — Preferences
Fields: preferences.districtsPreferred, preferences.languagesPreferred, preferences.treatmentPreferences, preferences.treatmentAvoidances
- Only ask after patient profile is populated.

### Category 4 — Universal / Refinement
- Once all categories have data, summarize briefly.
- Ask if anything needs correction.
- Offer to show practitioner matches when you have enough info.

## Status Rules
- "needs_clarification" — while asking questions in categories 1–3, or refining in category 4.
- "ready_to_match" — when summarizing and offering to show matches in category 4.
- "showing_matches" — ONLY when the user explicitly confirms they want to see practitioners.

${buildSchemaReference()}

## Domain-to-Specialty Matching Guide
When matching patients to practitioners, map symptom-based complaint domains to relevant practitioner specialties:
- pain_musculoskeletal → orthopedics_traumatology, tuina, acupuncture, internal_medicine, rehabilitation_medicine
- pain_headache → internal_medicine, acupuncture, tuina
- neurological → internal_medicine, acupuncture, rehabilitation_medicine
- digestive → internal_medicine, acupuncture, tuina
- respiratory_allergy → internal_medicine, otorhinolaryngology, acupuncture, pediatrics
- skin_dermatology → dermatology, internal_medicine, acupuncture
- sleep_energy → internal_medicine, acupuncture, tuina, preventive_healthcare
- mental_emotional → internal_medicine, acupuncture, preventive_healthcare
- women_health → obstetrics_gynecology, internal_medicine, acupuncture
- men_health → internal_medicine, acupuncture, surgery
- cardiovascular_circulation → internal_medicine, acupuncture, geriatrics
- urinary_kidney → internal_medicine, acupuncture, surgery
- ent → otorhinolaryngology, internal_medicine, acupuncture
- eye_vision → ophthalmology, internal_medicine, acupuncture
- dental_oral → stomatology, internal_medicine
- endocrine_metabolic → internal_medicine, acupuncture, preventive_healthcare
- oncology_support → oncology, internal_medicine, acupuncture, preventive_healthcare
- wellness_prevention → preventive_healthcare, internal_medicine, acupuncture, tuina
- unknown → internal_medicine (general fallback)

## Practitioner Database
${JSON.stringify(PRACTITIONERS, null, 2)}`

export function buildFirstTurnPrompt() {
  return `## First Turn Instructions
Extract a complete schema from the user's initial message above.

Then determine which category (1–4) the conversation is in based on what was extracted, and ask ONE focused question from that category.

In extractionMeta.missingImportantFields, list the specific schema field paths that are still "unknown" or empty.

Use ONLY valid enum values from the Schema Reference. Do NOT invent new values.

${FIRST_TURN_RESPONSE_FORMAT}`
}

export function buildFollowUpPrompt(previousSchema) {
  const missingComplaint = [
    'complaint.domains',
    'complaint.bodyRegions',
    'complaint.symptomQualities',
    'complaint.duration',
    'complaint.severity',
    'complaint.functionalImpact',
  ].filter(p => {
    const v = getPath(previousSchema, p)
    return v === 'unknown' || v == null || (Array.isArray(v) && v.length === 0)
  })

  const missingProfile = [
    'patientContext.ageBand',
    'patientContext.pregnancyStatus',
  ].filter(p => {
    const v = getPath(previousSchema, p)
    return v === 'unknown' || v == null
  })

  const missingPreferences = [
    'preferences.districtsPreferred',
    'preferences.languagesPreferred',
    'preferences.treatmentPreferences',
    'preferences.treatmentAvoidances',
  ].filter(p => {
    const v = getPath(previousSchema, p)
    return v == null || (Array.isArray(v) && v.length === 0)
  })

  let currentCategory = 4
  if (missingComplaint.length > 0) currentCategory = 1
  else if (missingProfile.length > 0) currentCategory = 2
  else if (missingPreferences.length > 0) currentCategory = 3

  return `## Previous Schema State
${JSON.stringify(previousSchema, null, 2)}

## Current Category
The conversation is currently in Category ${currentCategory}.
${currentCategory === 1 ? 'Missing complaint fields: ' + missingComplaint.join(', ') : ''}
${currentCategory === 2 ? 'Missing profile fields: ' + missingProfile.join(', ') : ''}
${currentCategory === 3 ? 'Missing preference fields: ' + missingPreferences.join(', ') : ''}
${currentCategory === 4 ? 'All categories populated. You are in universal/refinement mode.' : ''}

## Follow-Up Instructions
The user's LATEST message above is the ground truth.

1. Identify ALL fields that changed based on the LATEST message.
2. If the user answered a question and the current category is now complete, move to the NEXT category and ask ONE question about it.
3. If all categories are complete (Category 4), enter universal mode:
   - Summarize what you understood in one sentence.
   - Ask if anything needs correction.
   - Offer to show practitioner matches when you have enough info.

CRITICAL: Only include fields in changedFields that actually changed. Do NOT include fields that stayed the same.

${FOLLOW_UP_RESPONSE_FORMAT}`
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEEPSEEK API CALL
// ═══════════════════════════════════════════════════════════════════════════════

export function safeDeepSeekFailureMessage(status, providerCode, providerMessage) {
  if (providerMessage && providerMessage.length > 0 && providerMessage.length < 200) {
    return `DeepSeek: ${providerMessage}`
  }
  switch (status) {
    case 401:
      return 'DeepSeek authentication failed (401). Your API key is invalid or expired.'
    case 402:
      return 'DeepSeek account has no balance (402). Add credits at https://platform.deepseek.com, then retry.'
    case 403:
      return 'DeepSeek access denied (403). Your API key does not have permission for this model or endpoint.'
    case 429:
      return 'DeepSeek rate limit hit (429). Too many requests — wait a moment and retry.'
    case 500: case 502: case 503: case 504:
      return `DeepSeek server error (${status}). Their API is temporarily unavailable — retry in a moment.`
    default:
      return `DeepSeek request failed (${status}). Check the local API server logs and retry.`
  }
}

export async function conversationWithDeepSeek(payload) {
  const apiKey = process.env.DEEPSEEK_API_KEY

  if (!apiKey) {
    return {
      ok: false,
      statusCode: 503,
      payload: {
        error: 'missing_deepseek_api_key',
        message: 'DEEPSEEK_API_KEY is not set.',
        model: DEEPSEEK_MODEL,
      },
    }
  }

  const messages = Array.isArray(payload.messages) ? payload.messages : []
  if (messages.length === 0) {
    return {
      ok: false,
      statusCode: 400,
      payload: { error: 'invalid_messages', message: 'At least one message is required.' },
    }
  }

  const isFirstTurn = !payload.currentSchema
  const previousSchema = payload.currentSchema ?? null

  const deepseekMessages = []
  deepseekMessages.push({ role: 'system', content: BASE_SYSTEM_PROMPT })
  for (const m of messages) {
    deepseekMessages.push({ role: m.role, content: m.content })
  }

  if (isFirstTurn) {
    deepseekMessages.push({ role: 'system', content: buildFirstTurnPrompt() })
  } else {
    deepseekMessages.push({ role: 'system', content: buildFollowUpPrompt(previousSchema) })
  }

  try {
    const requestBody = {
      model: DEEPSEEK_MODEL,
      messages: deepseekMessages,
      stream: false,
      temperature: 0.2,
      response_format: { type: 'json_object' },
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    const deepseekResponse = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    })
    clearTimeout(timeout)

    const data = await deepseekResponse.json()

    if (!deepseekResponse.ok) {
      const providerCode = typeof data?.error?.code === 'string' ? data.error.code : undefined
      const providerMessage = typeof data?.error?.message === 'string' ? data.error.message : undefined
      return {
        ok: false,
        statusCode: deepseekResponse.status,
        payload: {
          error: 'deepseek_request_failed',
          message: safeDeepSeekFailureMessage(deepseekResponse.status, providerCode, providerMessage),
          providerCode: providerCode ?? undefined,
          providerMessage: providerMessage ?? undefined,
          model: DEEPSEEK_MODEL,
        },
      }
    }

    const rawContent = data?.choices?.[0]?.message?.content ?? '{}'
    let parsed
    try {
      parsed = JSON.parse(rawContent)
    } catch {
      parsed = { text: rawContent, changedFields: {}, schema: previousSchema, status: 'needs_clarification', matches: [] }
    }

    let canonicalSchema
    if (isFirstTurn) {
      canonicalSchema = normalizeSchema(parsed.schema)
    } else {
      const normalizedChanges = normalizeChangedFields(parsed.changedFields)
      canonicalSchema = applyFieldUpdates(previousSchema, normalizedChanges)
      if (!canonicalSchema && parsed.schema) {
        canonicalSchema = normalizeSchema(parsed.schema)
      }
    }

    return {
      ok: true,
      statusCode: 200,
      payload: {
        model: DEEPSEEK_MODEL,
        text: parsed.text ?? 'I understood your concern.',
        schema: canonicalSchema,
        status: parsed.status ?? 'needs_clarification',
        matches: parsed.matches ?? [],
      },
    }
  } catch (error) {
    if (error?.name === 'AbortError') {
      return {
        ok: false,
        statusCode: 504,
        payload: {
          error: 'deepseek_timeout',
          message: 'The AI service took too long to respond. Please try again.',
          model: DEEPSEEK_MODEL,
        },
      }
    }
    return {
      ok: false,
      statusCode: 500,
      payload: {
        error: 'deepseek_conversation_error',
        message: 'The AI conversation service is temporarily unavailable. Please try again.',
        model: DEEPSEEK_MODEL,
      },
    }
  }
}
