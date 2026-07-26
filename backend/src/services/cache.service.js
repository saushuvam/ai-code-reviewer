const crypto = require('crypto')
const { getRedisClient, isRedisConnected } = require('../config/redis')

const DEFAULT_TTL_SECONDS = 60 * 60 * 24 // 24 hours

function buildCacheKey(input) {
  const hash = crypto.createHash('sha256').update(input).digest('hex')
  return `review:${hash}`
}

/**
 * Returns the cached review text for a given input (code or a repo/PR URL),
 * or null on a cache miss / if Redis is unavailable.
 */
async function getCachedReview(input) {
  try {
    const client = await getRedisClient()
    if (!isRedisConnected()) return null
    const value = await client.get(buildCacheKey(input))
    return value ?? null
  } catch (err) {
    console.warn('[cache] read failed:', err.message)
    return null
  }
}

/**
 * Stores a review under a hash of its input. Silently no-ops if Redis
 * is unavailable — caching is an optimization, not a hard dependency.
 */
async function setCachedReview(input, reviewText, ttlSeconds = DEFAULT_TTL_SECONDS) {
  try {
    const client = await getRedisClient()
    if (!isRedisConnected()) return
    await client.set(buildCacheKey(input), reviewText, { EX: ttlSeconds })
  } catch (err) {
    console.warn('[cache] write failed:', err.message)
  }
}

module.exports = { getCachedReview, setCachedReview, buildCacheKey, DEFAULT_TTL_SECONDS }
