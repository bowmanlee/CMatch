import { useState, useEffect, useRef, useCallback } from 'react'

export default function PasswordGate({ children }: { children: React.ReactNode }) {
  const storedPassword = sessionStorage.getItem('cmatch-pwd') || ''
  const wasUnlocked = storedPassword.length > 0
  const [unlocked, setUnlocked] = useState(wasUnlocked)
  const [checking, setChecking] = useState(!wasUnlocked)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (unlocked) return

    fetch('/api/verify-password', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    })
      .then((res) => {
        if (res.ok) {
          setUnlocked(true)
        }
      })
      .catch(() => {})
      .finally(() => setChecking(false))
  }, [unlocked])

  const submit = useCallback(async () => {
    setError('')
    const trimmed = password.trim()
    if (!trimmed) return
    try {
      const res = await fetch('/api/verify-password', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-site-password': trimmed,
        },
        body: JSON.stringify({ password: trimmed }),
      })
      if (res.ok) {
        sessionStorage.setItem('cmatch-auth', 'true')
        sessionStorage.setItem('cmatch-pwd', trimmed)
        setUnlocked(true)
      } else {
        setError('Incorrect password. Please try again.')
        setPassword('')
        inputRef.current?.focus()
      }
    } catch {
      setError('Network error. Please try again.')
    }
  }, [password])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') submit()
  }

  if (checking) {
    return (
      <div className="password-gate-overlay">
        <div className="password-gate-card">
          <p className="password-gate-loading">Checking access…</p>
        </div>
      </div>
    )
  }

  if (unlocked) return <>{children}</>

  return (
    <div className="password-gate-overlay">
      <div className="password-gate-card">
        <h1 className="password-gate-title">CMatch</h1>
        <p className="password-gate-subtitle">Enter the password to continue.</p>
        <div className="password-gate-input-wrap">
          <input
            ref={inputRef}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Password"
            className="password-gate-input"
            autoFocus
          />
        </div>
        {error && <p className="password-gate-error">{error}</p>}
        <button className="password-gate-btn" onClick={submit} disabled={!password.trim()}>
          Unlock
        </button>
      </div>
    </div>
  )
}
