import { createRequire } from 'module'
import {
  DEEPSEEK_BASE_URL,
  DEEPSEEK_MODEL,
  REQUEST_TIMEOUT_MS,
  SCHEMA_META,
  FIELD_PATHS,
  setPath,
  getPath,
  normalizeSchema,
  normalizeField,
  buildFirstTurnPrompt,
} from './core.mjs'

const require = createRequire(import.meta.url)
const PRACTITIONERS = require('../shared/practitioners.json')

// ═══════════════════════════════════════════════════════════════════════════════
// PRACTITIONER MATCHING (ported from client-side App.tsx)
// ═══════════════════════════════════════════════════════════════════════════════

const DOMAIN_TO_SPECIALTIES = {
  pain_musculoskeletal: ['orthopedics_traumatology', 'tuina', 'acupuncture', 'internal_medicine', 'rehabilitation_medicine'],
  pain_headache: ['internal_medicine', 'acupuncture', 'tuina'],
  neurological: ['internal_medicine', 'acupuncture', 'rehabilitation_medicine'],
  digestive: ['internal_medicine', 'acupuncture', 'tuina'],
  respiratory_allergy: ['internal_medicine', 'otorhinolaryngology', 'acupuncture', 'pediatrics'],
  skin_dermatology: ['dermatology', 'internal_medicine', 'acupuncture'],
  sleep_energy: ['internal_medicine', 'acupuncture', 'tuina', 'preventive_healthcare'],
  mental_emotional: ['internal_medicine', 'acupuncture', 'preventive_healthcare'],
  women_health: ['obstetrics_gynecology', 'internal_medicine', 'acupuncture'],
  men_health: ['internal_medicine', 'acupuncture', 'surgery'],
  cardiovascular_circulation: ['internal_medicine', 'acupuncture', 'geriatrics'],
  urinary_kidney: ['internal_medicine', 'acupuncture', 'surgery'],
  ent: ['otorhinolaryngology', 'internal_medicine', 'acupuncture'],
  eye_vision: ['ophthalmology', 'internal_medicine', 'acupuncture'],
  dental_oral: ['stomatology', 'internal_medicine'],
  endocrine_metabolic: ['internal_medicine', 'acupuncture', 'preventive_healthcare'],
  oncology_support: ['oncology', 'internal_medicine', 'acupuncture', 'preventive_healthcare'],
  wellness_prevention: ['preventive_healthcare', 'internal_medicine', 'acupuncture', 'tuina'],
  unknown: ['internal_medicine'],
}

function scorePractitioners(intake, practitionersList) {
  const relevantSpecialties = new Set()
  for (const domain of (intake.complaint?.domains || [])) {
    if (domain === 'unknown') continue
    const specs = DOMAIN_TO_SPECIALTIES[domain] || []
    for (const s of specs) relevantSpecialties.add(s)
  }

  return practitionersList
    .map((p) => {
      let score = 0
      const reasons = []
      const cautions = []

      const specialtyOverlap = p.specialties.filter((s) => relevantSpecialties.has(s))
      if (specialtyOverlap.length > 0) {
        score += 30 + Math.min(20, specialtyOverlap.length * 10)
        reasons.push(`Specialises in ${specialtyOverlap.join(', ')}`)
      }

      const districtOverlap = p.districts.filter(
        (d) =>
          (intake.preferences?.districtsPreferred || []).includes(d) ||
          (intake.preferences?.districtsPreferred || []).includes('remote_or_no_preference'),
      )
      if (districtOverlap.length > 0 || (intake.preferences?.districtsPreferred || []).length === 0) {
        score += 20
        if (districtOverlap.length > 0) {
          reasons.push(`Available in ${districtOverlap.join(', ')}`)
        }
      }

      const langOverlap = p.languages.filter(
        (l) =>
          (intake.preferences?.languagesPreferred || []).includes(l) ||
          (intake.preferences?.languagesPreferred || []).includes('no_preference'),
      )
      if (langOverlap.length > 0 || (intake.preferences?.languagesPreferred || []).length === 0) {
        score += 15
        if (langOverlap.length > 0) {
          reasons.push(`Speaks ${langOverlap.join(', ')}`)
        }
      }

      const modalityOverlap = p.modalities.filter((m) => (intake.preferences?.treatmentPreferences || []).includes(m))
      if (modalityOverlap.length > 0) {
        score += 10
        reasons.push(`Offers ${modalityOverlap.join(', ')}`)
      }

      if (
        !p.accepts.ageBands.includes(intake.patientContext?.ageBand) &&
        intake.patientContext?.ageBand !== 'unknown'
      ) {
        score = -1000
        cautions.push(`Does not accept ${intake.patientContext?.ageBand} patients`)
      }

      if (
        (intake.patientContext?.pregnancyStatus === 'pregnant' ||
          intake.patientContext?.pregnancyStatus === 'postpartum') &&
        !p.accepts.pregnancyRelated
      ) {
        score = -1000
        cautions.push('Does not accept pregnancy-related cases')
      }

      const normalizedScore = Math.max(0, Math.min(1, score / 100))

      let band
      if (normalizedScore >= 0.75) band = 'Strong match'
      else if (normalizedScore >= 0.5) band = 'Good match'
      else band = 'Possible match'

      return {
        practitionerId: p.id,
        score: normalizedScore,
        band,
        reasons,
        cautions,
      }
    })
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score)
}

