import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import SignInPage from '../pages/SignInPage'
import SignUpPage from '../pages/SignUpPage'
import { AuthProvider } from '../context/AuthContext'

describe('Authentication Pages & Safe Response Parsing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('displays a friendly error when backend is offline and returns HTML 502/504 error', async () => {
    // Vite proxy returns HTML when backend isn't running or crashes
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url === '/api/auth/me') {
        return Promise.resolve({
          ok: false,
          status: 401,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ error: 'Unauthorized' }),
        })
      }
      if (url === '/api/auth/signin') {
        return Promise.resolve({
          ok: false,
          status: 502,
          headers: new Headers({ 'content-type': 'text/html' }),
          text: async () => '<!DOCTYPE html><html><body><h1>502 Bad Gateway</h1></body></html>',
        })
      }
      return Promise.reject(new Error('Unknown url'))
    })

    const mockNavigate = vi.fn()
    render(
      <AuthProvider>
        <SignInPage navigate={mockNavigate} />
      </AuthProvider>
    )

    fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: 'user@example.com' } })
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'secret123' } })
    fireEvent.click(screen.getByRole('button', { name: /^Sign In$/i }))

    await waitFor(() => {
      // Must NOT show "Unexpected token '<', "<!DOCTYPE "... is not valid JSON"
      expect(screen.queryByText(/Unexpected token/i)).not.toBeInTheDocument()
      expect(screen.getByText(/Backend server is unreachable/i)).toBeInTheDocument()
    })
  })

  it('displays backend JSON error message when credentials are wrong', async () => {
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url === '/api/auth/me') {
        return Promise.resolve({
          ok: false,
          status: 401,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ error: 'Unauthorized' }),
        })
      }
      if (url === '/api/auth/signin') {
        return Promise.resolve({
          ok: false,
          status: 401,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ error: 'Invalid email or password' }),
        })
      }
      return Promise.reject(new Error('Unknown url'))
    })

    const mockNavigate = vi.fn()
    render(
      <AuthProvider>
        <SignInPage navigate={mockNavigate} />
      </AuthProvider>
    )

    fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: 'user@example.com' } })
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'wrongpassword' } })
    fireEvent.click(screen.getByRole('button', { name: /^Sign In$/i }))

    await waitFor(() => {
      expect(screen.getByText('Invalid email or password')).toBeInTheDocument()
    })
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('navigates to dashboard on successful sign in', async () => {
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url === '/api/auth/me') {
        return Promise.resolve({
          ok: false,
          status: 401,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ error: 'Unauthorized' }),
        })
      }
      if (url === '/api/auth/signin') {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ user: { id: 'u1', name: 'Dev', email: 'dev@test.com' } }),
        })
      }
      return Promise.reject(new Error('Unknown url'))
    })

    const mockNavigate = vi.fn()
    render(
      <AuthProvider>
        <SignInPage navigate={mockNavigate} />
      </AuthProvider>
    )

    fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: 'dev@test.com' } })
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: /^Sign In$/i }))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
    })
  })

  it('handles sign up validation and registration errors safely', async () => {
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url === '/api/auth/me') {
        return Promise.resolve({
          ok: false,
          status: 401,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ error: 'Unauthorized' }),
        })
      }
      if (url === '/api/auth/signup') {
        return Promise.resolve({
          ok: false,
          status: 409,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ error: 'An account with this email already exists' }),
        })
      }
      return Promise.reject(new Error('Unknown url'))
    })

    const mockNavigate = vi.fn()
    render(
      <AuthProvider>
        <SignUpPage navigate={mockNavigate} />
      </AuthProvider>
    )

    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: 'Dev User' } })
    fireEvent.change(screen.getByLabelText(/Work Email/i), { target: { value: 'dev@test.com' } })
    fireEvent.change(screen.getByLabelText(/Password \(min 8/i), { target: { value: 'StrongPass123!' } })
    fireEvent.change(screen.getByLabelText(/Confirm Password/i), { target: { value: 'StrongPass123!' } })
    fireEvent.click(screen.getByRole('button', { name: /^Sign Up Free$/i }))

    await waitFor(() => {
      expect(screen.getByText('An account with this email already exists')).toBeInTheDocument()
    })
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
