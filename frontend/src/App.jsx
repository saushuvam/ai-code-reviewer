import { useState, useEffect, useRef } from 'react'
import "prismjs/themes/prism-tomorrow.css"
import prism from "prismjs"
import './App.css'
import './SaaS.css'

import { AuthProvider } from './context/AuthContext'
import { useAuth } from './context/useAuth'
import { useRouter } from './hooks/useRouter'
import LandingPage from './pages/LandingPage'
import SignInPage from './pages/SignInPage'
import SignUpPage from './pages/SignUpPage'

// Defensive import for CJS modules that Vite sometimes wraps in {default: ...}
import _Editor from "react-simple-code-editor"
const Editor = _Editor.default ?? _Editor

// Self-contained markdown renderer — no external package needed
function renderMarkdown(md) {
  if (!md) return ''
  return md
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
      const esc = code.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      return `<pre><code class="language-${lang || 'text'}">${esc}</code></pre>`
    })
    .replace(/`([^`\n]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    .replace(/^---$/gm, '<hr/>')
    .split('\n\n')
    .map(block => {
      const t = block.trim()
      if (!t) return ''
      if (/^<(h[1-6]|ul|ol|pre|hr|li|p)/.test(t)) return t
      return `<p>${t.replace(/\n/g, '<br/>')}</p>`
    })
    .join('\n')
}

function MarkdownView({ content }) {
  const ref = useRef(null)
  const html = renderMarkdown(content)

  useEffect(() => {
    if (ref.current) {
      ref.current.querySelectorAll('pre code').forEach(el => prism.highlightElement(el))
    }
  }, [html])

  return <div ref={ref} className="markdown-body" dangerouslySetInnerHTML={{ __html: html }} />
}

/**
 * POSTs to a streaming endpoint and invokes onChunk(text) as each piece of
 * the response arrives.
 */
async function streamReview(endpoint, body, onChunk, signal) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })

  if (!response.ok) {
    let errorMsg = `Request failed with status ${response.status}`
    try {
      const data = await response.json()
      if (data && data.error) errorMsg = data.error
    } catch {
      const text = await response.text().catch(() => '')
      if (text) errorMsg = text
    }
    throw new Error(errorMsg)
  }

  if (!response.body || !response.body.getReader) {
    const text = await response.text()
    if (text.startsWith('\n\n[Error:')) {
      throw new Error(text.replace(/^\n\n\[Error:\s*/, '').replace(/\]$/, ''))
    }
    onChunk(text)
    return
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let accumulated = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value, { stream: true })
    accumulated += chunk
    if (accumulated.includes('\n\n[Error:')) {
      const parts = accumulated.split('\n\n[Error:')
      const errText = parts[1].replace(/\]$/, '').trim()
      throw new Error(errText || 'Failed to generate review. Please try again.')
    }
    onChunk(chunk)
  }
}

/**
 * Authenticated Dashboard View (Preserves existing code review functionality)
 */
