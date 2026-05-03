import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

type Language = 'cantonese' | 'english' | 'mandarin' | 'no_preference'
type HKDistrict =
  | 'central_and_western' | 'wan_chai' | 'eastern' | 'yau_tsim_mong'
  | 'sham_shui_po' | 'kowloon_city' | 'kwun_tong' | 'sha_tin' | 'tsuen_wan'
  | 'remote_or_no_preference'

type ComplaintDomain =
  | 'musculoskeletal_pain' | 'injury_sprain_strain' | 'headache_migraine'
  | 'digestive_gastrointestinal' | 'respiratory_ent' | 'skin_dermatology'
  | 'gynecology_menstrual' | 'fertility_reproductive' | 'pregnancy_postpartum'
  | 'pediatrics' | 'sleep_fatigue_stress' | 'chronic_condition_support'
  | 'wellness_prevention' | 'unknown'

type BodyRegion =
  | 'head_face' | 'neck' | 'shoulder' | 'arm_elbow_hand' | 'chest'
  | 'upper_back' | 'lower_back' | 'abdomen' | 'pelvis_hip' | 'knee'
  | 'ankle_foot' | 'skin_general' | 'whole_body' | 'unknown'

type TreatmentModality =
  | 'herbal_medicine' | 'acupuncture' | 'tuina' | 'bonesetting'
  | 'cupping' | 'moxibustion' | 'diet_lifestyle_guidance' | 'integrative_referral'

type SafetyRoute =
  | 'emergency_now' | 'urgent_western_medical_review'
  | 'human_review_before_matching' | 'ok_to_match'

type AnalysisStatus = 'idle' | 'thinking' | 'ready' | 'error'

type CanonicalIntake = {
  schemaVersion: 'cmatch.intake.v1'
  source: { rawText: string; language: 'zh-HK' | 'zh-CN' | 'en' | 'mixed' | 'unknown' }
  patientContext: {
    ageBand: 'adult_18_64' | 'older_adult_65_plus' | 'teen_13_17' | 'child_2_12' | 'unknown'
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
    confidence: 'high' | 'medium' | 'low'
    missingImportantFields: string[]
    needsHumanReview: boolean
  }
}

type Practitioner = {
  id: string
  displayName: string
  title: string
  gender: 'female' | 'male'
  clinicName: string
  districts: HKDistrict[]
  areas: string[]
  mtrNearby: string[]
  languages: Language[]
  specialties: string[]
  modalities: TreatmentModality[]
  accepts: { ageBands: string[]; pregnancyRelated: boolean; children: boolean }
  availability: { nextAvailable: string; evenings: boolean; weekends: boolean; acceptingNewPatients: boolean }
  experienceYears: number
  priceRange: '$' | '$$' | '$$$'
  bio: string
  profileQuality: number
}

type AiMatch = {
  practitionerId: string
  score: number
  band: 'Strong match' | 'Good match' | 'Possible match'
  reasons: string[]
  cautions: string[]
}

type ChatMessage =
  | { role: 'user'; text: string }
  | { role: 'ai'; text: string; schema?: CanonicalIntake; status?: string; matches?: AiMatch[] }

type AppPage = 'match' | 'about' | 'debug'

// ═══════════════════════════════════════════════════════════════════════════════
// LABELS
// ═══════════════════════════════════════════════════════════════════════════════

const domainLabels: Record<ComplaintDomain, string> = {
  musculoskeletal_pain: 'Musculoskeletal pain',
  injury_sprain_strain: 'Injury / sprain / strain',
  headache_migraine: 'Headache / migraine',
  digestive_gastrointestinal: 'Digestive / gastrointestinal',
  respiratory_ent: 'Respiratory / ENT',
  skin_dermatology: 'Skin / dermatology',
  gynecology_menstrual: 'Gynecology / menstrual',
  fertility_reproductive: 'Fertility / reproductive',
  pregnancy_postpartum: 'Pregnancy / postpartum',
  pediatrics: 'Pediatrics',
  sleep_fatigue_stress: 'Sleep / fatigue / stress',
  chronic_condition_support: 'Chronic condition support',
  wellness_prevention: 'Wellness / prevention',
  unknown: 'Unknown domain',
}

const bodyRegionLabels: Record<BodyRegion, string> = {
  head_face: 'Head / face', neck: 'Neck', shoulder: 'Shoulder',
  arm_elbow_hand: 'Arm / elbow / hand', chest: 'Chest',
  upper_back: 'Upper back', lower_back: 'Lower back',
  abdomen: 'Abdomen / digestive', pelvis_hip: 'Pelvis / hip',
  knee: 'Knee', ankle_foot: 'Ankle / foot',
  skin_general: 'Skin', whole_body: 'Whole body', unknown: 'Unknown region',
}

