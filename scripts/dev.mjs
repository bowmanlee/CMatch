import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
for (const envPath of [resolve(root, '.env'), resolve(root, '.env.local')]) {
  if (existsSync(envPath)) {
    const lines = readFileSync(envPath, 'utf8').split(/\r?\n/)
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const separatorIndex = trimmed.indexOf('=')
      if (separatorIndex === -1) continue
      const key = trimmed.slice(0, separatorIndex).trim()
      const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, '')
      if (key) process.env[key] = value
    }
  }
}

const children = [
  spawn(process.execPath, ['server/deepseek-proxy.mjs'], {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
  }),
  spawn('npm', ['run', 'dev:client', '--', '--host', '127.0.0.1'], {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
  }),
]

function shutdown(signal) {
  for (const child of children) {
    if (!child.killed) child.kill(signal)
  }
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

for (const child of children) {
  child.on('exit', (code, signal) => {
    if (code && code !== 0) {
      shutdown('SIGTERM')
      process.exitCode = code
    }
    if (signal) shutdown(signal)
  })
}
