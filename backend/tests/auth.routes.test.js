const request = require('supertest')
const app = require('../src/app')
const { closeRedisClient, getRedisClient, isRedisConnected } = require('../src/config/redis')

describe('Auth Endpoints & Protection', () => {
  const uniqueEmail = `test_${Date.now()}@example.com`
  const testUser = {
    name: 'Ada Lovelace',
    email: uniqueEmail,
    password: 'password123',
    confirmPassword: 'password123',
  }

  afterAll(async () => {
    try {
      const client = await getRedisClient()
      if (isRedisConnected()) {
        await client.del(`user:${uniqueEmail}`)
      }
    } catch {}
    await closeRedisClient()
  })

  describe('POST /api/auth/signup', () => {
    it('creates a new user and returns 201 with auth cookie', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send(testUser)

      expect(res.status).toBe(201)
      expect(res.body.user).toBeDefined()
      expect(res.body.user.email).toBe(uniqueEmail)
      expect(res.body.user.name).toBe('Ada Lovelace')
      expect(res.headers['set-cookie']).toBeDefined()
    })

    it('rejects duplicate email with 409', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send(testUser)

      expect(res.status).toBe(409)
      expect(res.body.error).toMatch(/already exists/i)
    })

    it('rejects invalid email with 400', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ ...testUser, email: 'not-an-email' })

      expect(res.status).toBe(400)
    })

    it('rejects mismatched passwords with 400', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ ...testUser, email: 'new@example.com', confirmPassword: 'different' })

      expect(res.status).toBe(400)
    })
  })

  describe('POST /api/auth/signin', () => {
    it('authenticates valid user and sets cookie', async () => {
      const res = await request(app)
        .post('/api/auth/signin')
        .send({ email: uniqueEmail, password: 'password123' })

      expect(res.status).toBe(200)
      expect(res.body.user.email).toBe(uniqueEmail)
      expect(res.headers['set-cookie']).toBeDefined()
    })

    it('rejects incorrect password with 401', async () => {
      const res = await request(app)
        .post('/api/auth/signin')
        .send({ email: uniqueEmail, password: 'wrongpassword' })

      expect(res.status).toBe(401)
    })
  })

  describe('GET /api/auth/me', () => {
    it('rejects unauthenticated request with 401', async () => {
      const res = await request(app).get('/api/auth/me')
      expect(res.status).toBe(401)
    })

    it('returns user profile when valid token provided in cookie', async () => {
      const loginRes = await request(app)
        .post('/api/auth/signin')
        .send({ email: uniqueEmail, password: 'password123' })

      const cookie = loginRes.headers['set-cookie']
      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Cookie', cookie)

      expect(meRes.status).toBe(200)
      expect(meRes.body.user.email).toBe(uniqueEmail)
    })
  })

  describe('Protected AI Routes', () => {
    it('rejects unauthenticated call to /ai/get-review with 401', async () => {
      const res = await request(app)
        .post('/ai/get-review')
        .send({ code: 'const a = 1' })

      expect(res.status).toBe(401)
      expect(res.body.error).toMatch(/Authentication required/i)
    })

    it('rejects unauthenticated call to /ai/get-review/stream with 401', async () => {
      const res = await request(app)
        .post('/ai/get-review/stream')
        .send({ code: 'const a = 1' })

      expect(res.status).toBe(401)
    })
  })
})

