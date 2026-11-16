import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { translations, lookup, SUPPORTED_LANGS } from '../i18n/translations'

const LocaleContext = createContext(null)

function getInitial() {
  if (typeof window === 'undefined') return 'en'
  const saved = localStorage.getItem('sheep-tracker-lang')
  if (saved && translations[saved]) return saved
  // Default to Arabic if the browser language starts with 'ar', else English.
  const browser = (navigator.language || 'en').toLowerCase()
  return browser.startsWith('ar') ? 'ar' : 'en'
}

function applyToDocument(lang) {
  const meta = SUPPORTED_LANGS.find((l) => l.code === lang) || SUPPORTED_LANGS[0]
  document.documentElement.lang = lang
  document.documentElement.dir = meta.dir
}

export function LocaleProvider({ children }) {
  const [lang, setLangState] = useState(getInitial)

  useEffect(() => {
    localStorage.setItem('sheep-tracker-lang', lang)
    applyToDocument(lang)
  }, [lang])

  // t() is stable across renders so it can be safely used in deps arrays.
  const t = useCallback((key, vars) => lookup(lang, key, vars), [lang])

  const setLang = useCallback((code) => {
    if (translations[code]) setLangState(code)
  }, [])

  // Convenience: swap between the two supported languages (en <-> ar).
  const toggleLang = useCallback(() => {
    setLangState((cur) => (cur === 'ar' ? 'en' : 'ar'))
  }, [])

  const isRTL = lang === 'ar'

  return (
    <LocaleContext.Provider value={{ lang, setLang, toggleLang, t, isRTL, supported: SUPPORTED_LANGS }}>
      {children}
    </LocaleContext.Provider>
  )
}

export function useLocale() {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error('useLocale must be used inside LocaleProvider')
  return ctx
}