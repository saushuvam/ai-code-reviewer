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
      expect(config.model).toBe('gemini-2.5-flash')
      expect(config.systemInstruction).toEqual(expect.stringContaining('Senior Code Reviewer'))
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
