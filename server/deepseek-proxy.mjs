import { createServer } from 'node:http'

const HOST = process.env.CMATCH_API_HOST ?? '127.0.0.1'
const PORT = Number.parseInt(process.env.CMATCH_API_PORT ?? '8787', 10)
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com'
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL ?? 'deepseek-v4-flash'
const MAX_BODY_BYTES = 32_768

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  response.end(JSON.stringify(payload))
}

function readJsonBody(request) {
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
      if (!body.trim()) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(body))
      } catch {
        reject(new Error('invalid_json'))
      }
    })

    request.on('error', reject)
  })
}

function safeDeepSeekFailureMessage(status) {
  if (status === 401 || status === 403) {
    return 'DeepSeek authentication failed. Check DEEPSEEK_API_KEY in .env, save the file, and restart npm run dev.'
  }
  return 'DeepSeek request failed. Check the local API server logs and retry.'
}

const PRACTITIONERS = [
  {
    id: 'cmp-001',
    name: 'Dr. Chan Mei Ling',
    clinic: 'Central Harmony Chinese Medicine',
    gender: 'female',
    districts: ['central_and_western'],
    areas: ['Sheung Wan', 'Central'],
    mtr: ['Sheung Wan', 'Central'],
    languages: ['cantonese', 'english', 'mandarin'],
    specialties: ['general_chinese_medicine', 'gynecology', 'fertility_support', 'internal_medicine_digestive'],
    modalities: ['herbal_medicine', 'acupuncture', 'diet_lifestyle_guidance'],
    accepts: { ageBands: ['adult_18_64', 'older_adult_65_plus'], pregnancyRelated: true, children: false },
    availability: { nextAvailable: '1-3 days', evenings: true, weekends: false, acceptingNewPatients: true },
    experienceYears: 14,
    priceRange: '$$$',
    bio: 'Focused on calm, evidence-aware consultations for digestive, menstrual and fertility-related concerns.',
    profileQuality: 0.95,
  },
  {
    id: 'cmp-002',
    name: 'Dr. Wong Ka Ho',
    clinic: 'Mong Kok Die-Da & Rehab Clinic',
    gender: 'male',
    districts: ['yau_tsim_mong'],
    areas: ['Mong Kok', 'Prince Edward'],
    mtr: ['Mong Kok', 'Prince Edward'],
    languages: ['cantonese', 'mandarin'],
    specialties: ['bone_traumatology_die_da', 'tuina_rehabilitation', 'acupuncture_pain'],
    modalities: ['bonesetting', 'tuina', 'acupuncture', 'cupping'],
    accepts: { ageBands: ['teen_13_17', 'adult_18_64'], pregnancyRelated: false, children: false },
    availability: { nextAvailable: 'Today', evenings: true, weekends: true, acceptingNewPatients: true },
    experienceYears: 18,
    priceRange: '$$',
    bio: 'Injury-focused practice for sprains, strains, neck and back pain with clear referral boundaries.',
    profileQuality: 0.9,
  },
  {
    id: 'cmp-003',
    name: 'Dr. Lee Siu Ming',
    clinic: 'Sha Tin Acupuncture Pain Centre',
    gender: 'male',
    districts: ['sha_tin'],
    areas: ['Sha Tin Centre', 'Fo Tan'],
    mtr: ['Sha Tin'],
    languages: ['cantonese', 'english'],
    specialties: ['acupuncture_pain', 'tuina_rehabilitation', 'elderly_care', 'chronic_condition_support'],
    modalities: ['acupuncture', 'tuina', 'cupping', 'diet_lifestyle_guidance'],
    accepts: { ageBands: ['adult_18_64', 'older_adult_65_plus'], pregnancyRelated: false, children: false },
    availability: { nextAvailable: '4-7 days', evenings: false, weekends: true, acceptingNewPatients: true },
    experienceYears: 21,
    priceRange: '$$',
    bio: 'Pain and mobility consultations for office posture issues, chronic aches and older adult mobility concerns.',
    profileQuality: 0.88,
  },
  {
    id: 'cmp-004',
    name: 'Dr. Lam Hoi Yan',
    clinic: "Wan Chai Women's CM Clinic",
    gender: 'female',
    districts: ['wan_chai'],
    areas: ['Wan Chai', 'Admiralty'],
    mtr: ['Wan Chai'],
    languages: ['cantonese', 'english', 'mandarin'],
    specialties: ['gynecology', 'pregnancy_postpartum_support', 'fertility_support', 'sleep_stress_fatigue'],
    modalities: ['herbal_medicine', 'acupuncture', 'moxibustion', 'diet_lifestyle_guidance'],
    accepts: { ageBands: ['adult_18_64'], pregnancyRelated: true, children: false },
    availability: { nextAvailable: '1-3 days', evenings: false, weekends: true, acceptingNewPatients: true },
    experienceYears: 12,
    priceRange: '$$$',
    bio: "Women's health and postpartum support with explicit caution checks for pregnancy-related concerns.",
    profileQuality: 0.93,
  },
  {
    id: 'cmp-005',
    name: 'Dr. Ng Tsz Chun',
    clinic: 'Kowloon Digestive & Sleep Studio',
    gender: 'male',
    districts: ['kowloon_city', 'sham_shui_po'],
    areas: ['Ho Man Tin', 'Lai Chi Kok'],
    mtr: ['Ho Man Tin', 'Lai Chi Kok'],
    languages: ['cantonese', 'english'],
    specialties: ['internal_medicine_digestive', 'sleep_stress_fatigue', 'general_chinese_medicine'],
    modalities: ['herbal_medicine', 'diet_lifestyle_guidance', 'acupuncture'],
    accepts: { ageBands: ['adult_18_64', 'older_adult_65_plus'], pregnancyRelated: false, children: false },
    availability: { nextAvailable: 'More than 1 week', evenings: true, weekends: false, acceptingNewPatients: true },
    experienceYears: 9,
    priceRange: '$$',
    bio: 'Digestive discomfort, fatigue and sleep support with careful medication and herb interaction screening.',
    profileQuality: 0.84,
  },
  {
    id: 'cmp-006',
    name: 'Dr. Tse Wing Yan',
    clinic: 'Tsuen Wan Family CM Centre',
    gender: 'female',
    districts: ['tsuen_wan'],
    areas: ['Tsuen Wan', 'Discovery Park'],
    mtr: ['Tsuen Wan'],
    languages: ['cantonese', 'mandarin'],
    specialties: ['pediatrics', 'respiratory_ent', 'dermatology', 'general_chinese_medicine'],
    modalities: ['herbal_medicine', 'diet_lifestyle_guidance', 'tuina'],
    accepts: { ageBands: ['child_2_12', 'teen_13_17', 'adult_18_64'], pregnancyRelated: false, children: true },
    availability: { nextAvailable: '4-7 days', evenings: true, weekends: true, acceptingNewPatients: true },
    experienceYears: 16,
    priceRange: '$$',
    bio: 'Family-oriented practice for pediatric, respiratory, ENT and skin-related Chinese medicine consultations.',
    profileQuality: 0.89,
  },
]

