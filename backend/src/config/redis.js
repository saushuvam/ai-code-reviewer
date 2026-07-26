const { createClient } = require('redis')

let client = null
let connected = false
let connectingPromise = null

/**
 * Lazily creates (or returns) a singleton Redis client.
 * If Redis is unreachable, we log a warning and keep the app running
 * without caching instead of crashing the whole service.
 */
async function getRedisClient() {
  if (client) return client
  if (connectingPromise) return connectingPromise

  client = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: { reconnectStrategy: false },
})

  client.on('error', (err) => {
    connected = false
    console.warn('[redis] connection error:', err.message)
  })

  client.on('connect', () => {
    connected = true
  })

  client.on('end', () => {
    connected = false
  })

  connectingPromise = client
    .connect()
    .then(() => {
      connected = true
      console.log('[redis] connected')
      return client
    })
    .catch((err) => {
      connected = false
      console.warn('[redis] unavailable, caching disabled:', err.message)
      return client
    })

  return connectingPromise
}

function isRedisConnected() {
  return connected
}

async function closeRedisClient() {
  if (client && connected) {
    await client.quit()
  }
  client = null
  connected = false
  connectingPromise = null
}

module.exports = { getRedisClient, isRedisConnected, closeRedisClient }
