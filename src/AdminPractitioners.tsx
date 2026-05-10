import { useState, useEffect, useCallback } from 'react'
import type { PractitionerSignup } from '../shared/practitioner-signup.ts'

type Submission = PractitionerSignup & { id: string; submittedAt: string }

const districtLabels: Record<string, string> = {
  central_and_western: 'Central & Western', wan_chai: 'Wan Chai', eastern: 'Eastern', southern: 'Southern',
  yau_tsim_mong: 'Yau Tsim Mong', sham_shui_po: 'Sham Shui Po', kowloon_city: 'Kowloon City',
  wong_tai_sin: 'Wong Tai Sin', kwun_tong: 'Kwun Tong', kwai_tsing: 'Kwai Tsing',
  tsuen_wan: 'Tsuen Wan', tuen_mun: 'Tuen Mun', yuen_long: 'Yuen Long', north: 'North',
  tai_po: 'Tai Po', sha_tin: 'Sha Tin', sai_kung: 'Sai Kung', islands: 'Islands',
  remote_or_no_preference: 'Remote / No preference',
}

const languageLabels: Record<string, string> = {
  cantonese: 'Cantonese', english: 'English', mandarin: 'Mandarin',
}

const specialtyLabels: Record<string, string> = {
  internal_medicine: 'Internal Medicine', surgery: 'Surgery',
  obstetrics_gynecology: 'Obstetrics & Gynecology', pediatrics: 'Pediatrics',
  dermatology: 'Dermatology', ophthalmology: 'Ophthalmology',
  otorhinolaryngology: 'ENT', stomatology: 'Stomatology',
  oncology: 'Oncology', orthopedics_traumatology: 'Orthopedics & Traumatology',
  proctology: 'Proctology', geriatrics: 'Geriatrics',
  acupuncture: 'Acupuncture', tuina: 'Tuina',
  emergency_medicine: 'Emergency Medicine', rehabilitation_medicine: 'Rehabilitation Medicine',
  preventive_healthcare: 'Preventive Healthcare',
}

