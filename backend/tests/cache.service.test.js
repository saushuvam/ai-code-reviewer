jest.mock('../src/config/redis')

const { getRedisClient, isRedisConnected } = require('../src/config/redis')
const { getCachedReview, setCachedReview, buildCacheKey } = require('../src/services/cache.service')

describe('cache.service', () => {
  let mockClient

  beforeEach(() => {
    mockClient = { get: jest.fn(), set: jest.fn() }
    getRedisClient.mockResolvedValue(mockClient)
    isRedisConnected.mockReturnValue(true)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('buildCacheKey', () => {
    it('is deterministic for the same input', () => {
      expect(buildCacheKey('const x = 1')).toBe(buildCacheKey('const x = 1'))
    })

    it('differs for different input', () => {
      expect(buildCacheKey('const x = 1')).not.toBe(buildCacheKey('const x = 2'))
    })

    it('is namespaced under "review:"', () => {
      expect(buildCacheKey('anything')).toMatch(/^review:[a-f0-9]{64}$/)
    })
  })

  describe('getCachedReview', () => {
    it('returns the cached value on a hit', async () => {
      mockClient.get.mockResolvedValue('cached review text')
      const result = await getCachedReview('some code')
      expect(result).toBe('cached review text')
      expect(mockClient.get).toHaveBeenCalledWith(buildCacheKey('some code'))
    })

    it('returns null on a miss', async () => {
      mockClient.get.mockResolvedValue(null)
      const result = await getCachedReview('some code')
      expect(result).toBeNull()
    })

    it('returns null (not throws) when Redis is disconnected', async () => {
      isRedisConnected.mockReturnValue(false)
      const result = await getCachedReview('some code')
      expect(result).toBeNull()
      expect(mockClient.get).not.toHaveBeenCalled()
    })

    it('returns null (not throws) when the client errors', async () => {
      mockClient.get.mockRejectedValue(new Error('boom'))
      const result = await getCachedReview('some code')
      expect(result).toBeNull()
    })
  })

  describe('setCachedReview', () => {
    it('writes with a TTL', async () => {
      await setCachedReview('some code', 'the review', 3600)
      expect(mockClient.set).toHaveBeenCalledWith(buildCacheKey('some code'), 'the review', { EX: 3600 })
    })

    it('no-ops when Redis is disconnected', async () => {
      isRedisConnected.mockReturnValue(false)
      await setCachedReview('some code', 'the review')
      expect(mockClient.set).not.toHaveBeenCalled()
    })

    it('does not throw when the client errors', async () => {
      mockClient.set.mockRejectedValue(new Error('boom'))
      await expect(setCachedReview('some code', 'the review')).resolves.not.toThrow()
    })
  })
})
