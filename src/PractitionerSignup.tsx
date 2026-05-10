import { useState, useCallback, useRef, useEffect } from 'react'
import type { HKDistrict, Language, Specialty, TreatmentModality, AgeBand } from '../shared/practitioners.ts'

const districtOptions: { value: HKDistrict; label: string }[] = [
  { value: 'central_and_western', label: 'Central & Western' },
  { value: 'wan_chai', label: 'Wan Chai' },
  { value: 'eastern', label: 'Eastern' },
  { value: 'southern', label: 'Southern' },
  { value: 'yau_tsim_mong', label: 'Yau Tsim Mong' },
  { value: 'sham_shui_po', label: 'Sham Shui Po' },
  { value: 'kowloon_city', label: 'Kowloon City' },
  { value: 'wong_tai_sin', label: 'Wong Tai Sin' },
  { value: 'kwun_tong', label: 'Kwun Tong' },
  { value: 'kwai_tsing', label: 'Kwai Tsing' },
  { value: 'tsuen_wan', label: 'Tsuen Wan' },
  { value: 'tuen_mun', label: 'Tuen Mun' },
  { value: 'yuen_long', label: 'Yuen Long' },
  { value: 'north', label: 'North' },
  { value: 'tai_po', label: 'Tai Po' },
  { value: 'sha_tin', label: 'Sha Tin' },
  { value: 'sai_kung', label: 'Sai Kung' },
  { value: 'islands', label: 'Islands' },
  { value: 'remote_or_no_preference', label: 'Remote / No preference' },
]

const languageOptions: { value: Language; label: string }[] = [
  { value: 'cantonese', label: 'Cantonese' },
  { value: 'english', label: 'English' },
  { value: 'mandarin', label: 'Mandarin' },
]

const specialtyOptions: { value: Specialty; label: string }[] = [
  { value: 'internal_medicine', label: 'Internal Medicine (內科)' },
  { value: 'surgery', label: 'Surgery (外科)' },
  { value: 'obstetrics_gynecology', label: 'Obstetrics & Gynecology (婦科)' },
  { value: 'pediatrics', label: 'Pediatrics (兒科)' },
  { value: 'dermatology', label: 'Dermatology (皮膚科)' },
  { value: 'ophthalmology', label: 'Ophthalmology (眼科)' },
  { value: 'otorhinolaryngology', label: 'ENT (耳鼻喉科)' },
  { value: 'stomatology', label: 'Stomatology (口腔科)' },
  { value: 'oncology', label: 'Oncology (腫瘤科)' },
  { value: 'orthopedics_traumatology', label: 'Orthopedics & Traumatology (骨傷科)' },
  { value: 'proctology', label: 'Proctology (肛腸科)' },
  { value: 'geriatrics', label: 'Geriatrics (老年科)' },
  { value: 'acupuncture', label: 'Acupuncture (針灸科)' },
  { value: 'tuina', label: 'Tuina (推拿科)' },
  { value: 'emergency_medicine', label: 'Emergency Medicine (急症科)' },
  { value: 'rehabilitation_medicine', label: 'Rehabilitation Medicine (康復科)' },
  { value: 'preventive_healthcare', label: 'Preventive Healthcare (治未病科)' },
]

const modalityOptions: { value: TreatmentModality; label: string }[] = [
  { value: 'herbal_medicine', label: 'Herbal Medicine' },
  { value: 'acupuncture', label: 'Acupuncture' },
  { value: 'tuina', label: 'Tui Na' },
  { value: 'bonesetting', label: 'Die-da / Bonesetting' },
  { value: 'cupping', label: 'Cupping' },
  { value: 'moxibustion', label: 'Moxibustion' },
  { value: 'diet_lifestyle_guidance', label: 'Diet & Lifestyle Guidance' },
  { value: 'integrative_referral', label: 'Integrative Support / Referral' },
]

const ageBandOptions: { value: AgeBand; label: string }[] = [
  { value: 'adult_18_64', label: 'Adult (18–64)' },
  { value: 'older_adult_65_plus', label: 'Older Adult (65+)' },
  { value: 'teen_13_17', label: 'Teen (13–17)' },
  { value: 'child_2_12', label: 'Child (2–12)' },
]