export function DashboardView({ user, onLogout, onNavigateLanding }) {
  const [mode, setMode] = useState('code') // 'code' | 'github'
  const [code, setCode] = useState(` function sum() {\n  return 1 + 1\n}`)
  const [githubUrl, setGithubUrl] = useState('')
  const [review, setReview] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const abortRef = useRef(null)

  useEffect(() => { prism.highlightAll() }, [])

  async function runReview() {
    if (mode === 'code' && !code.trim()) return
    if (mode === 'github' && !githubUrl.trim()) return

    setLoading(true)
    setError('')
    setReview('')

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const endpoint = mode === 'code' ? '/ai/get-review/stream' : '/ai/get-repo-review'
      const body = mode === 'code' ? { code } : { url: githubUrl }

      await streamReview(endpoint, body, (chunk) => {
        setReview(prev => prev + chunk)
      }, controller.signal)
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Failed to get review. Make sure the backend is running on port 3000.')
        console.error(err)
      }
    } finally {
      setLoading(false)
    }
  }

  function handleReviewClick() {
    if (loading) {
      abortRef.current?.abort()
    } else {
      runReview()
    }
  }

  return (
    <div className="dashboard-wrapper">
      {/* Top Application Bar */}
      <header className="dashboard-nav">
        <div className="dashboard-brand" onClick={onNavigateLanding}>
          <div className="logo-badge">&lt;/&gt;</div>
          <span>CodeSense AI</span>
        </div>

        <div className="user-menu-area">
          {user && (
            <div className="user-pill">
              <div className="user-avatar">{user.name ? user.name.charAt(0).toUpperCase() : 'U'}</div>
              <div className="user-info">
                <span className="user-name">{user.name}</span>
                <span className="user-email">{user.email}</span>
              </div>
            </div>
          )}
          <button className="btn-logout" onClick={onLogout}>
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Review Workbench */}
      <main>
        <div className="left">
          <div className="mode-toggle">
            <button
              type="button"
              className={mode === 'code' ? 'active' : ''}
              onClick={() => setMode('code')}
            >
              Paste Code
            </button>
            <button
              type="button"
              className={mode === 'github' ? 'active' : ''}
              onClick={() => setMode('github')}
            >
              GitHub Repo / PR
            </button>
          </div>

          {mode === 'code' ? (
            <div className="code">
              <Editor
                value={code}
                onValueChange={code => setCode(code)}
                highlight={code => prism.highlight(code, prism.languages.javascript, 'javascript')}
                padding={10}
                style={{
                  fontFamily: '"Fira code", "Fira Mono", monospace',
                  fontSize: 16,
                  border: '1px solid #ddd',
                  borderRadius: '5px',
                  height: '100%',
                  width: '100%',
                }}
              />
            </div>
          ) : (
            <div className="github-input">
              <input
                type="text"
                placeholder="https://github.com/owner/repo or .../pull/123"
                value={githubUrl}
                onChange={e => setGithubUrl(e.target.value)}
              />
              <p className="hint">
                Paste a repo URL to review a sample of its source files, or a pull request URL to review the diff.
              </p>
            </div>
          )}

          <div onClick={handleReviewClick} className={`review${loading ? ' loading' : ''}`}>
            {loading ? 'Reviewing… (click to cancel)' : 'Review'}
          </div>
        </div>

        <div className="right">
          {error && <p className="error-text">{error}</p>}
          {review && <MarkdownView content={review} />}
          {!review && !loading && !error && (
            <p className="placeholder-text">Click Review to analyse your code.</p>
          )}
          {!review && loading && (
            <p className="placeholder-text">Waiting for the model to respond…</p>
          )}
        </div>
      </main>
    </div>
  )
}

function MainApp() {
  const { path, navigate } = useRouter()
  const { user, loading, logout } = useAuth()

  // Handle protected and redirection routing rules
  useEffect(() => {
    if (loading) return

    // If user is authenticated and visits signin or signup, send them to dashboard
    if (user && (path === '/signin' || path === '/signup')) {
      navigate('/dashboard')
    }

    // If visitor is unauthenticated and attempts to access dashboard, redirect to signin
    if (!user && (path === '/dashboard' || path === '/app')) {
      navigate('/signin')
    }
  }, [user, loading, path, navigate])

  if (loading) {
    return (
      <div className="auth-page">
        <div style={{ color: '#94a3b8', fontSize: '1rem', fontFamily: 'monospace' }}>
          Loading CodeSense AI…
        </div>
      </div>
    )
  }

  // Route matching
  if (path === '/signin') {
    return <SignInPage navigate={navigate} />
  }

  if (path === '/signup') {
    return <SignUpPage navigate={navigate} />
  }

  if (path === '/dashboard' || path === '/app') {
    if (!user) {
      return <SignInPage navigate={navigate} />
    }
    return (
      <DashboardView
        user={user}
        onLogout={async () => {
          await logout()
          navigate('/')
        }}
        onNavigateLanding={() => navigate('/')}
      />
    )
  }

  // Default: Public Landing Page ('/' or unknown routes)
  return <LandingPage navigate={navigate} user={user} />
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  )
}
