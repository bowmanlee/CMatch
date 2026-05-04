import { useMemo } from 'react'
import type { ChatMessage } from './App.tsx'

export default function DebugPage({ messages }: { messages: ChatMessage[] }) {
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
    <section className="debug-page">
      <h1>Debug</h1>
      <details open>
        <summary>Conversation ({messages.length})</summary>
        <pre>{JSON.stringify(messages, null, 2)}</pre>
      </details>
      {latestSchema && (
        <details open>
          <summary>Schema</summary>
          <pre>{JSON.stringify(latestSchema, null, 2)}</pre>
        </details>
      )}
      {latestMatches && (
        <details open>
          <summary>Matches</summary>
          <pre>{JSON.stringify(latestMatches, null, 2)}</pre>
        </details>
      )}
    </section>
  )
}