const districtLabels: Record<HKDistrict, string> = {
  central_and_western: 'Central & Western', wan_chai: 'Wan Chai',
  eastern: 'Eastern', yau_tsim_mong: 'Yau Tsim Mong',
  sham_shui_po: 'Sham Shui Po', kowloon_city: 'Kowloon City',
  kwun_tong: 'Kwun Tong', sha_tin: 'Sha Tin',
  tsuen_wan: 'Tsuen Wan', remote_or_no_preference: 'No district preference',
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

const ageBandLabels: Record<string, string> = {
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

// ═══════════════════════════════════════════════════════════════════════════════
// PRACTITIONER DATABASE
// ═══════════════════════════════════════════════════════════════════════════════

const practitioners: Practitioner[] = [
  {
    id: 'cmp-001', displayName: 'Dr. Chan Mei Ling', title: 'Registered Chinese Medicine Practitioner', gender: 'female',
    clinicName: 'Central Harmony Chinese Medicine', districts: ['central_and_western'], areas: ['Sheung Wan', 'Central'],
    mtrNearby: ['Sheung Wan', 'Central'], languages: ['cantonese', 'english', 'mandarin'],
    specialties: ['general_chinese_medicine', 'gynecology', 'fertility_support', 'internal_medicine_digestive'],
    modalities: ['herbal_medicine', 'acupuncture', 'diet_lifestyle_guidance'],
    accepts: { ageBands: ['adult_18_64', 'older_adult_65_plus'], pregnancyRelated: true, children: false },
    availability: { nextAvailable: '1-3 days', evenings: true, weekends: false, acceptingNewPatients: true },
    experienceYears: 14, priceRange: '$$$', bio: 'Focused on calm, evidence-aware consultations for digestive, menstrual and fertility-related concerns.', profileQuality: 0.95,
  },
  {
    id: 'cmp-002', displayName: 'Dr. Wong Ka Ho', title: 'Registered Chinese Medicine Practitioner', gender: 'male',
    clinicName: 'Mong Kok Die-Da & Rehab Clinic', districts: ['yau_tsim_mong'], areas: ['Mong Kok', 'Prince Edward'],
    mtrNearby: ['Mong Kok', 'Prince Edward'], languages: ['cantonese', 'mandarin'],
    specialties: ['bone_traumatology_die_da', 'tuina_rehabilitation', 'acupuncture_pain'],
    modalities: ['bonesetting', 'tuina', 'acupuncture', 'cupping'],
    accepts: { ageBands: ['teen_13_17', 'adult_18_64'], pregnancyRelated: false, children: false },
    availability: { nextAvailable: 'Today', evenings: true, weekends: true, acceptingNewPatients: true },
    experienceYears: 18, priceRange: '$$', bio: 'Injury-focused practice for sprains, strains, neck and back pain with clear referral boundaries.', profileQuality: 0.9,
  },
  {
    id: 'cmp-003', displayName: 'Dr. Lee Siu Ming', title: 'Registered Chinese Medicine Practitioner', gender: 'male',
    clinicName: 'Sha Tin Acupuncture Pain Centre', districts: ['sha_tin'], areas: ['Sha Tin Centre', 'Fo Tan'],
    mtrNearby: ['Sha Tin'], languages: ['cantonese', 'english'],
    specialties: ['acupuncture_pain', 'tuina_rehabilitation', 'elderly_care', 'chronic_condition_support'],
    modalities: ['acupuncture', 'tuina', 'cupping', 'diet_lifestyle_guidance'],
    accepts: { ageBands: ['adult_18_64', 'older_adult_65_plus'], pregnancyRelated: false, children: false },
    availability: { nextAvailable: '4-7 days', evenings: false, weekends: true, acceptingNewPatients: true },
    experienceYears: 21, priceRange: '$$', bio: 'Pain and mobility consultations for office posture issues, chronic aches and older adult mobility concerns.', profileQuality: 0.88,
  },
  {
    id: 'cmp-004', displayName: 'Dr. Lam Hoi Yan', title: 'Registered Chinese Medicine Practitioner', gender: 'female',
    clinicName: "Wan Chai Women's CM Clinic", districts: ['wan_chai'], areas: ['Wan Chai', 'Admiralty'],
    mtrNearby: ['Wan Chai'], languages: ['cantonese', 'english', 'mandarin'],
    specialties: ['gynecology', 'pregnancy_postpartum_support', 'fertility_support', 'sleep_stress_fatigue'],
    modalities: ['herbal_medicine', 'acupuncture', 'moxibustion', 'diet_lifestyle_guidance'],
    accepts: { ageBands: ['adult_18_64'], pregnancyRelated: true, children: false },
    availability: { nextAvailable: '1-3 days', evenings: false, weekends: true, acceptingNewPatients: true },
    experienceYears: 12, priceRange: '$$$', bio: "Women's health and postpartum support with explicit caution checks for pregnancy-related concerns.", profileQuality: 0.93,
  },
  {
    id: 'cmp-005', displayName: 'Dr. Ng Tsz Chun', title: 'Registered Chinese Medicine Practitioner', gender: 'male',
    clinicName: 'Kowloon Digestive & Sleep Studio', districts: ['kowloon_city', 'sham_shui_po'], areas: ['Ho Man Tin', 'Lai Chi Kok'],
    mtrNearby: ['Ho Man Tin', 'Lai Chi Kok'], languages: ['cantonese', 'english'],
    specialties: ['internal_medicine_digestive', 'sleep_stress_fatigue', 'general_chinese_medicine'],
    modalities: ['herbal_medicine', 'diet_lifestyle_guidance', 'acupuncture'],
    accepts: { ageBands: ['adult_18_64', 'older_adult_65_plus'], pregnancyRelated: false, children: false },
    availability: { nextAvailable: 'More than 1 week', evenings: true, weekends: false, acceptingNewPatients: true },
    experienceYears: 9, priceRange: '$$', bio: 'Digestive discomfort, fatigue and sleep support with careful medication and herb interaction screening.', profileQuality: 0.84,
  },
  {
    id: 'cmp-006', displayName: 'Dr. Tse Wing Yan', title: 'Registered Chinese Medicine Practitioner', gender: 'female',
    clinicName: 'Tsuen Wan Family CM Centre', districts: ['tsuen_wan'], areas: ['Tsuen Wan', 'Discovery Park'],
    mtrNearby: ['Tsuen Wan'], languages: ['cantonese', 'mandarin'],
    specialties: ['pediatrics', 'respiratory_ent', 'dermatology', 'general_chinese_medicine'],
    modalities: ['herbal_medicine', 'diet_lifestyle_guidance', 'tuina'],
    accepts: { ageBands: ['child_2_12', 'teen_13_17', 'adult_18_64'], pregnancyRelated: false, children: true },
    availability: { nextAvailable: '4-7 days', evenings: true, weekends: true, acceptingNewPatients: true },
    experienceYears: 16, priceRange: '$$', bio: 'Family-oriented practice for pediatric, respiratory, ENT and skin-related Chinese medicine consultations.', profileQuality: 0.89,
  },
]

const practitionerMap = new Map(practitioners.map((p) => [p.id, p]))

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

  return (
    <div className="app-shell">
      {/* Single dot menu button — fixed, top-left, hides when drawer is open */}
      {!menuOpen && (
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
          <button onClick={onMenuToggle} aria-label="Close menu">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <nav className="drawer-nav">
          <button className={`drawer-link ${isActive('match') ? 'active' : ''}`} onClick={() => { onNavigate('match'); onMenuToggle() }}>Match</button>
          <button className={`drawer-link ${isActive('about') ? 'active' : ''}`} onClick={() => { onNavigate('about'); onMenuToggle() }}>About</button>
          <button className={`drawer-link ${isActive('debug') ? 'active' : ''}`} onClick={() => { onNavigate('debug'); onMenuToggle() }}>Debug</button>
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
  return text
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function Tag({ label, value, delay }: { label: string; value: string | null; delay: number }) {
  const isMissing = !value || value.includes('Unknown') || value.includes('No preference') || value.includes('None specified')
  return (
    <span className={`schema-tag ${isMissing ? 'missing' : 'filled'}`} style={{ animationDelay: `${delay}ms` }}>
      <small>{label}</small>
      {isMissing ? <em>Not provided</em> : <strong>{value}</strong>}
    </span>
  )
}

function CategoryRow({ title, tags, baseDelay }: { title: string; tags: Array<{ label: string; value: string | null }>; baseDelay: number }) {
  return (
    <div className="category-row" style={{ animationDelay: `${baseDelay}ms` }}>
      <span className="category-title">{title}</span>
      <div className="category-tags">
        {tags.map((t, i) => (
          <Tag key={t.label} label={t.label} value={t.value} delay={baseDelay + i * 60} />
        ))}
      </div>
    </div>
  )
}

function UnderstandingPanel({ schema }: { schema: CanonicalIntake }) {
  const qualities = schema.complaint.symptomQualities.map(formatQuality).join(', ') || null

  const chiefComplaint = [
    { label: 'Issue', value: schema.complaint.domains.map((d) => domainLabels[d]).join(', ') || null },
    { label: 'Where', value: schema.complaint.bodyRegions.map((r) => bodyRegionLabels[r]).join(', ') || null },
    { label: 'Details', value: qualities },
    { label: 'Duration', value: durationLabels[schema.complaint.duration] ?? 'Unknown' },
    { label: 'Severity', value: severityLabels[schema.complaint.severity] ?? 'Unknown' },
  ]

  const patientProfile = [
    { label: 'Age', value: ageBandLabels[schema.patientContext.ageBand] ?? 'Unknown' },
    { label: 'Pregnancy', value: pregnancyLabels[schema.patientContext.pregnancyStatus] ?? 'Unknown' },
  ]

  const preferences = [
    { label: 'District', value: schema.preferences.districtsPreferred.map((d) => districtLabels[d]).join(', ') || null },
    { label: 'Language', value: schema.preferences.languagesPreferred.map((l) => languageLabels[l]).join(', ') || null },
    { label: 'Treatment preference', value: schema.preferences.treatmentPreferences.map((m) => modalityLabels[m]).join(', ') || 'No preference' },
    { label: 'Avoidances', value: schema.preferences.treatmentAvoidances.map((m) => modalityLabels[m]).join(', ') || 'None specified' },
  ]

  return (
    <section className="understanding-panel">
      <div className="panel-header" style={{ animationDelay: '0ms' }}>
        <h2>Here is how CMatch understood your concern</h2>
        <span className={`confidence-badge ${schema.extractionMeta.confidence}`}>{schema.extractionMeta.confidence}</span>
      </div>

      <CategoryRow title="Chief complaint" tags={chiefComplaint} baseDelay={80} />
      <CategoryRow title="Patient profile" tags={patientProfile} baseDelay={380} />
      <CategoryRow title="Preferences" tags={preferences} baseDelay={560} />

      {schema.safety.route !== 'ok_to_match' && (
        <div
          className={`safety-banner ${schema.safety.route === 'emergency_now' ? 'emergency' : schema.safety.route === 'urgent_western_medical_review' ? 'urgent' : 'review'}`}
          style={{ animationDelay: '800ms' }}
        >
          <strong>{safetyRouteLabels[schema.safety.route]}</strong>
          <p>{schema.safety.redFlags.join(', ')}</p>
        </div>
      )}
    </section>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MATCHES PANEL (detached)
// ═══════════════════════════════════════════════════════════════════════════════

function MatchesPanel({ matches }: { matches: AiMatch[] }) {
  return (
    <section className="matches-panel">
      <div className="panel-header">
        <h2>Suggested practitioners</h2>
      </div>
      <div className="matches-grid">
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
              <p className="match-bio">{practitioner.bio}</p>
              <div className="match-meta">
                <span>{practitioner.areas.join(' / ')}</span>
                <span>{practitioner.languages.map((l) => languageLabels[l]).join(' · ')}</span>
                <span>{practitioner.availability.nextAvailable}</span>
              </div>
              <div className="match-reasons">
                {match.reasons.map((r, i) => <span key={i} className="reason-tag">{r}</span>)}
              </div>
              {match.cautions.length > 0 && (
                <div className="match-cautions">
                  {match.cautions.map((c, i) => <span key={i} className="caution-tag">{c}</span>)}
                </div>
              )}
            </article>
          )
        })}
      </div>
    </section>
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
}: {
  messages: ChatMessage[]
  input: string
  status: AnalysisStatus
  onInputChange: (value: string) => void
  onSend: () => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend() }
  }

  const isThinking = status === 'thinking'

  return (
    <div className="chat-panel">
      <div className="chat-messages" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="chat-empty">
            <p className="chat-empty-lead">How can we help you today?</p>
            <p className="chat-empty-sub">Describe your symptoms, timing, location and care preferences.</p>
            <div className="chat-quick-picks">
              <button onClick={() => onInputChange('Lower back pain for 3 weeks, worse after sitting, near Wan Chai. Prefer Cantonese, open to acupuncture but not herbs.')}>Lower back pain</button>
              <button onClick={() => onInputChange('I twisted my ankle two days ago. Walking hurts and it is swollen. I prefer a clinic near Mong Kok.')}>Ankle sprain</button>
              <button onClick={() => onInputChange('Bloating after meals, low energy, and poor sleep for more than two months. I work near Ho Man Tin.')}>Digestion & sleep</button>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`chat-msg ${msg.role}`}>
            {msg.role === 'ai' && (
              <div className="chat-msg-avatar">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                </svg>
              </div>
            )}
            <div className="chat-msg-bubble">{msg.text}</div>
          </div>
        ))}

        {isThinking && (
          <div className="chat-msg ai">
            <div className="chat-msg-avatar">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              </svg>
            </div>
            <div className="chat-msg-bubble thinking">
              <span className="dot" /><span className="dot" /><span className="dot" />
            </div>
          </div>
        )}
      </div>

      <div className="chat-footer">
        <div className="chat-input-wrap">
          <textarea
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your concern…"
            rows={1}
            disabled={isThinking}
          />
          <button className="chat-send" onClick={onSend} disabled={isThinking || input.trim().length === 0}>
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
  messages, input, status, error, onInputChange, onSend,
}: {
  messages: ChatMessage[]; input: string; status: AnalysisStatus; error: string
  onInputChange: (value: string) => void; onSend: () => void
}) {
  const latestSchema = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i]
      if (msg.role === 'ai' && msg.schema) return msg.schema
    }
    return null
  }, [messages])

  const latestMatches = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i]
      if (msg.role === 'ai' && msg.matches) return msg.matches
    }
    return null
  }, [messages])

  return (
    <section className="match-page">
      <div className="match-hero">
        <h1>Describe your concern</h1>
        <p>Share symptoms, timing, location and care preferences. CMatch will understand and match you with the right practitioner.</p>
      </div>

      <div className="match-layout">
        <ChatPanel messages={messages} input={input} status={status} onInputChange={onInputChange} onSend={onSend} />

        {error && <div className="match-error"><p>{error}</p></div>}

        {latestSchema && <UnderstandingPanel schema={latestSchema} />}

        {latestMatches && latestMatches.length > 0 && <MatchesPanel matches={latestMatches} />}
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

function DebugPage({ messages }: { messages: ChatMessage[] }) {
  const latestSchema = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) { const msg = messages[i]; if (msg.role === 'ai' && msg.schema) return msg.schema }
    return null
  }, [messages])
  const latestMatches = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) { const msg = messages[i]; if (msg.role === 'ai' && msg.matches) return msg.matches }
    return null
  }, [messages])

  return (
    <section className="debug-page">
      <h1>Debug</h1>
      <details open><summary>Conversation ({messages.length})</summary><pre>{JSON.stringify(messages, null, 2)}</pre></details>
      {latestSchema && <details open><summary>Schema</summary><pre>{JSON.stringify(latestSchema, null, 2)}</pre></details>}
      {latestMatches && <details open><summary>Matches</summary><pre>{JSON.stringify(latestMatches, null, 2)}</pre></details>}
    </section>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════

function pathForPage(page: AppPage) { return page === 'match' ? '/' : `/${page}` }
function pageFromPath(path: string): AppPage {
  if (path === '/about') return 'about'
  if (path === '/debug') return 'debug'
  return 'match'
}

export default function App() {
  const [page, setPage] = useState<AppPage>(() => pageFromPath(window.location.pathname))
  const [menuOpen, setMenuOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [status, setStatus] = useState<AnalysisStatus>('idle')
  const [error, setError] = useState('')

  useEffect(() => {
    const onPopState = () => setPage(pageFromPath(window.location.pathname))
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  function navigate(target: AppPage) {
    const nextPath = pathForPage(target)
    if (window.location.pathname !== nextPath) window.history.pushState(null, '', nextPath)
    setPage(target)
    setMenuOpen(false)
  }

  async function sendMessage() {
    const text = input.trim()
    if (text.length === 0 || status === 'thinking') return

    const userMsg: ChatMessage = { role: 'user', text }
    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setInput('')
    setStatus('thinking')
    setError('')

    try {
      const response = await fetch('/api/deepseek/conversation', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages.map((m) => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.text })),
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || data.error || 'AI service error')

      const aiMsg: ChatMessage = {
        role: 'ai',
        text: data.text ?? 'I understood your concern.',
        schema: data.schema ?? undefined,
        status: data.status,
        matches: data.matches ?? undefined,
      }
      setMessages((prev) => [...prev, aiMsg])
      setStatus('ready')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setStatus('error')
    }
  }

  return (
    <AppShell menuOpen={menuOpen} onMenuToggle={() => setMenuOpen((o) => !o)} currentPage={page} onNavigate={navigate}>
      {page === 'match' && <MatchingPage messages={messages} input={input} status={status} error={error} onInputChange={setInput} onSend={sendMessage} />}
      {page === 'about' && <AboutPage />}
      {page === 'debug' && <DebugPage messages={messages} />}
    </AppShell>
  )
}