const areaOptions = [
  'Aberdeen', 'Causeway Bay', 'Central', 'Cheung Sha Wan', 'Diamond Hill',
  'Discovery Bay', 'Fanling', 'Fo Tan', 'Happy Valley', 'Ho Man Tin',
  'Jordan', 'Kwai Chung', 'Kwun Tong', 'Lok Fu', 'North Point',
  'Quarry Bay', 'Repulse Bay', 'Sai Kung', 'Sai Wan Ho', 'Sai Ying Pun',
  'Sha Tin', 'Sham Shui Po', 'Sham Tseng', 'Siu Hong', 'Tai Po',
  'Taikoo Shing', 'To Kwa Wan', 'Tseung Kwan O', 'Tsing Yi', 'Tsuen Wan',
  'Tuen Mun', 'Wong Chuk Hang', 'Wong Tai Sin', 'Yau Ma Tei', 'Yuen Long',
].map((a) => ({ value: a, label: a }))

const mtrOptions = [
  'Central', 'Cheung Sha Wan', 'Diamond Hill', 'HKU', 'Hang Hau',
  'Kowloon City', 'Kwun Tong', 'Lai King', 'Long Ping', 'Ma On Shan',
  'Ocean Park', 'Quarry Bay', 'Sai Ying Pun', 'Sham Shui Po', 'Sheung Shui',
  'Sheung Wan', 'Siu Hong', 'Sung Wong Toi', 'Sunny Bay', 'Tai Koo',
  'Tai Po Market', 'Tai Wo Hau', 'To Kwa Wan', 'Tseung Kwan O', 'Tsim Sha Tsui',
  'Tsing Yi', 'Tsuen Wan', 'Tuen Mun', 'Wan Chai', 'Wong Chuk Hang',
  'Wong Tai Sin',
].map((a) => ({ value: a, label: a }))

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOM DROPDOWN COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function useClickOutside(ref: React.RefObject<HTMLElement | null>, handler: () => void) {
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!ref.current || ref.current.contains(e.target as Node)) return
      handler()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') handler()
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [ref, handler])
}

