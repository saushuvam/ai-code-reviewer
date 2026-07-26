jest.mock('../src/services/ai.service')
jest.mock('../src/services/cache.service')
jest.mock('../src/services/github.service')

const request = require('supertest')
const app = require('../src/app')
const { generateContent, generateContentStream } = require('../src/services/ai.service')
const { getCachedReview, setCachedReview } = require('../src/services/cache.service')
const { parseGithubUrl, fetchPullRequestDiff, fetchRepoSourceBundle, formatFilesAsPrompt } = require('../src/services/github.service')

async function* streamOf(...chunks) {
  for (const c of chunks) yield c
}

describe('GET /', () => {
  it('responds with Hello World', async () => {
    const res = await request(app).get('/')
    expect(res.status).toBe(200)
    expect(res.text).toBe('Hello World')
  })
})

describe('POST /ai/get-review', () => {
  beforeEach(() => jest.clearAllMocks())

  it('400s when code is missing', async () => {
    const res = await request(app).post('/ai/get-review').send({})
    expect(res.status).toBe(400)
  })

  it('returns a fresh review and writes it to cache on a miss', async () => {
    getCachedReview.mockResolvedValue(null)
    generateContent.mockResolvedValue('Nice code!')

    const res = await request(app).post('/ai/get-review').send({ code: 'const x = 1' })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ review: 'Nice code!', cached: false })
    expect(setCachedReview).toHaveBeenCalledWith('const x = 1', 'Nice code!')
  })

  it('returns the cached review and skips the model call on a hit', async () => {
    getCachedReview.mockResolvedValue('Cached review')

    const res = await request(app).post('/ai/get-review').send({ code: 'const x = 1' })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ review: 'Cached review', cached: true })
    expect(generateContent).not.toHaveBeenCalled()
  })

  it('returns 502 when generation fails', async () => {
    getCachedReview.mockResolvedValue(null)
    generateContent.mockRejectedValue(new Error('model exploded'))

    const res = await request(app).post('/ai/get-review').send({ code: 'const x = 1' })
    expect(res.status).toBe(502)
  })
})

describe('POST /ai/get-review/stream', () => {
  beforeEach(() => jest.clearAllMocks())

  it('400s when code is missing', async () => {
    const res = await request(app).post('/ai/get-review/stream').send({})
    expect(res.status).toBe(400)
  })

  it('streams chunks and caches the full text', async () => {
    getCachedReview.mockResolvedValue(null)
    generateContentStream.mockReturnValue(streamOf('Hello ', 'world'))

    const res = await request(app).post('/ai/get-review/stream').send({ code: 'const x = 1' })

    expect(res.status).toBe(200)
    expect(res.text).toBe('Hello world')
    expect(setCachedReview).toHaveBeenCalledWith('const x = 1', 'Hello world')
  })

  it('writes the cached value directly without calling the model', async () => {
    getCachedReview.mockResolvedValue('Cached streamed review')

    const res = await request(app).post('/ai/get-review/stream').send({ code: 'const x = 1' })

    expect(res.status).toBe(200)
    expect(res.text).toBe('Cached streamed review')
    expect(generateContentStream).not.toHaveBeenCalled()
  })
})

describe('POST /ai/get-repo-review', () => {
  beforeEach(() => jest.clearAllMocks())

  it('400s when url is missing', async () => {
    const res = await request(app).post('/ai/get-repo-review').send({})
    expect(res.status).toBe(400)
  })

  it('reviews a pull request diff', async () => {
    parseGithubUrl.mockReturnValue({ type: 'pull', owner: 'octocat', repo: 'hello-world', number: 42 })
    fetchPullRequestDiff.mockResolvedValue('diff --git a/x b/x')
    getCachedReview.mockResolvedValue(null)
    generateContentStream.mockReturnValue(streamOf('Diff ', 'looks fine.'))

    const res = await request(app)
      .post('/ai/get-repo-review')
      .send({ url: 'https://github.com/octocat/hello-world/pull/42' })

    expect(res.status).toBe(200)
    expect(res.text).toBe('Diff looks fine.')
    expect(fetchPullRequestDiff).toHaveBeenCalledWith('octocat', 'hello-world', 42)
  })

  it('reviews a repo source bundle', async () => {
    parseGithubUrl.mockReturnValue({ type: 'repo', owner: 'octocat', repo: 'hello-world', branch: undefined })
    fetchRepoSourceBundle.mockResolvedValue([{ path: 'index.js', content: 'console.log(1)' }])
    formatFilesAsPrompt.mockReturnValue('--- FILE: index.js ---\nconsole.log(1)')
    getCachedReview.mockResolvedValue(null)
    generateContentStream.mockReturnValue(streamOf('Repo ', 'review text'))

    const res = await request(app)
      .post('/ai/get-repo-review')
      .send({ url: 'https://github.com/octocat/hello-world' })

    expect(res.status).toBe(200)
    expect(res.text).toBe('Repo review text')
    expect(fetchRepoSourceBundle).toHaveBeenCalledWith('octocat', 'hello-world', undefined)
  })

  it('surfaces a parse error to the client', async () => {
    parseGithubUrl.mockImplementation(() => {
      throw new Error('Unrecognized GitHub URL')
    })

    const res = await request(app).post('/ai/get-repo-review').send({ url: 'https://example.com/nope' })

    expect(res.text).toContain('Unrecognized GitHub URL')
  })
})
