const {
  hashPassword,
  verifyPassword,
  signToken,
  JWT_EXPIRATION_SECONDS,
} = require('../services/auth.service')
const {
  findUserByEmail,
  createUser,
  normalizeEmail,
} = require('../services/userStore.service')

function setAuthCookie(res, token) {
  const isProd = process.env.NODE_ENV === 'production'
  const cookieOptions = [
    `token=${token}`,
    'HttpOnly',
    'Path=/',
    `Max-Age=${JWT_EXPIRATION_SECONDS}`,
    'SameSite=Lax',
  ]
  if (isProd) {
    cookieOptions.push('Secure')
  }
  res.setHeader('Set-Cookie', cookieOptions.join('; '))
}

function clearAuthCookie(res) {
  res.setHeader(
    'Set-Cookie',
    'token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax'
  )
}

/**
 * POST /api/auth/signup
 */
module.exports.signup = async (req, res) => {
  const { name, email, password, confirmPassword } = req.body || {}

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Full Name is required' })
  }

  if (!email || !email.trim()) {
    return res.status(400).json({ error: 'Email Address is required' })
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email.trim())) {
    return res.status(400).json({ error: 'Please enter a valid email address' })
  }

  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long' })
  }

  if (confirmPassword !== undefined && password !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match' })
  }

  const normalized = normalizeEmail(email)

  try {
    const existing = await findUserByEmail(normalized)
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' })
    }

    const passwordHash = await hashPassword(password)
    const newUser = await createUser({
      name: name.trim(),
      email: normalized,
      passwordHash,
    })

    const token = signToken({ id: newUser.id, email: newUser.email })
    setAuthCookie(res, token)

    return res.status(201).json({
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        createdAt: newUser.createdAt,
      },
      token,
    })
  } catch (err) {
    console.error('[authController.signup]', err.message)
    return res.status(500).json({ error: 'Internal server error during registration' })
  }
}

/**
 * POST /api/auth/signin
 */
module.exports.signin = async (req, res) => {
  const { email, password } = req.body || {}

  if (!email || !email.trim()) {
    return res.status(400).json({ error: 'Email is required' })
  }
  if (!password) {
    return res.status(400).json({ error: 'Password is required' })
  }

  const normalized = normalizeEmail(email)

  try {
    const user = await findUserByEmail(normalized)
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    const valid = await verifyPassword(password, user.passwordHash)
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    const token = signToken({ id: user.id, email: user.email })
    setAuthCookie(res, token)

    return res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
      },
      token,
    })
  } catch (err) {
    console.error('[authController.signin]', err.message)
    return res.status(500).json({ error: 'Internal server error during sign in' })
  }
}

/**
 * POST /api/auth/logout
 */
module.exports.logout = async (req, res) => {
  clearAuthCookie(res)
  return res.json({ message: 'Logged out successfully' })
}

/**
 * GET /api/auth/me
 */
module.exports.me = async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' })
  }
  return res.json({ user: req.user })
}

