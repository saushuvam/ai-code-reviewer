import { useState } from 'react'
import { useAuth } from '../context/useAuth'

export default function SignUpPage({ navigate }) {
  const { signup } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function getStrength(pw) {
    if (!pw) return 0
    let s = 0
    if (pw.length >= 8) s++
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++
    if (/\d/.test(pw)) s++
    if (/[^A-Za-z0-9]/.test(pw)) s++
    return s
  }

  const strength = getStrength(password)
  const strengthLabels = ['Too short', 'Weak', 'Fair', 'Good', 'Strong']

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim() || !email.trim() || !password) {
      setError('Please fill in all required fields.')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    setError('')

    try {
      await signup(name.trim(), email.trim(), password, confirmPassword)
      navigate('/dashboard')
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.')
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
          <h1>Create an Account</h1>
          <p>Start reviewing code with senior AI engineering feedback</p>
        </div>

        {error && <div className="auth-error-banner">{error}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="signup-name">Full Name</label>
            <input
              id="signup-name"
              type="text"
              className="form-input"
              placeholder="Alex Smith"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="signup-email">Work Email</label>
            <input
              id="signup-email"
              type="email"
              className="form-input"
              placeholder="alex@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="signup-password">Password (min 8 characters)</label>
            <div className="input-wrapper">
              <input
                id="signup-password"
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
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

            {password && (
              <>
                <div className="strength-meter">
                  <div className={`strength-bar ${strength >= 1 ? (strength <= 2 ? 'weak' : strength === 3 ? 'medium' : 'strong') : ''}`} />
                  <div className={`strength-bar ${strength >= 2 ? (strength === 2 ? 'weak' : strength === 3 ? 'medium' : 'strong') : ''}`} />
                  <div className={`strength-bar ${strength >= 3 ? (strength === 3 ? 'medium' : 'strong') : ''}`} />
                  <div className={`strength-bar ${strength >= 4 ? 'strong' : ''}`} />
                </div>
                <div className="strength-text">
                  Strength: {strengthLabels[strength]}
                </div>
              </>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="signup-confirm">Confirm Password</label>
            <input
              id="signup-confirm"
              type={showPassword ? 'text' : 'password'}
              className="form-input"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>

          <button
            type="submit"
            className="btn-primary btn-submit"
            disabled={loading}
          >
            {loading ? 'Creating Account…' : 'Sign Up Free'}
          </button>
        </form>

        <div className="auth-footer">
          Already have an account?{' '}
          <span className="auth-link" onClick={() => navigate('/signin')}>
            Sign In
          </span>
        </div>
      </div>
    </div>
  )
}