// ═══════════════════════════════════════════════════════════════════════════════
// AGENT STATE
// ═══════════════════════════════════════════════════════════════════════════════

export function createInitialAgentState() {
  return {
    schemaVersion: 'cmatch.agent.v1',
    phase: 'intaking',
    intake: {
      schemaVersion: 'cmatch.intake.v1',
      source: { rawText: '', language: 'unknown' },
      patientContext: { ageBand: 'unknown', pregnancyStatus: 'unknown' },
      complaint: {
        domains: [],
        bodyRegions: [],
        symptomQualities: [],
        duration: 'unknown',
        severity: 'unknown',
        functionalImpact: [],
      },
      safety: { route: 'ok_to_match', redFlags: [] },
      preferences: {
        districtsPreferred: [],
        languagesPreferred: [],
        treatmentPreferences: [],
        treatmentAvoidances: [],
      },
      extractionMeta: { missingImportantFields: [], needsHumanReview: false },
    },
    memory: {
      questionsAsked: [],
      extractionAttempts: {},
      userExplicitSkips: [],
    },
    plan: {
      objective: 'Extract initial complaint and preferences from the user message.',
      lastAction: 'init',
    },
    tools: {},
    turnCount: 0,
    maxTurns: 6,
  }
}

function cloneState(state) {
  return JSON.parse(JSON.stringify(state))
}

function setField(state, path, value) {
  setPath(state.intake, path, value)
}

function getField(state, path) {
  return getPath(state.intake, path)
}

function incrementExtractionAttempt(state, path) {
  state.memory.extractionAttempts[path] = (state.memory.extractionAttempts[path] || 0) + 1
}

function getExtractionAttempts(state, path) {
  return state.memory.extractionAttempts[path] || 0
}

function recordQuestion(state, field, text) {
  state.memory.questionsAsked.push({ field, text, turnIndex: state.turnCount })
}

function wasFieldAskedRecently(state, field, window = 2) {
  const recent = state.memory.questionsAsked.filter(
    (q) => q.field === field && state.turnCount - q.turnIndex <= window
  )
  return recent.length > 0
}

