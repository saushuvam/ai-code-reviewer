import { useState, useEffect, useCallback } from 'react'

export function useRouter() {
  const [path, setPath] = useState(() => window.location.pathname || '/')

  useEffect(() => {
    const handlePopState = () => {
      setPath(window.location.pathname || '/')
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const navigate = useCallback((to) => {
    if (to === window.location.pathname) return
    window.history.pushState({}, '', to)
    setPath(to)
    try {
      if (typeof window.scrollTo === 'function') {
        window.scrollTo(0, 0)
      }
    } catch {
      // jsdom environment stub catch
    }
  }, [])

  return { path, navigate }
}
