import { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext(null)

// Persist theme in localStorage. Falls back to system preference on first load.
function getInitial() {
  if (typeof window === 'undefined') return 'light'
  const saved = localStorage.getItem('sheep-tracker-theme')
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

// Apply theme by setting `data-theme` on <html>. The Tailwind config uses
// `[data-theme="dark"]` as its dark-mode selector, so this is what actually
// triggers every `dark:` utility class throughout the app.
function applyTheme(theme) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (theme === 'dark') root.setAttribute('data-theme', 'dark')
  else root.setAttribute('data-theme', 'light')
  // Update iOS / Android status bar color
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#0c0a09' : '#16a34a')
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitial)

  // Apply on every change AND on first mount (in case getInitial returned
  // the wrong value vs. the inline script's setting).
  useEffect(() => {
    applyTheme(theme)
    localStorage.setItem('sheep-tracker-theme', theme)
  }, [theme])

  const toggle = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))

  return (
    <ThemeContext.Provider value={{ theme, toggle, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}