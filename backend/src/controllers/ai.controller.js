const { generateContent, generateContentStream } = require('../services/ai.service')
const { getCachedReview, setCachedReview } = require('../services/cache.service')
const { parseGithubUrl, fetchPullRequestDiff, fetchRepoSourceBundle, formatFilesAsPrompt } = require('../services/github.service')

/**
 * POST /ai/get-review
 * Non-streaming JSON response. Kept for simple integrations / tests.
 */
module.exports.getReview = async (req, res) => {
  const code = req.body.code

  if (!code || !code.trim()) {
    return res.status(400).json({ error: 'code is required' })
  }

  try {
    const cached = await getCachedReview(code)
    if (cached) {
      return res.json({ review: cached, cached: true })
    }

    const review = await generateContent(code)
    await setCachedReview(code, review)
    res.json({ review, cached: false })
  } catch (err) {
    console.error('[getReview]', err.message)
    res.status(502).json({ error: 'Failed to generate review' })
  }
}

/**
 * POST /ai/get-review/stream
 * Streams the review back as plain text chunks as the model generates them.
 * A cache hit is written back as a single chunk (still "streamed" for the
 * client's sake, so the frontend doesn't need two code paths).
 */
module.exports.getReviewStream = async (req, res) => {
  const code = req.body.code

  if (!code || !code.trim()) {
    return res.status(400).json({ error: 'code is required' })
  }

  const abortController = new AbortController()
  res.on('close', () => {
    if (!res.writableEnded) {
      abortController.abort()
    }
  })

  try {
    const cached = await getCachedReview(code)
    if (cached) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('X-Accel-Buffering', 'no')
      res.write(cached)
      return res.end()
    }

    let fullText = ''
    for await (const chunk of generateContentStream(code, { signal: abortController.signal })) {
      if (!res.headersSent) {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8')
        res.setHeader('Cache-Control', 'no-cache')
        res.setHeader('X-Accel-Buffering', 'no')
      }
      fullText += chunk
      res.write(chunk)
    }

    // Only cache if non-empty response was generated
    if (fullText && fullText.trim().length > 0) {
      await setCachedReview(code, fullText)
    }
    res.end()
  } catch (err) {
    console.error('[getReviewStream]', err.message)
    if (!res.headersSent) {
      return res.status(502).json({ error: err.message || 'Failed to generate review. Please try again.' })
    }
    res.write(`\n\n[Error: ${err.message || 'failed to generate review. Please try again.'}]`)
    res.end()
  }
}

/**
 * POST /ai/get-repo-review
 * Accepts either a GitHub repo URL or a pull-request URL, fetches the
 * relevant diff/source files, and streams back a review the same way
 * getReviewStream does.
 */
module.exports.getRepoReview = async (req, res) => {
  const { url } = req.body

  if (!url || !url.trim()) {
    return res.status(400).json({ error: 'A GitHub url is required' })
  }

  const abortController = new AbortController()
  res.on('close', () => {
    if (!res.writableEnded) {
      abortController.abort()
    }
  })

  try {
    const parsed = parseGithubUrl(url)
    let promptInput

    if (parsed.type === 'pull') {
      const diff = await fetchPullRequestDiff(parsed.owner, parsed.repo, parsed.number)
      promptInput = `Review the following GitHub pull request diff. Focus your feedback on the changed lines and their surrounding context.\n\n${diff}`
    } else {
      const files = await fetchRepoSourceBundle(parsed.owner, parsed.repo, parsed.branch)
      promptInput = `Review the following source files from a GitHub repository. Start with a brief high-level overview, then give file-specific feedback.\n\n${formatFilesAsPrompt(files)}`
    }

    const cacheKey = `github:${url.trim()}`
    const cached = await getCachedReview(cacheKey)
    if (cached) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('X-Accel-Buffering', 'no')
      res.write(cached)
      return res.end()
    }

    let fullText = ''
    for await (const chunk of generateContentStream(promptInput, { signal: abortController.signal })) {
      if (!res.headersSent) {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8')
        res.setHeader('Cache-Control', 'no-cache')
        res.setHeader('X-Accel-Buffering', 'no')
      }
      fullText += chunk
      res.write(chunk)
    }

    // Only cache if non-empty response was generated
    if (fullText && fullText.trim().length > 0) {
      await setCachedReview(cacheKey, fullText)
    }
    res.end()
  } catch (err) {
    console.error('[getRepoReview]', err.message)
    if (!res.headersSent) {
      return res.status(502).json({ error: err.message || 'Failed to generate review. Please try again.' })
    }
    res.write(`\n\n[Error: ${err.message}]`)
    res.end()
  }
}