function getRecentlyAskedFields(state, window = 2) {
  return state.memory.questionsAsked
    .filter((q) => state.turnCount - q.turnIndex <= window)
    .map((q) => q.field)
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOOLS
// ═══════════════════════════════════════════════════════════════════════════════

function runSafetyTool(intake, latestMessage) {
  const redFlags = []
  let route = 'ok_to_match'

  const msg = (latestMessage || '').toLowerCase()
  const raw = JSON.stringify(intake).toLowerCase()
  const combined = msg + ' ' + raw

  const emergencyPatterns = [
    'chest pain', 'heart attack', 'can\'t breathe', 'difficulty breathing', 'severe bleeding',
    'unconscious', 'stroke', 'paralyzed', 'suicide', 'kill myself',
    'pregnancy bleeding', 'miscarriage', 'severe abdominal pain',
  ]

  const urgentPatterns = [
    'fever', 'high fever', 'infection', 'antibiotics', 'surgery',
    'broken bone', 'fracture', 'head injury', 'concussion',
  ]

  for (const p of emergencyPatterns) {
    if (combined.includes(p)) {
      redFlags.push(p)
      route = 'emergency_now'
    }
  }

  if (route === 'ok_to_match') {
    for (const p of urgentPatterns) {
      if (combined.includes(p)) {
        redFlags.push(p)
        route = 'urgent_western_medical_review'
      }
    }
  }

  if (route === 'ok_to_match' && typeof intake.complaint?.severity === 'number' && intake.complaint.severity >= 8) {
    route = 'human_review_before_matching'
    redFlags.push(`severe pain reported (${intake.complaint.severity}/10)`)
  }

  return { route, redFlags, requiresEscalation: route !== 'ok_to_match' }
}

function runMatchPreviewTool(intake) {
  const matches = scorePractitioners(intake, PRACTITIONERS)
  const topScore = matches[0]?.score ?? 0

  const gaps = []
  if (matches.length === 0) {
    gaps.push('no matching practitioners found')
  } else if (topScore < 0.5) {
    gaps.push('match quality is low')
  }

  const preferredDistricts = intake.preferences?.districtsPreferred || []
  const preferredLangs = intake.preferences?.languagesPreferred || []

  if (preferredDistricts.length > 0 && preferredDistricts[0] !== 'remote_or_no_preference') {
    const hasDistrictMatch = matches.some((m) => {
      const p = PRACTITIONERS.find((pr) => pr.id === m.practitionerId)
      return p && p.districts.some((d) => preferredDistricts.includes(d))
    })
    if (!hasDistrictMatch) gaps.push('no practitioners in preferred district')
  }

  if (preferredLangs.length > 0 && !preferredLangs.includes('no_preference')) {
    const hasLangMatch = matches.some((m) => {
      const p = PRACTITIONERS.find((pr) => pr.id === m.practitionerId)
      return p && p.languages.some((l) => preferredLangs.includes(l))
    })
    if (!hasLangMatch) gaps.push('no practitioners speak preferred language')
  }

  return { matches: matches.slice(0, 10), topScore, gaps }
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

const BASE_AGENT_PROMPT = `You are CMatch, an agentic intake assistant for Chinese Medicine practitioner matching in Hong Kong.

## Goal
Gather enough information to safely and accurately match the patient with a practitioner. You do NOT need to fill every field. You need enough to:
1. Assess safety (no emergency red flags)
2. Find practitioners who match their complaint, location, language, and treatment preferences

## Response Tone
- Be factual and direct. No sympathy, no fluff.
- Start with a brief acknowledgment: "I understand you have..."
- Keep responses to 1–2 sentences maximum.
- Match the user's language (English / 中文 / 廣東話).

## Safety Rules
- Do NOT diagnose. Do NOT provide treatment advice.
- If chest pain, stroke symptoms, severe bleeding, breathing difficulty, or pregnancy bleeding: flag as emergency.

${buildSchemaReference()}

## Domain-to-Specialty Matching Guide
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
- unknown → internal_medicine (general fallback)`

function buildActionPrompt(state, messages) {
  const recentlyAsked = getRecentlyAskedFields(state, 2)

  return `${BASE_AGENT_PROMPT}

## Current Agent State
${JSON.stringify(state, null, 2)}

## Recently Asked Fields (DO NOT ask these again)
${recentlyAsked.length > 0 ? recentlyAsked.join(', ') : 'None'}

## Conversation History
${messages.map((m) => `${m.role === 'assistant' ? 'AI' : 'User'}: ${m.content}`).join('\n')}

## Instructions
1. Review the LATEST user message and the current state.
2. Extract everything you can. Use ONLY valid enum values.
3. For each field you extract, provide a confidence score (0.0–1.0).
4. Decide the single most valuable next action.

## Action Space
Return a JSON object with these keys:
- "thought": your step-by-step reasoning (1–3 sentences)
- "action": one of the following:
  - { "type": "update", "changes": { "field.path": value }, "confidence": { "field.path": 0.0–1.0 } }
    Extract fields from the latest message. Only include fields that changed.
  - { "type": "ask", "field": "field.path", "text": "question text", "reason": "why this matters" }
    Ask the user ONE clarifying question. Pick the most match-critical missing field.
    functionalImpact is OPTIONAL — do not let it block progress.
  - { "type": "tool_call", "tool": "preview_matches", "params": {} }
    Query the practitioner database to see if current info is enough.
    Call this when you have complaint + district + language, OR when unsure if you have enough.
  - { "type": "skip", "field": "field.path", "reason": "why skipping" }
    Mark a field as skipped after 2 failed extraction attempts or if user is unclear.
  - { "type": "finish", "summary": "brief summary", "showMatches": true }
    End intake and show matches. Use when you have enough info OR after max turns.
- "responseText": the warm, direct natural-language response to show the user.
  If action is "tool_call", say something like "Let me see which practitioners match your needs."
  If action is "finish", say something like "Here are your matches."
  If action is "ask", include the question naturally.

## Critical Rules
1. NEVER ask the same field twice within 2 turns.
2. If a field has been attempted 2+ times and remains empty, SKIP it.
3. functionalImpact is OPTIONAL. Do not ask about it more than once.
4. If the user says "just show me" / "anyone is fine" / "hurry", call preview_matches or finish.
5. If you have complaint.domain + bodyRegion + severity + district + language, you have ENOUGH.
6. After ${state.maxTurns} turns, you MUST finish or ask explicit permission to proceed.
7. Always assess safety mentally. If red flags, finish immediately with route=emergency_now.

Return ONLY valid JSON. No markdown, no code blocks.`
}

function buildResponseRefinementPrompt(state, action, toolResults) {
  return `${BASE_AGENT_PROMPT}

## Current State
${JSON.stringify(state, null, 2)}

## Action Taken
${JSON.stringify(action, null, 2)}

## Tool Results
${JSON.stringify(toolResults, null, 2)}

## Instructions
Generate a brief, warm, direct 1–2 sentence response to the user.
- Acknowledge what they said.
- If matches are ready and strong, say you're showing them.
- If there are gaps (e.g., no practitioners in their district), mention it and ask one follow-up.
- Match the user's language.

Return ONLY a JSON object: { "responseText": "..." }`
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEEPSEEK CALLS
// ═══════════════════════════════════════════════════════════════════════════════

async function callDeepSeek(messages, temperature = 0.2) {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    throw new Error('missing_deepseek_api_key')
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages,
        stream: false,
        temperature,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    })
    clearTimeout(timeout)

    const data = await response.json()

    if (!response.ok) {
      const providerMessage = typeof data?.error?.message === 'string' ? data.error.message : ''
      throw new Error(`deepseek_${response.status}: ${providerMessage}`)
    }

    const rawContent = data?.choices?.[0]?.message?.content ?? '{}'
    return JSON.parse(rawContent)
  } catch (error) {
    clearTimeout(timeout)
    if (error?.name === 'AbortError') {
      throw new Error('deepseek_timeout')
    }
    throw error
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACTION PARSER & VALIDATOR
// ═══════════════════════════════════════════════════════════════════════════════

function normalizeAction(raw) {
  if (!raw || typeof raw !== 'object') return null

  const thought = typeof raw.thought === 'string' ? raw.thought : ''
  const responseText = typeof raw.responseText === 'string' ? raw.responseText : ''
  const action = raw.action || raw

  const type = action.type
  if (!type) return null

  switch (type) {
    case 'update': {
      const changes = action.changes && typeof action.changes === 'object' ? action.changes : {}
      const confidence = action.confidence && typeof action.confidence === 'object' ? action.confidence : {}
      return { type: 'update', thought, changes, confidence, responseText }
    }
    case 'ask': {
      const field = typeof action.field === 'string' ? action.field : ''
      const text = typeof action.text === 'string' ? action.text : ''
      const reason = typeof action.reason === 'string' ? action.reason : ''
      return { type: 'ask', thought, field, text, reason, responseText }
    }
    case 'tool_call': {
      const tool = typeof action.tool === 'string' ? action.tool : ''
      const params = action.params && typeof action.params === 'object' ? action.params : {}
      return { type: 'tool_call', thought, tool, params, responseText }
    }
    case 'skip': {
      const field = typeof action.field === 'string' ? action.field : ''
      const reason = typeof action.reason === 'string' ? action.reason : ''
      return { type: 'skip', thought, field, reason, responseText }
    }
    case 'finish': {
      const summary = typeof action.summary === 'string' ? action.summary : ''
      const showMatches = action.showMatches === true
      return { type: 'finish', thought, summary, showMatches, responseText }
    }
    default:
      return null
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// INVARIANT ENFORCEMENT
// ═══════════════════════════════════════════════════════════════════════════════

function enforceInvariants(state, action) {
  const violations = []
  let result = action

  // Invariant 1: No duplicate questions within 2 turns
  if (action.type === 'ask') {
    if (wasFieldAskedRecently(state, action.field, 2)) {
      violations.push(`field ${action.field} was asked recently`)
      result = {
        type: 'skip',
        field: action.field,
        reason: 'Already asked recently. Moving on.',
        responseText: 'Understood. Let me proceed with what we have.',
        thought: 'Field was recently asked. Skipping per invariant.',
      }
    }
  }

  // Invariant 2: Skip after 2 failed extraction attempts
  if (result.type === 'ask') {
    const attempts = getExtractionAttempts(state, result.field)
    if (attempts >= 2) {
      violations.push(`field ${result.field} has ${attempts} failed attempts`)
      result = {
        type: 'skip',
        field: result.field,
        reason: `Attempted ${attempts} times without success.`,
        responseText: 'Understood. Let me work with what we have.',
        thought: 'Field has too many failed attempts. Skipping per invariant.',
      }
    }
  }

  // Invariant 3: Turn budget
  if (state.turnCount >= state.maxTurns && result.type === 'ask') {
    violations.push('max turns reached')
    result = {
      type: 'finish',
      summary: 'Proceeding with available information.',
      showMatches: true,
      responseText: 'I have enough to suggest some practitioners. Here are your matches:',
      thought: 'Max turns reached. Finishing per invariant.',
    }
  }

  // Invariant 4: functionalImpact is never blocking
  if (result.type === 'ask' && result.field === 'complaint.functionalImpact') {
    const attempts = getExtractionAttempts(state, result.field)
    if (attempts >= 1) {
      violations.push('functionalImpact is optional and was already attempted')
      result = {
        type: 'skip',
        field: 'complaint.functionalImpact',
        reason: 'Optional field, already attempted.',
        responseText: 'Understood. Let me check matching practitioners for you.',
        thought: 'functionalImpact is optional and was attempted. Skipping per invariant.',
      }
    }
  }

  return { action: result, violations }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACTION EXECUTOR
// ═══════════════════════════════════════════════════════════════════════════════

function executeAction(state, action) {
  const toolResults = {}

  switch (action.type) {
    case 'update': {
      for (const [path, value] of Object.entries(action.changes || {})) {
        const meta = SCHEMA_META[path]
        if (!meta) continue
        const normalized = normalizeField(path, value)
        setField(state, path, normalized)
        incrementExtractionAttempt(state, path)
      }
      state.plan.lastAction = 'update'
      break
    }

    case 'ask': {
      recordQuestion(state, action.field, action.text)
      state.turnCount += 1
      state.plan.lastAction = 'ask'
      break
    }

    case 'tool_call': {
      if (action.tool === 'preview_matches') {
        toolResults.preview_matches = runMatchPreviewTool(state.intake)
        state.tools.matchPreview = toolResults.preview_matches
      }
      state.plan.lastAction = `tool_call:${action.tool}`
      break
    }

    case 'skip': {
      state.memory.userExplicitSkips.push(action.field)
      incrementExtractionAttempt(state, action.field)
      state.plan.lastAction = 'skip'
      break
    }

    case 'finish': {
      state.phase = 'done'
      state.plan.lastAction = 'finish'
      break
    }
  }

  return toolResults
}

// ═══════════════════════════════════════════════════════════════════════════════
// FIRST-TURN EXTRACTION (reliable schema population)
// ═══════════════════════════════════════════════════════════════════════════════

async function runFirstTurnExtraction(messages) {
  const deepseekMessages = [
    { role: 'system', content: BASE_AGENT_PROMPT },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
    { role: 'system', content: buildFirstTurnPrompt() },
  ]
  const parsed = await callDeepSeek(deepseekMessages, 0.2)
  const schema = normalizeSchema(parsed.schema)
  return { schema, text: parsed.text ?? 'I understood your concern.', _raw: parsed }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FOLLOW-UP EXTRACTION (reliable delta extraction)
// ═══════════════════════════════════════════════════════════════════════════════

async function runFollowUpExtraction(messages, state) {
  const extractionMessages = [
    { role: 'system', content: BASE_AGENT_PROMPT },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
    {
      role: 'system',
      content: `## Previous Schema State\n${JSON.stringify(state.intake, null, 2)}\n\n## Follow-Up Instructions\nThe user sent a follow-up message. Identify ONLY the fields that changed based on the LATEST message.\nUse ONLY valid enum values. Do NOT include fields that stayed the same.\n\nReturn ONLY valid JSON:\n{\n  "changedFields": { "field.path": "new_value" },\n  "confidence": { "field.path": 0.0 }\n}`,
    },
  ]
  const parsed = await callDeepSeek(extractionMessages, 0.2)
  const changes = parsed.changedFields && typeof parsed.changedFields === 'object' ? parsed.changedFields : {}
  const confidence = parsed.confidence && typeof parsed.confidence === 'object' ? parsed.confidence : {}

  for (const [path, value] of Object.entries(changes)) {
    const meta = SCHEMA_META[path]
    if (!meta) continue
    const normalized = normalizeField(path, value)
    setPath(state.intake, path, normalized)
    incrementExtractionAttempt(state, path)
  }

  return { changes, confidence }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN AGENT CONVERSATION
// ═══════════════════════════════════════════════════════════════════════════════

export async function agentConversation(payload) {
  const messages = Array.isArray(payload.messages) ? payload.messages : []
  if (messages.length === 0) {
    return {
      ok: false,
      statusCode: 400,
      payload: { error: 'invalid_messages', message: 'At least one message is required.' },
    }
  }

  let state = payload.agentState ? cloneState(payload.agentState) : createInitialAgentState()
  const latestUserMessage = messages.filter((m) => m.role === 'user').pop()?.content || ''

  // Detect first turn: no prior agentState with extracted data
  const isFirstTurn =
    state.turnCount === 0 &&
    (state.intake.complaint?.domains || []).length === 0 &&
    (state.intake.complaint?.bodyRegions || []).length === 0 &&
    (typeof state.intake.complaint?.severity !== 'number' || state.intake.complaint?.severity === 'unknown')

  try {
    // ── FIRST TURN: reliable extraction + agent decision ──
    if (isFirstTurn) {
      const extraction = await runFirstTurnExtraction(messages)
      state.intake = extraction.schema
      state.turnCount = 1

      // Safety
      const safetyResult = runSafetyTool(extraction.schema, latestUserMessage)
      state.tools.safety = safetyResult
      state.intake.safety.route = safetyResult.route
      state.intake.safety.redFlags = safetyResult.redFlags

      if (safetyResult.requiresEscalation) {
        state.phase = 'escalated'
        const emergencyText =
          safetyResult.route === 'emergency_now'
            ? 'This sounds like it may need immediate medical attention. Please seek emergency care or call 999.'
            : 'Based on what you described, I recommend seeing a Western medicine doctor first before exploring Chinese Medicine.'
        return {
          ok: true,
          statusCode: 200,
          payload: { model: DEEPSEEK_MODEL, text: emergencyText, agentState: state, status: 'escalated', matches: [] },
        }
      }

      // Agent decides next action based on extracted schema
      const actionMessages = [
        { role: 'system', content: buildActionPrompt(state, messages) },
      ]
      const rawAction = await callDeepSeek(actionMessages, 0.2)
      let action = normalizeAction(rawAction)

      if (!action) {
        action = {
          type: 'finish',
          summary: 'Proceeding with available information.',
          showMatches: true,
          responseText: text,
          thought: 'Action parsing failed. Defaulting to finish.',
        }
      }

      // Enforce invariants
      const invariantResult = enforceInvariants(state, action)
      action = invariantResult.action

      // Execute action
      const toolResults = executeAction(state, action)

      // Refine response if tool called
      let responseText = action.responseText || text
      if (action.type === 'tool_call' && toolResults.preview_matches) {
        const refineMessages = [
          { role: 'system', content: buildResponseRefinementPrompt(state, action, toolResults) },
        ]
        try {
          const refined = await callDeepSeek(refineMessages, 0.3)
          if (refined && typeof refined.responseText === 'string') {
            responseText = refined.responseText
          }
        } catch {
          // keep original
        }
      }

      // Compute matches
      let matches = []
      let status = 'needs_clarification'
      if (state.phase === 'done' || action.type === 'finish') {
        matches = scorePractitioners(state.intake, PRACTITIONERS)
        status = 'showing_matches'
        state.phase = 'done'
      } else if (action.type === 'tool_call' && toolResults.preview_matches) {
        matches = toolResults.preview_matches.matches
        status = 'showing_matches'
      }

      return {
        ok: true,
        statusCode: 200,
        payload: { model: DEEPSEEK_MODEL, text: responseText, agentState: state, status, matches },
      }
    }

    // ── FOLLOW-UP TURNS: agent loop ──

    // Step 0: Extract changes from latest message
    await runFollowUpExtraction(messages, state)

    // Safety assessment runs on every user message
    const safetyResult = runSafetyTool(state.intake, latestUserMessage)
    state.tools.safety = safetyResult
    state.intake.safety.route = safetyResult.route
    state.intake.safety.redFlags = safetyResult.redFlags

    if (safetyResult.requiresEscalation) {
      state.phase = 'escalated'
      const emergencyText =
        safetyResult.route === 'emergency_now'
          ? 'This sounds like it may need immediate medical attention. Please seek emergency care or call 999.'
          : 'Based on what you described, I recommend seeing a Western medicine doctor first before exploring Chinese Medicine.'
      return {
        ok: true,
        statusCode: 200,
        payload: { model: DEEPSEEK_MODEL, text: emergencyText, agentState: state, status: 'escalated', matches: [] },
      }
    }

    // Step 1: LLM decides action
    const actionMessages = [
      { role: 'system', content: buildActionPrompt(state, messages) },
    ]
    const rawAction = await callDeepSeek(actionMessages, 0.2)
    let action = normalizeAction(rawAction)

    if (!action) {
      action = {
        type: 'finish',
        summary: 'Proceeding with available information.',
        showMatches: true,
        responseText: 'Let me show you matching practitioners.',
        thought: 'Action parsing failed. Defaulting to finish.',
      }
    }

    // Step 2: Enforce invariants
    const invariantResult = enforceInvariants(state, action)
    action = invariantResult.action

    // Step 3: Execute action
    const toolResults = executeAction(state, action)

    // Step 4: If tool was called, do a refinement pass for the response
    let responseText = action.responseText || ''
    if (action.type === 'tool_call' && toolResults.preview_matches) {
      const refineMessages = [
        { role: 'system', content: buildResponseRefinementPrompt(state, action, toolResults) },
      ]
      try {
        const refined = await callDeepSeek(refineMessages, 0.3)
        if (refined && typeof refined.responseText === 'string') {
          responseText = refined.responseText
        }
      } catch {
        // If refinement fails, use original text
      }
    }

    // Step 5: Compute matches if finishing or if preview was called
    let matches = []
    let status = 'needs_clarification'

    if (state.phase === 'done' || action.type === 'finish') {
      matches = scorePractitioners(state.intake, PRACTITIONERS)
      status = 'showing_matches'
      state.phase = 'done'
    } else if (action.type === 'tool_call' && toolResults.preview_matches) {
      matches = toolResults.preview_matches.matches
      status = 'showing_matches'
    }

    return {
      ok: true,
      statusCode: 200,
      payload: {
        model: DEEPSEEK_MODEL,
        text: responseText,
        agentState: state,
        status,
        matches,
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Agent conversation error'
    if (message.includes('missing_deepseek_api_key')) {
      return {
        ok: false,
        statusCode: 503,
        payload: { error: 'missing_deepseek_api_key', message: 'DEEPSEEK_API_KEY is not set.', model: DEEPSEEK_MODEL },
      }
    }
    if (message.includes('deepseek_timeout')) {
      return {
        ok: false,
        statusCode: 504,
        payload: { error: 'deepseek_timeout', message: 'The AI service took too long to respond. Please try again.', model: DEEPSEEK_MODEL },
      }
    }
    return {
      ok: false,
      statusCode: 500,
      payload: { error: 'agent_conversation_error', message: 'The AI conversation service is temporarily unavailable. Please try again.', model: DEEPSEEK_MODEL },
    }
  }
}
