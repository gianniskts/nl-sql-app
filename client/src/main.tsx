import React from 'react'
import { createRoot } from 'react-dom/client'

function App() {
  const [prompt, setPrompt] = React.useState('How many contacts do I have in my database?')
  const [resp, setResp] = React.useState<any>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResp(null)
    try {
      const r = await fetch(import.meta.env.VITE_API_URL || 'http://localhost:3001/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })
      const json = await r.json()
      if (!r.ok) throw new Error(json.error || 'Request failed')
      setResp(json)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <h1>Natural Language → SQL</h1>
      <form onSubmit={onSubmit}>
        <textarea
          rows={5}
          style={{ width: '100%', fontFamily: 'monospace' }}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
        <div style={{ marginTop: 8 }}>
          <button type="submit" disabled={loading}>
            {loading ? 'Running…' : 'Submit'}
          </button>
        </div>
      </form>
      {error && <pre style={{ color: 'red' }}>{error}</pre>}
      {resp && (
        <div style={{ marginTop: 16 }}>
          <h3>SQL</h3>
          <pre>{resp.sql}</pre>
          <h3>Summary</h3>
          <pre>{resp.summary ?? '(none)'}</pre>
          <h3>Rows</h3>
          <pre>{JSON.stringify(resp.rows, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
