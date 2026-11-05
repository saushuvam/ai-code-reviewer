const mockGenerateContent = jest.fn()
const mockGenerateContentStream = jest.fn()
const mockGetGenerativeModel = jest.fn(() => ({
  generateContent: mockGenerateContent,
  generateContentStream: mockGenerateContentStream,
}))

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: mockGetGenerativeModel,
  })),
}))

const { generateContent, generateContentStream } = require('../src/services/ai.service')

describe('ai.service', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('generateContent', () => {
    it('returns the model response text', async () => {
      mockGenerateContent.mockResolvedValue({ response: { text: () => 'Looks good!' } })
      const result = await generateContent('const x = 1')
      expect(result).toBe('Looks good!')
      expect(mockGenerateContent).toHaveBeenCalledWith('const x = 1')
    })

    it('configures the model with the system instruction', async () => {
      mockGenerateContent.mockResolvedValue({ response: { text: () => 'ok' } })
      await generateContent('const x = 1')
      const config = mockGetGenerativeModel.mock.calls[0][0]
      expect(config.model).toBe(process.env.GEMINI_MODEL || 'gemini-3.5-flash')
      expect(config.systemInstruction).toEqual(expect.stringContaining('Senior Code Reviewer'))
    })

    it('retries on transient 503 error and succeeds', async () => {
      const err503 = new Error('503 Service Unavailable')
      err503.status = 503
      mockGenerateContent
        .mockRejectedValueOnce(err503)
        .mockResolvedValueOnce({ response: { text: () => 'Review after retry' } })

      const result = await generateContent('const x = 1', { maxRetries: 1 })
      expect(result).toBe('Review after retry')
      expect(mockGenerateContent).toHaveBeenCalledTimes(2)
    })

    it('falls back to secondary model when primary fails all retries', async () => {
      const err503 = new Error('503 Service Unavailable')
      err503.status = 503
      mockGenerateContent
        .mockRejectedValueOnce(err503) // primary attempt 1
        .mockResolvedValueOnce({ response: { text: () => 'Fallback review' } }) // fallback attempt 1

      const result = await generateContent('const x = 1', {
        model: 'primary-model',
        fallbackModel: 'fallback-model',
        maxRetries: 0,
      })
      expect(result).toBe('Fallback review')
      expect(mockGetGenerativeModel).toHaveBeenCalledWith(expect.objectContaining({ model: 'primary-model' }))
      expect(mockGetGenerativeModel).toHaveBeenCalledWith(expect.objectContaining({ model: 'fallback-model' }))
    })
  })

  describe('generateContentStream', () => {
    it('yields each chunk of text as it streams', async () => {
      async function* fakeStream() {
        yield { text: () => 'Hello ' }
        yield { text: () => 'world' }
      }
      mockGenerateContentStream.mockResolvedValue({ stream: fakeStream() })

      const chunks = []
      for await (const chunk of generateContentStream('const x = 1')) {
        chunks.push(chunk)
      }
      expect(chunks).toEqual(['Hello ', 'world'])
    })

    it('skips empty chunks', async () => {
      async function* fakeStream() {
        yield { text: () => '' }
        yield { text: () => 'content' }
      }
      mockGenerateContentStream.mockResolvedValue({ stream: fakeStream() })

      const chunks = []
      for await (const chunk of generateContentStream('const x = 1')) {
        chunks.push(chunk)
      }
      expect(chunks).toEqual(['content'])
    })
  })
})
