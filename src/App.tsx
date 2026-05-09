import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import './App.css'
import PasswordGate from './PasswordGate'
import type { Language, HKDistrict, ComplaintDomain, BodyRegion, TreatmentModality, SafetyRoute, AgeBand, Practitioner, Specialty } from '../shared/practitioners.ts'
import { DOMAIN_TO_SPECIALTIES } from '../shared/practitioners.ts'
import practitionersData from '../shared/practitioners.json'


// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

type AnalysisStatus = 'idle' | 'thinking' | 'streaming' | 'ready' | 'error'

type CanonicalIntake = {
  schemaVersion: 'cmatch.intake.v1'
  source: { rawText: string; language: 'zh-HK' | 'zh-CN' | 'en' | 'mixed' | 'unknown' }
  patientContext: {
    ageBand: AgeBand
    pregnancyStatus: 'not_applicable' | 'pregnant' | 'possibly_pregnant' | 'postpartum' | 'unknown'
  }
  complaint: {
    domains: ComplaintDomain[]
    bodyRegions: BodyRegion[]
    symptomQualities: string[]
    duration: 'acute' | 'subacute' | 'chronic' | 'recurrent' | 'unknown'
    severity: 'mild' | 'moderate' | 'severe' | 'unknown'
    functionalImpact: string[]
  }
  safety: { route: SafetyRoute; redFlags: string[] }
  preferences: {
    districtsPreferred: HKDistrict[]
    languagesPreferred: Language[]
    treatmentPreferences: TreatmentModality[]
    treatmentAvoidances: TreatmentModality[]
  }
  extractionMeta: {
    missingImportantFields: string[]
    needsHumanReview: boolean
  }
}

type AiMatch = {
  practitionerId: string
  score: number
  band: 'Strong match' | 'Good match' | 'Possible match'
  reasons: string[]
  cautions: string[]
}

export type ChatMessage =
  | { role: 'user'; text: string }
  | { role: 'ai'; text: string; schema?: CanonicalIntake; status?: string; matches?: AiMatch[] }

type AppPage = 'home' | 'match' | 'about'

// ═══════════════════════════════════════════════════════════════════════════════
// LABELS
// ═══════════════════════════════════════════════════════════════════════════════

const domainLabels: Record<ComplaintDomain, string> = {
  pain_musculoskeletal: 'Pain & Musculoskeletal (疼痛与筋骨)',
  pain_headache: 'Headache & Migraine (头痛)',
  neurological: 'Neurological (神经与眩晕)',
  digestive: 'Digestive (消化)',
  respiratory_allergy: 'Respiratory & Allergy (呼吸与过敏)',
  skin_dermatology: 'Skin & Dermatology (皮肤)',
  sleep_energy: 'Sleep & Energy (睡眠与精力)',
  mental_emotional: 'Mental & Emotional (情志与情绪)',
  women_health: "Women's Health (妇科与生殖)",
  men_health: "Men's Health (男科)",
  cardiovascular_circulation: 'Cardiovascular & Circulation (心血管)',
  urinary_kidney: 'Urinary & Kidney (泌尿与肾)',
  ent: 'Ear, Nose & Throat (耳鼻喉)',
  eye_vision: 'Eye & Vision (眼科)',
  dental_oral: 'Dental & Oral (口腔)',
  endocrine_metabolic: 'Endocrine & Metabolic (内分泌与代谢)',
  oncology_support: 'Oncology Support (肿瘤康复)',
  wellness_prevention: 'Wellness & Prevention (保健)',
  unknown: 'Unknown / unclear',
}

const bodyRegionLabels: Record<BodyRegion, string> = {
  head_face: 'Head / face', neck: 'Neck', shoulder: 'Shoulder',
  arm_elbow_hand: 'Arm / elbow / hand', chest: 'Chest',
  upper_back: 'Upper back', lower_back: 'Lower back',
  abdomen: 'Abdomen', pelvis_hip: 'Pelvis / hip',
  knee: 'Knee', ankle_foot: 'Ankle / foot',
  skin_general: 'Skin', whole_body: 'Whole body', unknown: 'Unknown region',
}

const districtLabels: Record<HKDistrict, string> = {
  central_and_western: 'Central & Western', wan_chai: 'Wan Chai',
  eastern: 'Eastern', southern: 'Southern',
  yau_tsim_mong: 'Yau Tsim Mong', sham_shui_po: 'Sham Shui Po',
  kowloon_city: 'Kowloon City', wong_tai_sin: 'Wong Tai Sin',
  kwun_tong: 'Kwun Tong', kwai_tsing: 'Kwai Tsing',
  tsuen_wan: 'Tsuen Wan', tuen_mun: 'Tuen Mun',
  yuen_long: 'Yuen Long', north: 'North',
  tai_po: 'Tai Po', sha_tin: 'Sha Tin',
  sai_kung: 'Sai Kung', islands: 'Islands',
  remote_or_no_preference: 'No district preference',
}

