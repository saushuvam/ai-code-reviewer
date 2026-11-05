import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import App, { DashboardView } from './App'

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

describe('Landing Page & Public Routes', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/')
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url === '/api/auth/me') {
        return Promise.resolve({ ok: false, status: 401, json: async () => ({ error: 'Unauthorized' }) })
      }
      return Promise.resolve({ ok: true, json: async () => ({}) })
    })
  })

  it('renders landing page with headline, CTAs, and features for public visitors', async () => {
    render(<App />)

    await waitFor(() => {
      expect(screen.getAllByText(/Write Better Code/i).length).toBeGreaterThan(0)
    })

    expect(screen.getByRole('button', { name: /^Get Started$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Sign In$/i })).toBeInTheDocument()
    expect(screen.getByText(/Streaming AI Reviews/i)).toBeInTheDocument()
    expect(screen.getByText(/Intelligent Bug Detection/i)).toBeInTheDocument()
  })

  it('navigates to sign in page when clicking Sign In', async () => {
    render(<App />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Sign In$/i })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /^Sign In$/i }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Welcome Back/i })).toBeInTheDocument()
    })
  })

  it('navigates to sign up page when clicking Get Started', async () => {
    render(<App />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Get Started$/i })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /^Get Started$/i }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Create an Account/i })).toBeInTheDocument()
    })
  })
})

describe('DashboardView (Protected Review Flow)', () => {
  const mockUser = { id: 'u1', name: 'Linus Torvalds', email: 'linus@kernel.org' }
  const mockLogout = vi.fn()
  const mockNavLanding = vi.fn()

  beforeEach(() => {
    global.fetch = vi.fn()
  })

  it('renders dashboard with user menu and Paste Code mode active', () => {
    render(
      <DashboardView
        user={mockUser}
        onLogout={mockLogout}
        onNavigateLanding={mockNavLanding}
      />
    )

    expect(screen.getByText('Linus Torvalds')).toBeInTheDocument()
    expect(screen.getByText('linus@kernel.org')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Paste Code' })).toHaveClass('active')
    expect(screen.getByText('Review')).toBeInTheDocument()
  })

  it('switches to GitHub mode and sends review request', async () => {
    global.fetch.mockResolvedValue(makeStreamingResponse(['PR Review Content']))

    render(
      <DashboardView
        user={mockUser}
        onLogout={mockLogout}
        onNavigateLanding={mockNavLanding}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'GitHub Repo / PR' }))
    const input = screen.getByPlaceholderText(/github.com\/owner\/repo/i)
    fireEvent.change(input, { target: { value: 'https://github.com/torvalds/linux' } })
    fireEvent.click(screen.getByText('Review'))

    await waitFor(() => {
      expect(screen.getByText(/PR Review Content/)).toBeInTheDocument()
    })

    expect(global.fetch).toHaveBeenCalledWith(
      '/ai/get-repo-review',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('streams a code review in Paste Code mode', async () => {
    global.fetch.mockResolvedValue(makeStreamingResponse(['# Senior Review\n\n', 'Code is clean.']))

    render(
      <DashboardView
        user={mockUser}
        onLogout={mockLogout}
        onNavigateLanding={mockNavLanding}
      />
    )

    fireEvent.click(screen.getByText('Review'))

    await waitFor(() => {
      expect(screen.getByText(/Code is clean/)).toBeInTheDocument()
    })

    expect(global.fetch).toHaveBeenCalledWith(
      '/ai/get-review/stream',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('shows an error message when the stream request fails', async () => {
    global.fetch.mockResolvedValue(makeErrorResponse(502, 'backend is down'))

    render(
      <DashboardView
        user={mockUser}
        onLogout={mockLogout}
        onNavigateLanding={mockNavLanding}
      />
    )

    fireEvent.click(screen.getByText('Review'))

    await waitFor(() => {
      expect(screen.getByText(/backend is down/)).toBeInTheDocument()
    })
  })
})
