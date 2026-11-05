import { useState } from 'react'
import { useAuth } from '../context/useAuth'

export default function SignInPage({ navigate }) {
  const { signin } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email.trim() || !password) {
      setError('Please fill in all fields.')
      return
    }

    setLoading(true)
    setError('')

    try {
      await signin(email.trim(), password)
      navigate('/dashboard')
    } catch (err) {
      setError(err.message || 'Invalid email or password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="landing-bg-glow" style={{ top: '-250px' }} />

      <div className="auth-card">
        <div className="auth-header">
          <div className="brand-logo" onClick={() => navigate('/')}>
            <div className="logo-badge">&lt;/&gt;</div>
            <span className="brand-name">CodeSense AI</span>
          </div>
          <h1>Welcome Back</h1>
          <p>Sign in to access your AI-powered code reviewer</p>
        </div>

        {error && <div className="auth-error-banner">{error}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="signin-email">Email Address</label>
            <input
              id="signin-email"
              type="email"
              className="form-input"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="signin-password">Password</label>
            <div className="input-wrapper">
              <input
                id="signin-password"
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="btn-toggle-pw"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn-primary btn-submit"
            disabled={loading}
          >
            {loading ? 'Signing In…' : 'Sign In'}
          </button>
        </form>

        <div className="auth-footer">
          Don't have an account?{' '}
          <span className="auth-link" onClick={() => navigate('/signup')}>
            Create one free
          </span>
        </div>
      </div>
    </div>
  )
}