const languageLabels: Record<Language, string> = {
  cantonese: 'Cantonese', english: 'English',
  mandarin: 'Mandarin', no_preference: 'No language preference',
}

const modalityLabels: Record<TreatmentModality, string> = {
  herbal_medicine: 'Herbal medicine', acupuncture: 'Acupuncture',
  tuina: 'Tui na', bonesetting: 'Die-da / bonesetting',
  cupping: 'Cupping', moxibustion: 'Moxibustion',
  diet_lifestyle_guidance: 'Diet & lifestyle', integrative_referral: 'Integrative support',
}

const durationLabels: Record<string, string> = {
  acute: 'Acute: <2 weeks', subacute: 'Subacute: 2–6 weeks',
  chronic: 'Chronic: >6 weeks', recurrent: 'Recurring', unknown: 'Unknown',
}

const severityLabels: Record<string, string> = {
  mild: 'Mild', moderate: 'Moderate', severe: 'Severe / sudden', unknown: 'Unknown',
}

const ageBandLabels: Record<AgeBand, string> = {
  adult_18_64: 'Adult 18–64', older_adult_65_plus: 'Older adult 65+',
  teen_13_17: 'Teen 13–17', child_2_12: 'Child 2–12', unknown: 'Unknown',
}

const pregnancyLabels: Record<string, string> = {
  not_applicable: 'Not applicable', pregnant: 'Pregnant',
  possibly_pregnant: 'Possibly pregnant', postpartum: 'Postpartum', unknown: 'Unknown',
}

const safetyRouteLabels: Record<SafetyRoute, string> = {
  emergency_now: 'Emergency — seek immediate care',
  urgent_western_medical_review: 'Urgent — see a doctor first',
  human_review_before_matching: 'Needs review before matching',
  ok_to_match: 'No emergency signals detected',
}

