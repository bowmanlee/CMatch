import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = resolve(__dirname, '..', 'data')
const DATA_FILE = resolve(DATA_DIR, 'practitioner-submissions.json')

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true })
  }
}

function readSubmissions() {
  ensureDataDir()
  if (!existsSync(DATA_FILE)) {
    return []
  }
  try {
    const raw = readFileSync(DATA_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeSubmissions(submissions) {
  ensureDataDir()
  writeFileSync(DATA_FILE, JSON.stringify(submissions, null, 2), 'utf8')
}

/**
 * Add a new practitioner signup submission.
 */
export function addSubmission(data) {
  const submissions = readSubmissions()
  const submission = {
    ...data,
    id: `ps-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    submittedAt: new Date().toISOString(),
    status: 'pending',
  }
  submissions.push(submission)
  writeSubmissions(submissions)
  return submission
}

/**
 * Get all submissions, newest first.
 */
export function getSubmissions() {
  const submissions = readSubmissions()
  return submissions.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
}

/**
 * In-memory fallback for serverless environments where file writes don't persist.
 * Falls back to memory if file write fails (e.g., read-only filesystem).
 */
let memoryStore = null

export function addSubmissionSafe(data) {
  try {
    return addSubmission(data)
  } catch {
    // Fallback to in-memory storage for serverless / read-only filesystems
    if (!memoryStore) memoryStore = []
    const submission = {
      ...data,
      id: `ps-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      submittedAt: new Date().toISOString(),
      status: 'pending',
    }
    memoryStore.push(submission)
    return submission
  }
}

export function getSubmissionsSafe() {
  try {
    return getSubmissions()
  } catch {
    return (memoryStore || []).sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
  }
}
