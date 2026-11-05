const crypto = require('crypto')
const { getRedisClient, isRedisConnected } = require('../config/redis')

// In-memory fallback map if Redis is not running
const memoryUsers = new Map() // email -> user

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase()
}

/**
 * Finds user by email from Redis or memory fallback.
 */
async function findUserByEmail(email) {
  const norm = normalizeEmail(email)
  if (!norm) return null

  try {
    const client = await getRedisClient()
    if (isRedisConnected()) {
      const data = await client.get(`user:${norm}`)
      if (data) {
        return JSON.parse(data)
      }
    }
  } catch (err) {
    console.warn('[userStore] Redis read error, using memory fallback:', err.message)
  }

  return memoryUsers.get(norm) || null
}

/**
 * Finds user by id.
 */
async function findUserById(id) {
  if (!id) return null

  try {
    const client = await getRedisClient()
    if (isRedisConnected()) {
      const email = await client.get(`userid:${id}`)
      if (email) {
        return findUserByEmail(email)
      }
    }
  } catch (err) {
    console.warn('[userStore] Redis id lookup error:', err.message)
  }

  for (const user of memoryUsers.values()) {
    if (user.id === id) return user
  }
  return null
}

/**
 * Creates and stores a new user.
 */
async function createUser({ name, email, passwordHash }) {
  const norm = normalizeEmail(email)
  const id = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex')
  const user = {
    id,
    name: name.trim(),
    email: norm,
    passwordHash,
    createdAt: new Date().toISOString(),
  }

  memoryUsers.set(norm, user)

  try {
    const client = await getRedisClient()
    if (isRedisConnected()) {
      await client.set(`user:${norm}`, JSON.stringify(user))
      await client.set(`userid:${id}`, norm)
    }
  } catch (err) {
    console.warn('[userStore] Redis write error, saved to memory:', err.message)
  }

  return user
}

module.exports = {
  findUserByEmail,
  findUserById,
  createUser,
  normalizeEmail,
}

