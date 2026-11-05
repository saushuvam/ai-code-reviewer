/**
 * Safe JSON parser for HTTP fetch responses.
 * Prevents "Unexpected token '<', '<!DOCTYPE '... is not valid JSON" syntax errors
 * when a server/proxy returns an HTML error page (e.g. 404, 502, 504).
 */
export async function parseResponse(res, fallbackMessage = 'Request failed') {
  const contentType = res.headers.get('content-type') || ''
  
  if (contentType.includes('application/json')) {
    try {
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || data.message || fallbackMessage)
      }
      return data
    } catch (err) {
      if (err instanceof SyntaxError) {
        throw new Error(`${fallbackMessage}: Server returned invalid JSON.`, { cause: err })
      }
      throw err
    }
  }

  // If content-type is HTML or plain text (e.g., proxy 502/504 or server crash)
  const rawText = await res.text().catch(() => '')
  if (!res.ok) {
    if (res.status === 502 || res.status === 503 || res.status === 504) {
      throw new Error('Backend server is unreachable. Please verify that the backend is running on port 3000.')
    }
    if (res.status === 404) {
      throw new Error('Requested authentication endpoint was not found on server.')
    }
    // Clean up if it's HTML
    if (rawText.trim().startsWith('<')) {
      throw new Error(`${fallbackMessage} (Status ${res.status}). Server returned an HTML error response.`)
    }
    throw new Error(rawText || fallbackMessage)
  }

  try {
    return JSON.parse(rawText)
  } catch (err) {
    throw new Error('Server returned an unexpected non-JSON response.', { cause: err })
  }
}
