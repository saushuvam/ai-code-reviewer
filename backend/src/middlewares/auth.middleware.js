const { verifyToken, parseCookies } = require('../services/auth.service')
const { findUserById } = require('../services/userStore.service')

/**
 * Authentication middleware for protected endpoints.
 * Checks HTTP-only cookie 'token' or Authorization: Bearer <token>.
 */
async function requireAuth(req, res, next) {
  try {
    let token = null

    // 1. Check HTTP-only cookie
    const cookies = parseCookies(req.headers.cookie)
    if (cookies.token) {
      token = cookies.token
    }

    // 2. Check Authorization header
    if (!token && req.headers.authorization) {
      const parts = req.headers.authorization.split(' ')
      if (parts.length === 2 && /^Bearer$/i.test(parts[0])) {
        token = parts[1]
      }
    }

    if (!token) {
      return res.status(401).json({ error: 'Authentication required. Please sign in.' })
    }

    const payload = verifyToken(token)
    if (!payload || !payload.id) {
      return res.status(401).json({ error: 'Invalid or expired session. Please sign in again.' })
    }

    const user = await findUserById(payload.id)
    if (!user) {
      return res.status(401).json({ error: 'User account not found. Please sign in again.' })
    }

    // Attach user to req (excluding passwordHash)
    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    }

    next()
  } catch (err) {
    console.error('[requireAuth]', err.message)
    res.status(401).json({ error: 'Authentication failed.' })
  }
}

module.exports = { requireAuth }

