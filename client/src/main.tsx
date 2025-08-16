import React from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

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
    <div className="app">
      <h1>Natural Language → SQL</h1>
      <form onSubmit={onSubmit}>
        <textarea
          className="prompt"
          rows={5}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
        <div className="actions">
          <button className="btn" type="submit" disabled={loading}>
            {loading ? 'Running…' : 'Submit'}
          </button>
        </div>
      </form>
      {error && <pre className="code error">{error}</pre>}
      {resp && (
        <div className="results">
          <h3 className="section-title">SQL</h3>
          <pre className="code">{resp.sql}</pre>
          <h3 className="section-title">Summary</h3>
          <pre className="code">{resp.summary ?? '(none)'}</pre>
          <h3 className="section-title">Rows</h3>
          <pre className="code">{JSON.stringify(resp.rows, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
