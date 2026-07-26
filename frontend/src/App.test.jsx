import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import App from './App'

/**
 * Builds a fake fetch Response whose body.getReader() yields the given
 * text chunks one at a time, mimicking a streamed response without
 * depending on a real ReadableStream implementation being present.
 */
function makeStreamingResponse(chunks) {
  let i = 0
  return {
    ok: true,
    status: 200,
    body: {
      getReader() {
        return {
          read: async () => {
            if (i < chunks.length) {
              const value = new TextEncoder().encode(chunks[i])
              i += 1
              return { done: false, value }
            }
            return { done: true, value: undefined }
          },
        }
      },
    },
    text: async () => chunks.join(''),
  }
}

function makeErrorResponse(status, message) {
  return {
    ok: false,
    status,
    body: null,
    text: async () => message,
  }
}

describe('App', () => {
  beforeEach(() => {
    global.fetch = vi.fn()
  })

  it('defaults to Paste Code mode with the review button visible', () => {
    render(<App />)
    expect(screen.getByRole('button', { name: 'Paste Code' })).toHaveClass('active')
    expect(screen.getByText('Review')).toBeInTheDocument()
  })

  it('switches to GitHub mode and shows the url input', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'GitHub Repo / PR' }))
    expect(screen.getByPlaceholderText(/github.com\/owner\/repo/i)).toBeInTheDocument()
  })

  it('streams a code review and renders the accumulated markdown', async () => {
    global.fetch.mockResolvedValue(makeStreamingResponse(['# Looks good\n\n', 'Nice use of const.']))

    render(<App />)
    fireEvent.click(screen.getByText('Review'))

    await waitFor(() => {
      expect(screen.getByText(/Nice use of const/)).toBeInTheDocument()
    })

    expect(global.fetch).toHaveBeenCalledWith(
      '/ai/get-review/stream',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('sends the repo url to the repo-review endpoint in GitHub mode', async () => {
    global.fetch.mockResolvedValue(makeStreamingResponse(['Repo review text']))

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'GitHub Repo / PR' }))
    fireEvent.change(screen.getByPlaceholderText(/github.com\/owner\/repo/i), {
      target: { value: 'https://github.com/octocat/hello-world' },
    })
    fireEvent.click(screen.getByText('Review'))

    await waitFor(() => {
      expect(screen.getByText(/Repo review text/)).toBeInTheDocument()
    })

    expect(global.fetch).toHaveBeenCalledWith(
      '/ai/get-repo-review',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ url: 'https://github.com/octocat/hello-world' }),
      })
    )
  })

  it('shows an error message when the request fails', async () => {
    global.fetch.mockResolvedValue(makeErrorResponse(502, 'backend is down'))

    render(<App />)
    fireEvent.click(screen.getByText('Review'))

    await waitFor(() => {
      expect(screen.getByText(/backend is down/)).toBeInTheDocument()
    })
  })

  it('does not call fetch when reviewing empty code', () => {
    render(<App />)
    // default sample code is non-empty, so clear it first isn't trivial via the
    // code editor; instead switch to GitHub mode with an empty url as the
    // simplest way to exercise the empty-input guard.
    fireEvent.click(screen.getByRole('button', { name: 'GitHub Repo / PR' }))
    fireEvent.click(screen.getByText('Review'))
    expect(global.fetch).not.toHaveBeenCalled()
  })
})