function conversationSystemPrompt() {
  return `You are CMatch, an AI intake assistant for a Hong Kong Chinese Medicine practitioner finder.

Your job is to have a natural conversation with the patient, structure their concern into a canonical schema, ask clarifying questions when needed, and when the schema is complete, recommend the best-matched practitioners from the database.

## Rules
- Do NOT diagnose. Do NOT provide treatment advice.
- ALWAYS use the canonical schema enum keys exactly as listed. Never invent new keys.
- Preserve uncertainty. If a field is unclear, set it to "unknown" and ask the user.
- Safety is critical. If you detect any red flags (chest pain, stroke symptoms, severe bleeding, breathing difficulty, pregnancy-related bleeding), set safetyRoute to "emergency_now" or "urgent_western_medical_review" and explain why in your text.
- Be conversational, warm, and concise. Speak in the same language the user is using (English, Cantonese, or Mandarin).
- When asking clarifying questions, ask ONE question at a time.
- When the schema is sufficiently complete (domains, bodyRegions, duration, severity, district, language are known), ask if the user wants to see practitioner matches.
- When returning matches, rank them by best fit and explain WHY each is a good match in 1-2 sentences.
- **CRITICAL: On EVERY turn, re-evaluate the ENTIRE schema from the full conversation history. The user may mention new information at any time (e.g. "oh actually I prefer Tsim Sha Tsui" or "I am pregnant"). You must detect these changes and update ALL relevant schema fields, not just the field you asked about.**

## Schema Enums
- domains: musculoskeletal_pain, injury_sprain_strain, headache_migraine, digestive_gastrointestinal, respiratory_ent, skin_dermatology, gynecology_menstrual, fertility_reproductive, pregnancy_postpartum, pediatrics, sleep_fatigue_stress, chronic_condition_support, wellness_prevention, unknown
- bodyRegions: head_face, neck, shoulder, arm_elbow_hand, chest, upper_back, lower_back, abdomen, pelvis_hip, knee, ankle_foot, skin_general, whole_body, unknown
- safetyRoute: emergency_now, urgent_western_medical_review, human_review_before_matching, ok_to_match
- districtsPreferred: central_and_western, wan_chai, eastern, yau_tsim_mong, sham_shui_po, kowloon_city, kwun_tong, sha_tin, tsuen_wan, remote_or_no_preference
- languagesPreferred: cantonese, english, mandarin, no_preference
- treatmentPreferences/treatmentAvoidances: herbal_medicine, acupuncture, tuina, bonesetting, cupping, moxibustion, diet_lifestyle_guidance, integrative_referral
- duration: acute, subacute, chronic, recurrent, unknown
- severity: mild, moderate, severe, unknown
- ageBand: adult_18_64, older_adult_65_plus, teen_13_17, child_2_12, unknown
- pregnancyStatus: not_applicable, pregnant, possibly_pregnant, postpartum, unknown

## Practitioner Database
${JSON.stringify(PRACTITIONERS, null, 2)}

## Response Format
You MUST return ONLY a valid JSON object with this exact shape:
{
  "text": "Your natural language response to the user. This is what the user sees in the chat.",
  "schema": {
    "schemaVersion": "cmatch.intake.v1",
    "source": { "rawText": "concatenated user messages", "language": "en | zh-HK | zh-CN | mixed | unknown" },
    "patientContext": { "ageBand": "...", "pregnancyStatus": "..." },
    "complaint": {
      "domains": ["..."],
      "bodyRegions": ["..."],
      "symptomQualities": ["..."],
      "duration": "...",
      "severity": "...",
      "functionalImpact": ["..."]
    },
    "safety": { "route": "...", "redFlags": ["..."] },
    "preferences": {
      "districtsPreferred": ["..."],
      "languagesPreferred": ["..."],
      "treatmentPreferences": ["..."],
      "treatmentAvoidances": ["..."]
    },
    "extractionMeta": { "confidence": "high | medium | low", "missingImportantFields": ["..."], "needsHumanReview": true | false }
  },
  "status": "needs_clarification | ready_to_match | showing_matches",
  "matches": [
    {
      "practitionerId": "cmp-001",
      "score": 85,
      "band": "Strong match | Good match | Possible match",
      "reasons": ["reason 1", "reason 2"],
      "cautions": ["caution 1"]
    }
  ]
}

- "matches" should only be included when status is "showing_matches".
- "text" should always be a warm, natural response. When status is "showing_matches", include a brief intro before listing the matches.
- When status is "needs_clarification", the text should include your ONE clarifying question.
- When status is "ready_to_match", the text should summarize the understanding and ask if they want to see matches.`
}

