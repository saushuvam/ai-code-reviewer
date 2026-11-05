const crypto = require('crypto')

const DEFAULT_JWT_SECRET = 'ai-code-reviewer-jwt-default-development-secret-key-32chars!'
const JWT_EXPIRATION_SECONDS = 7 * 24 * 60 * 60 // 7 days

function getJwtSecret() {
  return process.env.JWT_SECRET || DEFAULT_JWT_SECRET
}

/**
 * Hashes a plaintext password using node:crypto scrypt with random salt.
 * Returns salt:derivedKeyHex
 */
function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex')
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) return reject(err)
      resolve(`${salt}:${derivedKey.toString('hex')}`)
    })
  })
}

/**
 * Timing-safe password verification against salt:derivedKeyHex
 */
function verifyPassword(password, storedHash) {
  return new Promise((resolve) => {
    if (!storedHash || typeof storedHash !== 'string' || !storedHash.includes(':')) {
      return resolve(false)
    }
    const [salt, key] = storedHash.split(':')
    if (!salt || !key) return resolve(false)

    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) return resolve(false)
      const expectedKey = Buffer.from(key, 'hex')
      if (expectedKey.length !== derivedKey.length) return resolve(false)
      resolve(crypto.timingSafeEqual(expectedKey, derivedKey))
    })
  })
}

/**
 * Creates a signed HS256 JWT
 */
function signToken(payload, expiresInSeconds = JWT_EXPIRATION_SECONDS) {
  const secret = getJwtSecret()
  const header = { alg: 'HS256', typ: 'JWT' }
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds
  const fullPayload = { ...payload, exp }

  const b64Header = Buffer.from(JSON.stringify(header)).toString('base64url')
  const b64Payload = Buffer.from(JSON.stringify(fullPayload)).toString('base64url')
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${b64Header}.${b64Payload}`)
    .digest('base64url')

  return `${b64Header}.${b64Payload}.${signature}`
}

/**
 * Verifies a HS256 JWT, checking signature and expiration.
 * Returns decoded payload or null.
 */
function verifyToken(token) {
  if (!token || typeof token !== 'string') return null
  const parts = token.split('.')
  if (parts.length !== 3) return null

  const [b64Header, b64Payload, sig] = parts
  const secret = getJwtSecret()
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(`${b64Header}.${b64Payload}`)
    .digest('base64url')

  if (sig !== expectedSig) return null

  try {
    const payload = JSON.parse(Buffer.from(b64Payload, 'base64url').toString('utf8'))
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
      return null // Expired
    }
    return payload
  } catch {
    return null
  }
}

/**
 * Parses cookies from Cookie request header string.
 */
function parseCookies(cookieHeader) {
  const cookies = {}
  if (!cookieHeader || typeof cookieHeader !== 'string') return cookies
  const pairs = cookieHeader.split(';')
  for (const pair of pairs) {
    const idx = pair.indexOf('=')
    if (idx === -1) continue
    const key = pair.slice(0, idx).trim()
    const val = pair.slice(idx + 1).trim()
    try {
      cookies[key] = decodeURIComponent(val)
    } catch {
      cookies[key] = val
    }
  }
  return cookies
}

module.exports = {
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
  parseCookies,
  JWT_EXPIRATION_SECONDS,
}