function DropdownChevron({ open }: { open: boolean }) {
  return (
    <svg width="12" height="8" viewBox="0 0 12 8" fill="none" style={{ transition: 'transform 200ms ease', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>
      <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CustomDropdown({ label, value, onChange, options, required, placeholder = 'Select…' }: {
  label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; required?: boolean; placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const selectedLabel = options.find((o) => o.value === value)?.label
  useClickOutside(wrapperRef, () => setOpen(false))

  return (
    <div className="ps-field" ref={wrapperRef}>
      <span className="ps-label">{label}{required && <span className="ps-required">*</span>}</span>
      <button type="button" className={`ps-dropdown-trigger ${open ? 'open' : ''}`} onClick={() => setOpen((o) => !o)}>
        <span className={selectedLabel ? 'ps-dropdown-value' : 'ps-dropdown-placeholder'}>{selectedLabel || placeholder}</span>
        <DropdownChevron open={open} />
      </button>
      {open && (
        <div className="ps-dropdown-panel">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              className={`ps-dropdown-item ${o.value === value ? 'selected' : ''}`}
              onClick={() => { onChange(o.value); setOpen(false) }}
            >
              {o.value === value && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
              <span>{o.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function CustomMultiDropdown<T extends string>({ label, values, onChange, options, required, placeholder = 'Select…' }: {
  label: string; values: T[]; onChange: (v: T[]) => void; options: { value: T; label: string }[]; required?: boolean; placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const wrapperRef = useRef<HTMLDivElement>(null)
  useClickOutside(wrapperRef, () => setOpen(false))

  const filtered = query.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options

  const toggle = useCallback((val: T) => {
    onChange(values.includes(val) ? values.filter((v) => v !== val) : [...values, val])
  }, [values, onChange])

  const displayText = values.length === 0
    ? placeholder
    : values.length === 1
      ? options.find((o) => o.value === values[0])?.label
      : `${values.length} selected`

  return (
    <div className="ps-field" ref={wrapperRef}>
      <span className="ps-label">{label}{required && <span className="ps-required">*</span>}</span>
      <button type="button" className={`ps-dropdown-trigger ${open ? 'open' : ''}`} onClick={() => setOpen((o) => !o)}>
        <span className={values.length > 0 ? 'ps-dropdown-value' : 'ps-dropdown-placeholder'}>{displayText}</span>
        <DropdownChevron open={open} />
      </button>
      {open && (
        <div className="ps-dropdown-panel">
          {options.length > 6 && (
            <div className="ps-dropdown-search">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                autoFocus
                onKeyDown={(e) => e.stopPropagation()}
              />
            </div>
          )}
          <div className="ps-dropdown-list">
            {filtered.map((o) => (
              <button
                key={o.value}
                type="button"
                className={`ps-dropdown-item ${values.includes(o.value) ? 'selected' : ''}`}
                onClick={() => toggle(o.value)}
              >
                <span className="ps-dropdown-check">
                  {values.includes(o.value) && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </span>
                <span>{o.label}</span>
              </button>
            ))}
            {filtered.length === 0 && <div className="ps-dropdown-empty">No results</div>}
          </div>
          {values.length > 0 && (
            <div className="ps-dropdown-footer">
              <button type="button" className="ps-dropdown-clear" onClick={() => onChange([])}>Clear all</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// FORM FIELD HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="ps-fieldset">
      <legend className="ps-legend">{title}</legend>
      {children}
    </fieldset>
  )
}

function TextInput({ label, value, onChange, placeholder, type = 'text', required }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; required?: boolean
}) {
  return (
    <label className="ps-field">
      <span className="ps-label">{label}{required && <span className="ps-required">*</span>}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="ps-input"
      />
    </label>
  )
}

function TextArea({ label, value, onChange, placeholder, required }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean
}) {
  return (
    <label className="ps-field">
      <span className="ps-label">{label}{required && <span className="ps-required">*</span>}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        rows={4}
        className="ps-textarea"
      />
    </label>
  )
}

function CheckboxGroup<T extends string>({ label, values, options, onChange }: {
  label: string; values: T[]; options: { value: T; label: string }[]; onChange: (v: T[]) => void
}) {
  const toggle = useCallback((val: T) => {
    onChange(values.includes(val) ? values.filter((v) => v !== val) : [...values, val])
  }, [values, onChange])

  return (
    <div className="ps-field">
      <span className="ps-label">{label}</span>
      <div className="ps-checkbox-group">
        {options.map((o) => (
          <label key={o.value} className="ps-checkbox">
            <input type="checkbox" checked={values.includes(o.value)} onChange={() => toggle(o.value)} />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="ps-toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="ps-toggle-slider" />
      <span className="ps-toggle-label">{label}</span>
    </label>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN FORM
// ═══════════════════════════════════════════════════════════════════════════════

export default function PractitionerSignup() {
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  // Form state
  const [fullName, setFullName] = useState('')
  const [title, setTitle] = useState('Registered Chinese Medicine Practitioner')
  const [gender, setGender] = useState<'female' | 'male'>('male')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [clinicName, setClinicName] = useState('')
  const [districts, setDistricts] = useState<HKDistrict[]>([])
  const [areas, setAreas] = useState<string[]>([])
  const [mtrNearby, setMtrNearby] = useState<string[]>([])
  const [languages, setLanguages] = useState<Language[]>([])
  const [specialties, setSpecialties] = useState<Specialty[]>([])
  const [modalities, setModalities] = useState<TreatmentModality[]>([])
  const [ageBands, setAgeBands] = useState<AgeBand[]>(['adult_18_64'])
  const [acceptsPregnancy, setAcceptsPregnancy] = useState(false)
  const [acceptsChildren, setAcceptsChildren] = useState(false)
  const [nextAvailable, setNextAvailable] = useState('1-3 days')
  const [evenings, setEvenings] = useState(false)
  const [weekends, setWeekends] = useState(false)
  const [acceptingNew, setAcceptingNew] = useState(true)
  const [experience, setExperience] = useState('')
  const [priceRange, setPriceRange] = useState<'$' | '$$' | '$$$' | '$$$$'>('$$')
  const [bio, setBio] = useState('')



  const validateStep = useCallback((s: number) => {
    if (s === 1) {
      if (!fullName.trim()) return 'Please enter your full name.'
      if (!email.trim() || !email.includes('@')) return 'Please enter a valid email.'
      if (!phone.trim()) return 'Please enter your phone number.'
    }
    if (s === 2) {
      if (!clinicName.trim()) return 'Please enter your clinic name.'
      if (districts.length === 0) return 'Please select at least one district.'
      if (areas.length === 0) return 'Please select at least one area.'
    }
    if (s === 3) {
      if (specialties.length === 0) return 'Please select at least one specialty.'
      if (modalities.length === 0) return 'Please select at least one treatment modality.'
    }
    if (s === 4) {
      if (!bio.trim()) return 'Please write a short bio.'
      if (!experience.trim() || Number.isNaN(Number(experience))) return 'Please enter years of experience.'
    }
    return ''
  }, [fullName, email, phone, clinicName, districts, areas, specialties, modalities, bio, experience])

  const nextStep = useCallback(() => {
    const err = validateStep(step)
    if (err) { setError(err); return }
    setError('')
    setStep((s) => Math.min(s + 1, 4))
  }, [step, validateStep])

  const prevStep = useCallback(() => {
    setError('')
    setStep((s) => Math.max(s - 1, 1))
  }, [])

  const submit = useCallback(async () => {
    const err = validateStep(step)
    if (err) { setError(err); return }
    setError('')
    setSubmitting(true)

    try {
      const payload = {
        fullName: fullName.trim(),
        title: title.trim(),
        gender,
        email: email.trim(),
        phone: phone.trim(),
        clinicName: clinicName.trim(),
        districts,
        areas,
        mtrNearby,
        languages,
        specialties,
        modalities,
        acceptsAgeBands: ageBands,
        acceptsPregnancyRelated: acceptsPregnancy,
        acceptsChildren: acceptsChildren,
        availabilityNext: nextAvailable,
        availabilityEvenings: evenings,
        availabilityWeekends: weekends,
        acceptingNewPatients: acceptingNew,
        experienceYears: Number(experience),
        priceRange,
        bio: bio.trim(),
      }

      const sitePassword = sessionStorage.getItem('cmatch-pwd') || ''
      const res = await fetch('/api/practitioner-signup', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-site-password': sitePassword,
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message || `Submission failed (${res.status})`)
      }

      setSubmitted(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Submission failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }, [step, validateStep, fullName, title, gender, email, phone, clinicName, districts, areas, mtrNearby, languages, specialties, modalities, ageBands, acceptsPregnancy, acceptsChildren, nextAvailable, evenings, weekends, acceptingNew, experience, priceRange, bio])

  if (submitted) {
    return (
      <section className="ps-page">
        <div className="ps-card ps-success">
          <h2>Application submitted</h2>
          <p>Thank you for your interest in joining CMatch. We have received your application and will review it shortly.</p>
          <p className="ps-success-note">Our team will contact you at <strong>{email}</strong> within 3–5 business days.</p>
        </div>
      </section>
    )
  }

  return (
    <section className="ps-page">
      <div className="ps-hero">
        <h1>Join CMatch as a Practitioner</h1>
        <p>Tell us about your practice so we can match you with the right patients.</p>
      </div>

      <div className="ps-card">
        <div className="ps-stepper">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className={`ps-step ${s === step ? 'active' : ''} ${s < step ? 'done' : ''}`}>
              <span className="ps-step-num">{s < step ? '✓' : s}</span>
              <span className="ps-step-label">
                {s === 1 && 'Profile'}
                {s === 2 && 'Clinic'}
                {s === 3 && 'Clinical'}
                {s === 4 && 'Availability'}
              </span>
            </div>
          ))}
        </div>

        {error && <div className="ps-error">{error}</div>}

        {step === 1 && (
          <div className="ps-step-body">
            <Section title="Personal Information">
              <TextInput label="Full name" value={fullName} onChange={setFullName} placeholder="Dr. Chan Tai Man" required />
              <TextInput label="Professional title" value={title} onChange={setTitle} placeholder="Registered Chinese Medicine Practitioner" required />
              <CustomDropdown
                label="Gender"
                value={gender}
                onChange={(v) => setGender(v as 'female' | 'male')}
                options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]}
                required
              />
            </Section>
            <Section title="Contact">
              <TextInput label="Email" value={email} onChange={setEmail} placeholder="dr.chan@clinic.hk" type="email" required />
              <TextInput label="Phone" value={phone} onChange={setPhone} placeholder="+852 9123 4567" type="tel" required />
            </Section>
          </div>
        )}

        {step === 2 && (
          <div className="ps-step-body">
            <Section title="Clinic Information">
              <TextInput label="Clinic name" value={clinicName} onChange={setClinicName} placeholder="Harmony TCM Clinic" required />
              <CustomMultiDropdown
                label="Districts served"
                values={districts}
                options={districtOptions}
                onChange={setDistricts}
                placeholder="Select districts…"
              />
              <CustomMultiDropdown
                label="Areas / neighbourhoods"
                values={areas}
                options={areaOptions}
                onChange={setAreas}
                placeholder="Select areas…"
              />
              <CustomMultiDropdown
                label="Nearby MTR stations"
                values={mtrNearby}
                options={mtrOptions}
                onChange={setMtrNearby}
                placeholder="Select MTR stations…"
              />
            </Section>
            <Section title="Languages">
              <CheckboxGroup
                label="Languages spoken"
                values={languages}
                options={languageOptions}
                onChange={setLanguages}
              />
            </Section>
          </div>
        )}

        {step === 3 && (
          <div className="ps-step-body">
            <Section title="Specialties & Modalities">
              <CustomMultiDropdown
                label="Specialties"
                values={specialties}
                options={specialtyOptions}
                onChange={setSpecialties}
                placeholder="Select specialties…"
              />
              <CustomMultiDropdown
                label="Treatment modalities offered"
                values={modalities}
                options={modalityOptions}
                onChange={setModalities}
                placeholder="Select modalities…"
              />
            </Section>
            <Section title="Patient Acceptance">
              <CheckboxGroup
                label="Age groups accepted"
                values={ageBands}
                options={ageBandOptions}
                onChange={setAgeBands}
              />
              <div className="ps-toggle-row">
                <Toggle label="Accepts pregnancy-related cases" checked={acceptsPregnancy} onChange={setAcceptsPregnancy} />
                <Toggle label="Accepts children" checked={acceptsChildren} onChange={setAcceptsChildren} />
              </div>
            </Section>
          </div>
        )}

        {step === 4 && (
          <div className="ps-step-body">
            <Section title="Availability">
              <CustomDropdown
                label="Next available appointment"
                value={nextAvailable}
                onChange={setNextAvailable}
                options={[
                  { value: 'Same day', label: 'Same day' },
                  { value: '1-3 days', label: '1–3 days' },
                  { value: '3-7 days', label: '3–7 days' },
                  { value: '1-2 weeks', label: '1–2 weeks' },
                  { value: '2-3 weeks', label: '2–3 weeks' },
                ]}
              />
              <div className="ps-toggle-row">
                <Toggle label="Evening appointments available" checked={evenings} onChange={setEvenings} />
                <Toggle label="Weekend appointments available" checked={weekends} onChange={setWeekends} />
                <Toggle label="Currently accepting new patients" checked={acceptingNew} onChange={setAcceptingNew} />
              </div>
            </Section>
            <Section title="Experience & Pricing">
              <TextInput label="Years of experience" value={experience} onChange={setExperience} placeholder="10" type="number" required />
              <CustomDropdown
                label="Price range"
                value={priceRange}
                onChange={(v) => setPriceRange(v as '$' | '$$' | '$$$' | '$$$$')}
                options={[
                  { value: '$', label: '$ (Budget-friendly)' },
                  { value: '$$', label: '$$ (Moderate)' },
                  { value: '$$$', label: '$$$ (Premium)' },
                  { value: '$$$$', label: '$$$$ (High-end)' },
                ]}
              />
            </Section>
            <Section title="About You">
              <TextArea
                label="Short bio"
                value={bio}
                onChange={setBio}
                placeholder="Describe your clinical focus, approach, and what patients can expect..."
                required
              />
            </Section>
          </div>
        )}

        <div className="ps-actions">
          {step > 1 && (
            <button type="button" className="ps-btn secondary" onClick={prevStep} disabled={submitting}>
              Back
            </button>
          )}
          {step < 4 ? (
            <button type="button" className="ps-btn primary" onClick={nextStep}>
              Next
            </button>
          ) : (
            <button type="button" className="ps-btn primary" onClick={submit} disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit Application'}
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