const modalityLabels: Record<string, string> = {
  herbal_medicine: 'Herbal Medicine', acupuncture: 'Acupuncture',
  tuina: 'Tui Na', bonesetting: 'Bonesetting', cupping: 'Cupping',
  moxibustion: 'Moxibustion', diet_lifestyle_guidance: 'Diet & Lifestyle',
  integrative_referral: 'Integrative Support',
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-HK', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function AdminPractitioners() {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [password, setPassword] = useState(() => sessionStorage.getItem('cmatch-admin-pwd') || '')
  const [authenticated, setAuthenticated] = useState(false)
  const [loadKey, setLoadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!password) {
        if (!cancelled) setLoading(false)
        return
      }
      try {
        const res = await fetch('/api/admin/practitioner-submissions', {
          headers: { 'x-admin-password': password },
        })
        if (cancelled) return
        if (res.status === 401 || res.status === 403) {
          setError('Invalid admin password.')
          setAuthenticated(false)
          setLoading(false)
          return
        }
        if (!res.ok) throw new Error(`Failed to load (${res.status})`)
        const data = await res.json()
        setSubmissions(data.submissions || [])
        setAuthenticated(true)
        setError('')
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load submissions.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [password, loadKey])

  const login = useCallback(async () => {
    setLoading(true)
    setError('')
    sessionStorage.setItem('cmatch-admin-pwd', password)
    setLoadKey((k) => k + 1)
  }, [password])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') login()
  }

  if (!authenticated) {
    return (
      <section className="admin-page">
        <div className="ps-card" style={{ maxWidth: 400, margin: '0 auto' }}>
          <h2 style={{ color: 'var(--cm-green-900)', marginBottom: 8 }}>Admin Access</h2>
          <p style={{ color: 'var(--cm-ink-muted)', fontSize: 14, marginBottom: 16 }}>Enter the admin password to view practitioner applications.</p>
          <div className="ps-field">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Admin password"
              className="ps-input"
              autoFocus
            />
          </div>
          {error && <div className="ps-error">{error}</div>}
          <button className="ps-btn primary" onClick={login} disabled={loading || !password.trim()}>
            {loading ? 'Checking…' : 'Access'}
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="admin-page">
      <div className="admin-header">
        <h1>Practitioner Applications</h1>
        <span className="admin-count">{submissions.length} submission{submissions.length !== 1 ? 's' : ''}</span>
      </div>

      {loading ? (
        <p className="admin-loading">Loading…</p>
      ) : error ? (
        <div className="ps-error">{error}</div>
      ) : submissions.length === 0 ? (
        <div className="ps-card">
          <p style={{ color: 'var(--cm-ink-muted)' }}>No applications yet.</p>
        </div>
      ) : (
        <div className="admin-list">
          {submissions.map((s) => (
            <details
              key={s.id}
              className="admin-item"
              open={expanded === s.id}
              onToggle={(e) => {
                const target = e.target as HTMLDetailsElement
                setExpanded(target.open ? s.id : null)
              }}
            >
              <summary className="admin-summary">
                <div className="admin-summary-main">
                  <strong>{s.fullName}</strong>
                  <span className="admin-summary-clinic">{s.clinicName}</span>
                </div>
                <div className="admin-summary-meta">
                  <span className={`admin-badge ${s.status}`}>{s.status}</span>
                  <span className="admin-date">{formatDate(s.submittedAt)}</span>
                </div>
              </summary>

              <div className="admin-detail">
                <div className="admin-detail-grid">
                  <div className="admin-detail-col">
                    <h4>Contact</h4>
                    <p><strong>Email:</strong> {s.email}</p>
                    <p><strong>Phone:</strong> {s.phone}</p>
                  </div>
                  <div className="admin-detail-col">
                    <h4>Clinic</h4>
                    <p><strong>Districts:</strong> {s.districts.map((d) => districtLabels[d] || d).join(', ')}</p>
                    <p><strong>Areas:</strong> {s.areas.join(', ')}</p>
                    <p><strong>MTR:</strong> {s.mtrNearby.join(', ') || '—'}</p>
                  </div>
                  <div className="admin-detail-col">
                    <h4>Languages</h4>
                    <p>{s.languages.map((l) => languageLabels[l] || l).join(', ') || '—'}</p>
                  </div>
                  <div className="admin-detail-col">
                    <h4>Specialties</h4>
                    <div className="admin-tags">
                      {s.specialties.map((sp) => (
                        <span key={sp} className="admin-tag">{specialtyLabels[sp] || sp}</span>
                      ))}
                    </div>
                  </div>
                  <div className="admin-detail-col">
                    <h4>Modalities</h4>
                    <div className="admin-tags">
                      {s.modalities.map((m) => (
                        <span key={m} className="admin-tag">{modalityLabels[m] || m}</span>
                      ))}
                    </div>
                  </div>
                  <div className="admin-detail-col">
                    <h4>Patient Acceptance</h4>
                    <p><strong>Age bands:</strong> {s.acceptsAgeBands.join(', ')}</p>
                    <p><strong>Pregnancy:</strong> {s.acceptsPregnancyRelated ? 'Yes' : 'No'}</p>
                    <p><strong>Children:</strong> {s.acceptsChildren ? 'Yes' : 'No'}</p>
                  </div>
                  <div className="admin-detail-col">
                    <h4>Availability</h4>
                    <p><strong>Next available:</strong> {s.availabilityNext}</p>
                    <p><strong>Evenings:</strong> {s.availabilityEvenings ? 'Yes' : 'No'}</p>
                    <p><strong>Weekends:</strong> {s.availabilityWeekends ? 'Yes' : 'No'}</p>
                    <p><strong>New patients:</strong> {s.acceptingNewPatients ? 'Yes' : 'No'}</p>
                  </div>
                  <div className="admin-detail-col">
                    <h4>Profile</h4>
                    <p><strong>Experience:</strong> {s.experienceYears} years</p>
                    <p><strong>Price range:</strong> {s.priceRange}</p>
                  </div>
                  <div className="admin-detail-col full">
                    <h4>Bio</h4>
                    <p className="admin-bio">{s.bio}</p>
                  </div>
                </div>
              </div>
            </details>
          ))}
        </div>
      )}
    </section>
  )
}