async function conversationWithDeepSeek(payload) {
  const apiKey = process.env.DEEPSEEK_API_KEY

  if (!apiKey) {
    return {
      ok: false,
      statusCode: 503,
      payload: {
        error: 'missing_deepseek_api_key',
        message: 'DEEPSEEK_API_KEY is not set on the local API server.',
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

  try {
    const deepseekResponse = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          { role: 'system', content: conversationSystemPrompt() },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ],
        stream: false,
        temperature: 0.3,
      }),
    })

    const data = await deepseekResponse.json()

    if (!deepseekResponse.ok) {
      const providerCode = typeof data?.error?.code === 'string' ? data.error.code : undefined
      console.error('[cmatch-api] deepseek_conversation_failed', {
        status: deepseekResponse.status,
        providerCode,
        model: DEEPSEEK_MODEL,
      })
      return {
        ok: false,
        statusCode: deepseekResponse.status,
        payload: {
          error: 'deepseek_request_failed',
          message: safeDeepSeekFailureMessage(deepseekResponse.status),
          model: DEEPSEEK_MODEL,
        },
      }
    }

    const rawContent = data?.choices?.[0]?.message?.content ?? '{}'
    let parsed
    try {
      parsed = JSON.parse(rawContent)
    } catch {
      parsed = { text: rawContent, schema: null, status: 'needs_clarification', matches: [] }
    }

    return {
      ok: true,
      statusCode: 200,
      payload: {
        model: DEEPSEEK_MODEL,
        text: parsed.text ?? 'I understood your concern. Let me ask a few clarifying questions.',
        schema: parsed.schema ?? null,
        status: parsed.status ?? 'needs_clarification',
        matches: parsed.matches ?? [],
      },
    }
  } catch (error) {
    console.error('[cmatch-api] deepseek_conversation_error', {
      message: error instanceof Error ? error.message : 'unknown',
      model: DEEPSEEK_MODEL,
    })
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

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? `${HOST}:${PORT}`}`)

  if (request.method === 'GET' && url.pathname === '/api/health') {
    sendJson(response, 200, {
      ok: true,
      service: 'cmatch-api',
      model: DEEPSEEK_MODEL,
      deepseekConfigured: Boolean(process.env.DEEPSEEK_API_KEY),
    })
    return
  }

  if (request.method === 'POST' && url.pathname === '/api/deepseek/conversation') {
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

  // Legacy endpoints — keep for compatibility during transition
  if (request.method === 'POST' && url.pathname === '/api/deepseek/analyze') {
    sendJson(response, 410, {
      error: 'deprecated',
      message: 'Use /api/deepseek/conversation instead.',
    })
    return
  }

  if (request.method === 'POST' && url.pathname === '/api/deepseek/analyze-stream') {
    sendJson(response, 410, {
      error: 'deprecated',
      message: 'Use /api/deepseek/conversation instead.',
    })
    return
  }

  sendJson(response, 404, {
    error: 'not_found',
    message: 'Unknown CMatch API route.',
  })
})

server.listen(PORT, HOST, () => {
  console.log(`[cmatch-api] listening on http://${HOST}:${PORT}`)
  console.log(`[cmatch-api] model=${DEEPSEEK_MODEL} deepseekConfigured=${Boolean(process.env.DEEPSEEK_API_KEY)}`)
})