const specialtyLabels: Record<Specialty, string> = {
  internal_medicine: 'Internal Medicine (内科)',
  surgery: 'Surgery (外科)',
  obstetrics_gynecology: 'Obstetrics & Gynecology (妇产科)',
  pediatrics: 'Pediatrics (儿科)',
  dermatology: 'Dermatology (皮肤科)',
  ophthalmology: 'Ophthalmology (眼科)',
  otorhinolaryngology: 'Otorhinolaryngology (耳鼻咽喉科)',
  stomatology: 'Stomatology (口腔科)',
  oncology: 'Oncology (肿瘤科)',
  orthopedics_traumatology: 'Orthopedics & Traumatology (骨伤科)',
  proctology: 'Proctology (肛肠科)',
  geriatrics: 'Geriatrics (老年病科)',
  acupuncture: 'Acupuncture (针灸科)',
  tuina: 'Tuina (推拿科)',
  emergency_medicine: 'Emergency Medicine (急诊科)',
  rehabilitation_medicine: 'Rehabilitation Medicine (康复医学)',
  preventive_healthcare: 'Preventive Healthcare (预防保健科)',
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRACTITIONER DATABASE
// ═══════════════════════════════════════════════════════════════════════════════

const practitioners = practitionersData as Practitioner[]

const practitionerMap = new Map(practitioners.map((p) => [p.id, p]))

// ═══════════════════════════════════════════════════════════════════════════════
// CLIENT-SIDE PRACTITIONER SCORING
// ═══════════════════════════════════════════════════════════════════════════════

function scorePractitioners(schema: CanonicalIntake, practitionersList: Practitioner[]): AiMatch[] {
  const relevantSpecialties = new Set<Specialty>()
  for (const domain of schema.complaint.domains) {
    if (domain === 'unknown') continue
    for (const specialty of DOMAIN_TO_SPECIALTIES[domain]) {
      relevantSpecialties.add(specialty)
    }
  }

  return practitionersList
    .map((p) => {
      let score = 0
      const reasons: string[] = []
      const cautions: string[] = []

      // 1. Specialty match (0–50 points)
      const specialtyOverlap = p.specialties.filter((s) => relevantSpecialties.has(s))
      if (specialtyOverlap.length > 0) {
        score += 30 + Math.min(20, specialtyOverlap.length * 10)
        reasons.push(`Specialises in ${specialtyOverlap.map((s) => specialtyLabels[s]).join(', ')}`)
      }

      // 2. District match (0–20 points)
      const districtOverlap = p.districts.filter(
        (d) =>
          schema.preferences.districtsPreferred.includes(d) ||
          schema.preferences.districtsPreferred.includes('remote_or_no_preference'),
      )
      if (districtOverlap.length > 0 || schema.preferences.districtsPreferred.length === 0) {
        score += 20
        if (districtOverlap.length > 0) {
          reasons.push(`Available in ${districtOverlap.map((d) => districtLabels[d]).join(', ')}`)
        }
      }

      // 3. Language match (0–15 points)
      const langOverlap = p.languages.filter(
        (l) =>
          schema.preferences.languagesPreferred.includes(l) ||
          schema.preferences.languagesPreferred.includes('no_preference'),
      )
      if (langOverlap.length > 0 || schema.preferences.languagesPreferred.length === 0) {
        score += 15
        if (langOverlap.length > 0) {
          reasons.push(`Speaks ${langOverlap.map((l) => languageLabels[l]).join(', ')}`)
        }
      }

      // 4. Modality preference (0–10 points)
      const modalityOverlap = p.modalities.filter((m) => schema.preferences.treatmentPreferences.includes(m))
      if (modalityOverlap.length > 0) {
        score += 10
        reasons.push(`Offers ${modalityOverlap.map((m) => modalityLabels[m]).join(', ')}`)
      }

      // 5. Age band hard filter
      if (
        !p.accepts.ageBands.includes(schema.patientContext.ageBand) &&
        schema.patientContext.ageBand !== 'unknown'
      ) {
        score = -1000
        cautions.push(`Does not accept ${ageBandLabels[schema.patientContext.ageBand]} patients`)
      }

      // 7. Pregnancy hard filter
      if (
        (schema.patientContext.pregnancyStatus === 'pregnant' ||
          schema.patientContext.pregnancyStatus === 'postpartum') &&
        !p.accepts.pregnancyRelated
      ) {
        score = -1000
        cautions.push('Does not accept pregnancy-related cases')
      }

      const normalizedScore = Math.max(0, Math.min(1, score / 100))

      let band: AiMatch['band']
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

// Visual-only schema shown immediately when user sends a message.
// All fields are empty/unknown so tags render as gray placeholders.
// The AI-populated schema replaces this on first response.
const initialPanelSchema: CanonicalIntake = {
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
  extractionMeta: {
    missingImportantFields: [],
    needsHumanReview: false,
  },
}

// ═══════════════════════════════════════════════════════════════════════════════
// APP SHELL — only left dot menu + side drawer, NO top nav bar
// ═══════════════════════════════════════════════════════════════════════════════

function AppShell({
  children,
  menuOpen,
  onMenuToggle,
  currentPage,
  onNavigate,
}: {
  children: React.ReactNode
  menuOpen: boolean
  onMenuToggle: () => void
  currentPage: AppPage
  onNavigate: (page: AppPage) => void
}) {
  const isActive = (page: AppPage) => currentPage === page
  const [showDot, setShowDot] = useState(true)

  useEffect(() => {
    if (menuOpen) {
      queueMicrotask(() => setShowDot(false))
      return
    }
    const DRAWER_CLOSE_MS = 360
    const DOT_DELAY_MS = 0
    const timer = setTimeout(() => setShowDot(true), DRAWER_CLOSE_MS + DOT_DELAY_MS)
    return () => clearTimeout(timer)
  }, [menuOpen])

  return (
    <div className="app-shell">
      {/* Single dot menu button — fixed, top-left, hides when drawer is open */}
      {showDot && (
        <button
          className="menu-dot"
          onClick={onMenuToggle}
          aria-label="Open menu"
          aria-expanded={false}
        />
      )}

      {/* Drawer scrim */}
      {menuOpen && <div className="drawer-scrim" onClick={onMenuToggle} aria-hidden="true" />}

      {/* Side drawer */}
      <aside className={`side-drawer ${menuOpen ? 'is-open' : ''}`} role="dialog" aria-label="Navigation menu">
        <div className="drawer-head">
          <strong>CMatch</strong>
        </div>
        <nav className="drawer-nav">
          <button className={`drawer-link ${isActive('home') ? 'active' : ''}`} onClick={() => { onNavigate('home'); onMenuToggle() }}>Home</button>
          <button className={`drawer-link ${isActive('match') ? 'active' : ''}`} onClick={() => { onNavigate('match'); onMenuToggle() }}>Match</button>
          <button className={`drawer-link ${isActive('about') ? 'active' : ''}`} onClick={() => { onNavigate('about'); onMenuToggle() }}>About</button>
        </nav>
      </aside>

      <main className="app-main">{children}</main>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// UNDERSTANDING PANEL (detached, updates after every AI turn)
// ═══════════════════════════════════════════════════════════════════════════════

function formatQuality(text: string): string {
  return text.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function getFieldValue(
  label: string,
  schema: CanonicalIntake
): string | null {
  switch (label) {
    case 'Issue':
      return schema.complaint.domains.map((d) => domainLabels[d]).join(', ') || null
    case 'Where':
      return schema.complaint.bodyRegions.map((r) => bodyRegionLabels[r]).join(', ') || null
    case 'Details':
      return schema.complaint.symptomQualities.map(formatQuality).join(', ') || null
    case 'Duration':
      return durationLabels[schema.complaint.duration] ?? 'Unknown'
    case 'Severity':
      return severityLabels[schema.complaint.severity] ?? 'Unknown'
    case 'Age':
      return ageBandLabels[schema.patientContext.ageBand] ?? 'Unknown'
    case 'Pregnancy':
      return pregnancyLabels[schema.patientContext.pregnancyStatus] ?? 'Unknown'
    case 'District':
      return schema.preferences.districtsPreferred.map((d) => districtLabels[d]).join(', ') || null
    case 'Language':
      return schema.preferences.languagesPreferred.map((l) => languageLabels[l]).join(', ') || null
    case 'Treatment preference':
      return schema.preferences.treatmentPreferences.map((m) => modalityLabels[m]).join(', ') || 'No preference'
    case 'Avoidances':
      return schema.preferences.treatmentAvoidances.map((m) => modalityLabels[m]).join(', ') || 'None specified'
    default:
      return null
  }
}

function isMissingValue(value: string | null): boolean {
  if (value === null || value === undefined) return true
  const v = value.trim()
  if (v === '') return true
  const missingSentinels = ['Unknown', 'No district preference', 'No language preference', 'No preference', 'None specified', 'Not provided']
  return missingSentinels.includes(v)
}

/*
  Animation state for a tag:
  - 'initial': first time panel appears, tag is gray with label only
  - 'populate': was missing, now filled — type text in, then gray→green swipe
  - 'update': was filled with value A, now filled with value B — delete old, type new
  - 'remove': was filled, now missing — delete text, then green→gray swipe
  - 'static': unchanged, no animation
*/
function getTagAnimState(
  label: string,
  currentSchema: CanonicalIntake,
  previousSchema: CanonicalIntake | null,
  isFirstAppearance: boolean
): 'initial' | 'populate' | 'update' | 'remove' | 'static' {
  const current = getFieldValue(label, currentSchema)
  const prev = previousSchema ? getFieldValue(label, previousSchema) : null

  const currentMissing = isMissingValue(current)
  const prevMissing = prev === null || isMissingValue(prev)

  if (isFirstAppearance) {
    return currentMissing ? 'initial' : 'populate'
  }

  if (prevMissing && !currentMissing) return 'populate'
  if (!prevMissing && currentMissing) return 'remove'
  if (!prevMissing && !currentMissing && current !== prev) return 'update'
  return 'static'
}

function TagPill({
  label,
  value,
  prevValue,
  animState,
  delay,
}: {
  label: string
  value: string | null
  prevValue: string | null
  animState: 'initial' | 'populate' | 'update' | 'remove' | 'static'
  delay: number
}) {
  const valueRef = useRef<HTMLSpanElement>(null)
  const [phase, setPhase] = useState<'idle' | 'typing' | 'deleting' | 'swipe-in' | 'swipe-out'>('idle')
  const timerRef = useRef<number | null>(null)
  const intervalRef = useRef<number | null>(null)
  const missing = isMissingValue(value)
  const sourceText = prevValue || ''
  const targetText = value || ''

  const clearAll = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const typeText = useCallback((text: string, onComplete: () => void) => {
    setPhase('typing')
    const el = valueRef.current
    if (!el || text.length === 0) {
      onComplete()
      return
    }
    let i = 0
    el.textContent = text.charAt(0)
    i = 1
    if (i >= text.length) {
      onComplete()
      return
    }
    intervalRef.current = window.setInterval(() => {
      if (valueRef.current) {
        valueRef.current.textContent = text.slice(0, i + 1)
      }
      i++
      if (i >= text.length) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
        onComplete()
      }
    }, 30)
  }, [])

  const deleteText = useCallback((text: string, onComplete: () => void) => {
    setPhase('deleting')
    const el = valueRef.current
    if (!el || text.length === 0) {
      onComplete()
      return
    }
    let i = text.length
    intervalRef.current = window.setInterval(() => {
      if (valueRef.current) {
        valueRef.current.textContent = text.slice(0, i)
      }
      i--
      if (i < 0) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
        onComplete()
      }
    }, 20)
  }, [])

  // Synchronously reset/correct DOM text before the browser paints,
  // preventing stale text from flashing when a tag becomes visible or
  // when an interrupted animation is replaced by a new one.
  useLayoutEffect(() => {
    if (!valueRef.current) return
    if (animState === 'static') {
      valueRef.current.textContent = targetText
    } else if (animState === 'update' && sourceText) {
      valueRef.current.textContent = sourceText
    } else if (animState === 'remove' && sourceText) {
      valueRef.current.textContent = sourceText
    } else {
      valueRef.current.textContent = ''
    }
  }, [animState, targetText, sourceText])

  useEffect(() => {
    clearAll()

    if (animState === 'static') {
      queueMicrotask(() => setPhase(missing ? 'idle' : 'swipe-in'))
      return clearAll
    }

    if (animState === 'initial') {
      queueMicrotask(() => setPhase('idle'))
      return clearAll
    }

    timerRef.current = window.setTimeout(() => {
      if (animState === 'populate') {
        typeText(targetText, () => setPhase('swipe-in'))
      } else if (animState === 'update') {
        if (sourceText) {
          deleteText(sourceText, () => {
            typeText(targetText, () => setPhase('swipe-in'))
          })
        } else {
          typeText(targetText, () => setPhase('swipe-in'))
        }
      } else if (animState === 'remove') {
        if (sourceText) {
          deleteText(sourceText, () => queueMicrotask(() => setPhase('swipe-out')))
        } else {
          queueMicrotask(() => setPhase('swipe-out'))
        }
      }
    }, delay)

    return clearAll
  }, [animState, targetText, sourceText, delay, missing, clearAll, typeText, deleteText])

  return (
    <span
      className={`schema-tag ${missing ? 'missing' : 'filled'}`}
      data-phase={phase}
    >
      <span className="tag-bg" aria-hidden="true" />
      <span className="tag-label">{label}</span>
      <span className="tag-value" ref={valueRef} />
    </span>
  )
}

function CategoryRow({
  title,
  tags,
  isFirstAppearance,
  previousSchema,
  currentSchema,
  baseDelay,
}: {
  title: string
  tags: Array<{ label: string }>
  isFirstAppearance: boolean
  previousSchema: CanonicalIntake | null
  currentSchema: CanonicalIntake
  baseDelay: number
}) {
  return (
    <div className="category-row">
      <span className="category-title">{title}</span>
      <div className="category-tags">
        {tags.map((t, i) => {
          const value = getFieldValue(t.label, currentSchema)
          const prevValue = previousSchema ? getFieldValue(t.label, previousSchema) : null
          const animState = getTagAnimState(t.label, currentSchema, previousSchema, isFirstAppearance)
          return (
            <TagPill
              key={t.label}
              label={t.label}
              value={value}
              prevValue={prevValue}
              animState={animState}
              delay={baseDelay + i * 150}
            />
          )
        })}
      </div>
    </div>
  )
}

function TitleCard({
  title,
  children,
  className = '',
  action,
}: {
  title: string
  children: React.ReactNode
  className?: string
  action?: React.ReactNode
}) {
  return (
    <section className={`title-card ${className}`}>
      <div className="title-card-header">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function UnderstandingPanel({
  schema,
  previousSchema,
  isFirstAppearance,
}: {
  schema: CanonicalIntake
  previousSchema: CanonicalIntake | null
  isFirstAppearance: boolean
}) {
  const chiefComplaint = useMemo(() => [{ label: 'Issue' }, { label: 'Where' }, { label: 'Details' }, { label: 'Duration' }, { label: 'Severity' }], [])
  const patientProfile = useMemo(() => [{ label: 'Age' }, { label: 'Pregnancy' }], [])
  const preferences = useMemo(() => [{ label: 'District' }, { label: 'Language' }, { label: 'Treatment preference' }, { label: 'Avoidances' }], [])
  return (
    <TitleCard title="Here is how CMatch understood your concern" className="understanding-panel">
      <CategoryRow
        title="Chief complaint"
        tags={chiefComplaint}
        isFirstAppearance={isFirstAppearance}
        previousSchema={previousSchema}
        currentSchema={schema}
        baseDelay={0}
      />
      <CategoryRow
        title="Patient profile"
        tags={patientProfile}
        isFirstAppearance={isFirstAppearance}
        previousSchema={previousSchema}
        currentSchema={schema}
        baseDelay={750}
      />
      <CategoryRow
        title="Preferences"
        tags={preferences}
        isFirstAppearance={isFirstAppearance}
        previousSchema={previousSchema}
        currentSchema={schema}
        baseDelay={1050}
      />
      {schema.safety.route !== 'ok_to_match' && (
        <div
          className={`safety-banner ${schema.safety.route === 'emergency_now' ? 'emergency' : schema.safety.route === 'urgent_western_medical_review' ? 'urgent' : 'review'}`}
          style={{ animationDelay: '800ms' }}
        >
          <strong>{safetyRouteLabels[schema.safety.route]}</strong>
          <p>{schema.safety.redFlags.join(', ')}</p>
        </div>
      )}
    </TitleCard>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// RECOMMENDED PRACTITIONERS PANEL — big practitioner cards
// ═══════════════════════════════════════════════════════════════════════════════

function RecommendedPractitionersPanel({
  matches,
  isFirstAppearance,
  showAll,
  onToggleShowAll,
}: {
  matches: AiMatch[]
  isFirstAppearance: boolean
  showAll: boolean
  onToggleShowAll: () => void
}) {
  return (
    <TitleCard
      title="Recommended practitioners"
      className={`matches-panel ${isFirstAppearance ? 'animate-in' : ''}`}
      action={
        <button className="reset-btn" onClick={onToggleShowAll} type="button">
          {showAll ? 'Hide' : 'Show all'}
        </button>
      }
    >
      <div className={`matches-grid ${isFirstAppearance ? 'animate-in' : ''}`}>
        {matches.map((match) => {
          const practitioner = practitionerMap.get(match.practitionerId)
          if (!practitioner) return null
          return (
            <article className="match-card" key={match.practitionerId}>
              <header className="match-card-head">
                <div>
                  <h3>{practitioner.displayName}</h3>
                  <p>{practitioner.clinicName}</p>
                </div>
                <span className={`match-band ${match.band.toLowerCase().replace(/\s/g, '-')}`}>{match.band}</span>
              </header>
              <div className="match-details">
                <div className="match-detail">
                  <svg className="match-detail-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  <span>{practitioner.areas.join(' / ')}</span>
                </div>
                <div className="match-detail">
                  <svg className="match-detail-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                  <span>{practitioner.languages.map((l) => languageLabels[l]).join(' · ')}</span>
                </div>
                <div className="match-detail">
                  <svg className="match-detail-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  <span>{practitioner.availability.nextAvailable}</span>
                </div>
                <div className="match-detail">
                  <svg className="match-detail-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                  </svg>
                  <span>{practitioner.modalities.map((m) => modalityLabels[m]).join(' · ')}</span>
                </div>
              </div>
              <div className="match-reasons">
                {match.reasons.map((r, i) => <span key={i} className="reason-tag">{r}</span>)}
              </div>
            </article>
          )
        })}
      </div>
    </TitleCard>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHAT PANEL — clean, no header bar, fixed size
// ═══════════════════════════════════════════════════════════════════════════════

function ChatPanel({
  messages,
  input,
  status,
  onInputChange,
  onSend,
  suggestions,
}: {
  messages: ChatMessage[]
  input: string
  status: AnalysisStatus
  onInputChange: (value: string) => void
  onSend: () => void
  suggestions?: React.ReactNode
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [input])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend() }
  }

  const isBusy = status === 'thinking' || status === 'streaming'
  const isStreaming = status === 'streaming'

  return (
    <div className="chat-panel">
      <div className="chat-messages" ref={scrollRef}>
        {messages.length === 0 && (
          <>
            <div className="chat-empty">
              <p className="chat-empty-lead">Describe your symptoms, timing, location and care preferences.</p>
            </div>
            {suggestions && <div className="chat-suggestions">{suggestions}</div>}
          </>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`chat-msg ${msg.role}`}>
            <div className="chat-msg-bubble">
              {msg.text}
              {msg.role === 'ai' && isStreaming && i === messages.length - 1 && (
                <span className="stream-cursor" />
              )}
            </div>
          </div>
        ))}
        {status === 'thinking' && (
          <div className="chat-msg ai thinking-msg">
            <div className="thinking-indicator">
              <span className="thinking-label">Thinking</span>
            </div>
          </div>
        )}
      </div>

      <div className="chat-footer">
        <div className="chat-input-wrap">
          <div className="textarea-box">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your concern…"
              disabled={isBusy}
              rows={1}
            />
          </div>
          <button className="chat-send" onClick={onSend} disabled={isBusy || input.trim().length === 0}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGES
// ═══════════════════════════════════════════════════════════════════════════════

function MatchingPage({
  messages, input, status, error, onInputChange, onSend, onReset,
}: {
  messages: ChatMessage[]; input: string; status: AnalysisStatus; error: string
  onInputChange: (value: string) => void; onSend: () => void; onReset?: () => void
}) {
  const { latestSchema, previousSchema } = useMemo(() => {
    let latest: CanonicalIntake | null = null
    let prev: CanonicalIntake | null = null
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i]
      if (msg.role === 'ai' && msg.schema) {
        if (!latest) {
          latest = msg.schema
        } else if (!prev) {
          prev = msg.schema
          break
        }
      }
    }
    return { latestSchema: latest, previousSchema: prev }
  }, [messages])

  const hasUserSentMessage = messages.some((m) => m.role === 'user')

  // Show panel immediately when user sends a message (gray placeholder tags).
  // When AI responds, tags animate from gray to green based on what changed.
  const panelSchema = latestSchema ?? (hasUserSentMessage ? initialPanelSchema : null)
  const panelPrevSchema = latestSchema ? (previousSchema ?? initialPanelSchema) : null
  const isFirstAppearance = latestSchema !== null && previousSchema === null

  // Client-side scoring: only match using REAL schema from AI responses
  const clientSideMatches = useMemo(() => {
    if (!latestSchema) return []
    return scorePractitioners(latestSchema, practitioners)
  }, [latestSchema])

  const [showMatchCards, setShowMatchCards] = useState(false)
  const [showAllPractitioners, setShowAllPractitioners] = useState(false)

  useEffect(() => {
    if (latestSchema) {
      const t = setTimeout(() => setShowMatchCards(true), 800)
      return () => clearTimeout(t)
    }
    queueMicrotask(() => setShowMatchCards(false))
  }, [latestSchema])

  const displayMatches = showAllPractitioners ? clientSideMatches : clientSideMatches.slice(0, 3)

  return (
    <section className="match-page">
      <div className="match-hero">
        <h1>Match with a Chinese Medicine Practitioner.</h1>
      </div>
      <div className="match-layout">
        <TitleCard
          title="Agentic matching"
          action={
            onReset && messages.length > 0 ? (
              <button className="reset-btn" onClick={onReset} type="button">
                Reset
              </button>
            ) : undefined
          }
        >
          <ChatPanel
            messages={messages}
            input={input}
            status={status}
            onInputChange={onInputChange}
            onSend={onSend}
            suggestions={
              <div className="quick-picks">
                <button className="quick-pick-btn" onClick={() => onInputChange('Lower back pain for 3 weeks, worse after sitting, near Wan Chai. Prefer Cantonese, open to acupuncture but not herbs.')}>Lower back pain</button>
                <span className="quick-pick-sep">·</span>
                <button className="quick-pick-btn" onClick={() => onInputChange('I twisted my ankle two days ago. Walking hurts and it is swollen. I prefer a clinic near Mong Kok.')}>Ankle sprain</button>
                <span className="quick-pick-sep">·</span>
                <button className="quick-pick-btn" onClick={() => onInputChange('Bloating after meals, low energy, and poor sleep for more than two months. I work near Ho Man Tin.')}>Digestion & sleep</button>
              </div>
            }
          />
        </TitleCard>

        {error && <div className="match-error"><p>{error}</p></div>}

        {panelSchema && <UnderstandingPanel schema={panelSchema} previousSchema={panelPrevSchema} isFirstAppearance={isFirstAppearance} />}

        {latestSchema && (
          <RecommendedPractitionersPanel
            matches={showMatchCards ? displayMatches : []}
            isFirstAppearance={showMatchCards}
            showAll={showAllPractitioners}
            onToggleShowAll={() => setShowAllPractitioners((v) => !v)}
          />
        )}
      </div>
    </section>
  )
}

function HomePage({ onStart }: { onStart: () => void }) {
  return (
    <section className="home-page">
      <div className="home-hero">
        <span className="home-label">CMatch</span>
        <h1>Find the right Chinese medicine practitioner in our trusted network.</h1>
        <p>Share your symptoms, timing, location and care preferences. CMatch will understand and match you with the right practitioner.</p>
        <button className="home-cta" type="button" onClick={onStart}>Find your practitioner</button>
      </div>
    </section>
  )
}

function AboutPage() {
  return (
    <section className="about-page">
      <h1>About CMatch</h1>
      <p>CMatch uses AI to understand your health concern and match you with the right Chinese Medicine practitioner in Hong Kong.</p>
    </section>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════

function pathForPage(page: AppPage) {
  if (page === 'home') return '/'
  return `/${page}`
}
function pageFromPath(path: string): AppPage {
  if (path === '/') return 'home'
  if (path === '/about') return 'about'

  return 'match'
}

export default function App() {
  const [page, setPage] = useState<AppPage>(() => pageFromPath(window.location.pathname))
  const [menuOpen, setMenuOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [status, setStatus] = useState<AnalysisStatus>('idle')
  const [error, setError] = useState('')
  const streamIntervalRef = useRef<number | null>(null)

  useEffect(() => {
    const onPopState = () => setPage(pageFromPath(window.location.pathname))
    window.addEventListener('popstate', onPopState)
    return () => {
      window.removeEventListener('popstate', onPopState)
      if (streamIntervalRef.current) {
        clearInterval(streamIntervalRef.current)
        streamIntervalRef.current = null
      }
    }
  }, [])

  function navigate(target: AppPage) {
    const nextPath = pathForPage(target)
    if (window.location.pathname !== nextPath) window.history.pushState(null, '', nextPath)
    setPage(target)
    setMenuOpen(false)
  }

  function stopStreaming() {
    if (streamIntervalRef.current) {
      clearInterval(streamIntervalRef.current)
      streamIntervalRef.current = null
    }
  }

  function resetConversation() {
    stopStreaming()
    setMessages([])
    setInput('')
    setStatus('idle')
    setError('')
  }

  async function sendMessage() {
    const text = input.trim()
    if (text.length === 0 || status === 'thinking' || streamIntervalRef.current) return

    stopStreaming()

    const userMsg: ChatMessage = { role: 'user', text }
    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setInput('')
    setStatus('thinking')
    setError('')

    // Find the most recent schema to send as state to the AI
    let currentSchema: CanonicalIntake | undefined
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i]
      if (msg.role === 'ai' && msg.schema) {
        currentSchema = msg.schema
        break
      }
    }

    try {
      const sitePassword = sessionStorage.getItem('cmatch-pwd') || ''
      const response = await fetch('/api/conversation', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-site-password': sitePassword,
        },
        body: JSON.stringify({
          messages: nextMessages.map((m) => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.text })),
          currentSchema,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        const parts = [data.message, data.providerMessage, data.providerCode ? `(${data.providerCode})` : null].filter(Boolean)
        throw new Error(parts.join(' ') || data.error || 'AI service error')
      }

      const fullText = data.text ?? 'I understood your concern.'

      // Show AI bubble immediately with first char — avoids empty-state race
      // and the 'first letter cut off' glitch
      flushSync(() => {
        setMessages((prev) => [
          ...prev,
          { role: 'ai', text: fullText.charAt(0) || '' },
        ])
        setStatus('streaming')
      })

      // Stream by character slices — no word-splitting, no space-collapse
      let charIndex = 1
      streamIntervalRef.current = window.setInterval(() => {
        if (charIndex >= fullText.length) {
          stopStreaming()
          flushSync(() => {
            setMessages((prev) => {
              const msgs = [...prev]
              const lastIdx = msgs.length - 1
              if (msgs[lastIdx].role === 'ai') {
                msgs[lastIdx] = {
                  role: 'ai',
                  text: fullText,
                  schema: data.schema ?? undefined,
                  status: data.status,
                  matches: data.matches ?? undefined,
                }
              }
              return msgs
            })
            setStatus('ready')
          })
          return
        }

        // Stream 2 chars per tick (~60 chars/sec) — smooth but not sluggish
        const nextIndex = Math.min(charIndex + 2, fullText.length)
        flushSync(() => {
          setMessages((prev) => {
            const msgs = [...prev]
            const lastIdx = msgs.length - 1
            if (msgs[lastIdx].role === 'ai') {
              msgs[lastIdx] = { ...msgs[lastIdx], text: fullText.slice(0, nextIndex) }
            }
            return msgs
          })
        })
        charIndex = nextIndex
      }, 22) as unknown as number
    } catch (err) {
      stopStreaming()
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setStatus('error')
    }
  }

  return (
    <PasswordGate>
      <AppShell menuOpen={menuOpen} onMenuToggle={() => setMenuOpen((o) => !o)} currentPage={page} onNavigate={navigate}>
        {page === 'home' && <HomePage onStart={() => navigate('match')} />}
        {page === 'match' && <MatchingPage messages={messages} input={input} status={status} error={error} onInputChange={setInput} onSend={sendMessage} onReset={resetConversation} />}
        {page === 'about' && <AboutPage />}
      </AppShell>
    </PasswordGate>
  )
}
