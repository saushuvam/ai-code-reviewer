require('dotenv').config()
const { GoogleGenerativeAI } = require('@google/generative-ai')

const SYSTEM_INSTRUCTION = `
        Here's a solid system instruction for your AI code reviewer:

        AI System Instruction: Senior Code Reviewer (7+ Years of Experience)

        Role & Responsibilities:

        You are an expert code reviewer with 7+ years of development experience. Your role is to analyze, review, and improve code written by developers. You focus on:
        	•	Code Quality :- Ensuring clean, maintainable, and well-structured code.
        	•	Best Practices :- Suggesting industry-standard coding practices.
        	•	Efficiency & Performance :- Identifying areas to optimize execution time and resource usage.
        	•	Error Detection :- Spotting potential bugs, security risks, and logical flaws.
        	•	Scalability :- Advising on how to make code adaptable for future growth.
        	•	Readability & Maintainability :- Ensuring that the code is easy to understand and modify.

        Guidelines for Review:
        	1.	Provide Constructive Feedback :- Be detailed yet concise, explaining why changes are needed.
        	2.	Suggest Code Improvements :- Offer refactored versions or alternative approaches when possible.
        	3.	Detect & Fix Performance Bottlenecks :- Identify redundant operations or costly computations.
        	4.	Ensure Security Compliance :- Look for common vulnerabilities (e.g., SQL injection, XSS, CSRF).
        	5.	Promote Consistency :- Ensure uniform formatting, naming conventions, and style guide adherence.
        	6.	Follow DRY (Don't Repeat Yourself) & SOLID Principles :- Reduce code duplication and maintain modular design.
        	7.	Identify Unnecessary Complexity :- Recommend simplifications when needed.
        	8.	Verify Test Coverage :- Check if proper unit/integration tests exist and suggest improvements.
        	9.	Ensure Proper Documentation :- Advise on adding meaningful comments and docstrings.
        	10.	Encourage Modern Practices :- Suggest the latest frameworks, libraries, or patterns when beneficial.

        Tone & Approach:
        	•	Be precise, to the point, and avoid unnecessary fluff.
        	•	Provide real-world examples when explaining concepts.
        	•	Assume that the developer is competent but always offer room for improvement.
        	•	Balance strictness with encouragement :- highlight strengths while pointing out weaknesses.
`

function isTransientError(err) {
  if (!err) return false
  const status = Number(err.status)
  if (status === 503 || status === 429 || status === 500 || status === 504 || status === 408) {
    return true
  }
  const msg = (err.message || '').toLowerCase()
  return (
    msg.includes('503') ||
    msg.includes('429') ||
    msg.includes('high demand') ||
    msg.includes('resource exhausted') ||
    msg.includes('quota') ||
    msg.includes('temporarily unavailable') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('network') ||
    msg.includes('fetch failed')
  )
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getModel(modelName) {
  if (!process.env.GOOGLE_GEMINI_KEY) {
    throw new Error('GOOGLE_GEMINI_KEY is not set. Add it to backend/.env')
  }
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_KEY)
  const resolvedModel = modelName || process.env.GEMINI_MODEL || 'gemini-3.5-flash'
  return genAI.getGenerativeModel({
    model: resolvedModel,
    systemInstruction: SYSTEM_INSTRUCTION,
  })
}

/** Non-streaming: returns the full review text at once with retries and fallback. */
async function generateContent(prompt, options = {}) {
  const primaryModel = options.model || process.env.GEMINI_MODEL || 'gemini-3.5-flash'
  const fallbackModel = options.fallbackModel || process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.5-flash-lite'
  const maxRetries = options.maxRetries !== undefined ? options.maxRetries : 3

  const modelsToTry = [primaryModel]
  if (fallbackModel && fallbackModel !== primaryModel) {
    modelsToTry.push(fallbackModel)
  }

  let lastError = null

  for (const modelName of modelsToTry) {
    let delay = 1000
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const model = getModel(modelName)
        const result = await model.generateContent(prompt)
        return result.response.text()
      } catch (err) {
        lastError = err
        const isTransient = isTransientError(err)
        if (!isTransient || attempt === maxRetries) {
          console.warn(`[ai.service] generateContent failed with model ${modelName} on attempt ${attempt + 1}: ${err.message}`)
          break
        }
        const jitter = Math.floor(Math.random() * 500)
        console.warn(`[ai.service] Transient error on attempt ${attempt + 1} (${modelName}): ${err.message}. Retrying in ${delay + jitter}ms...`)
        await sleep(delay + jitter)
        delay *= 2
      }
    }
  }

  throw lastError
}

/** Streaming: yields text chunks as they arrive from the model with retries and fallback. */
async function* generateContentStream(prompt, options = {}) {
  const primaryModel = options.model || process.env.GEMINI_MODEL || 'gemini-3.5-flash'
  const fallbackModel = options.fallbackModel || process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.5-flash-lite'
  const maxRetries = options.maxRetries !== undefined ? options.maxRetries : 3

  const modelsToTry = [primaryModel]
  if (fallbackModel && fallbackModel !== primaryModel) {
    modelsToTry.push(fallbackModel)
  }

  let lastError = null

  for (const modelName of modelsToTry) {
    let delay = 1000
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (options.signal?.aborted) return

      try {
        const model = getModel(modelName)
        const result = await model.generateContentStream(prompt)

        let receivedAnyChunk = false
        for await (const chunk of result.stream) {
          if (options.signal?.aborted) return
          const text = chunk.text()
          if (text) {
            receivedAnyChunk = true
            yield text
          }
        }
        return // Successfully completed stream
      } catch (err) {
        lastError = err
        const isTransient = isTransientError(err)
        if (!isTransient || attempt === maxRetries) {
          console.warn(`[ai.service] generateContentStream failed with model ${modelName} on attempt ${attempt + 1}: ${err.message}`)
          break
        }
        const jitter = Math.floor(Math.random() * 500)
        console.warn(`[ai.service] Transient error on attempt ${attempt + 1} (${modelName}): ${err.message}. Retrying in ${delay + jitter}ms...`)
        await sleep(delay + jitter)
        delay *= 2
      }
    }
  }

  throw lastError
}

module.exports = { generateContent, generateContentStream, SYSTEM_INSTRUCTION, getModel, isTransientError }
