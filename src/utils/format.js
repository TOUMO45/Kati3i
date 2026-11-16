// Display helpers — currency, dates, compact numbers.
// Currency comes from localStorage if set, otherwise from VITE_DEFAULT_CURRENCY.

const DEFAULT_CURRENCY = import.meta.env.VITE_DEFAULT_CURRENCY || 'DZD'

const CURRENCY_LOCALE = {
  DZD: 'ar-DZ',
  USD: 'en-US',
  EUR: 'fr-FR',
  MAD: 'ar-MA',
  EGP: 'ar-EG',
  SAR: 'ar-SA',
}

export function getCurrency() {
  if (typeof window === 'undefined') return DEFAULT_CURRENCY
  return localStorage.getItem('sheep-tracker-currency') || DEFAULT_CURRENCY
}

export function setCurrency(code) {
  localStorage.setItem('sheep-tracker-currency', code)
}

export function formatMoney(amount, currency = getCurrency()) {
  const value = Number(amount || 0)
  const locale = CURRENCY_LOCALE[currency] || 'en-US'
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: currency === 'DZD' ? 0 : 2,
    }).format(value)
  } catch {
    // Fallback when Intl doesn't know the currency code
    return `${value.toLocaleString()} ${currency}`
  }
}

export function formatDate(iso, locale = 'en-GB') {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString(locale, {
      year: 'numeric', month: 'short', day: 'numeric',
    })
  } catch {
    return iso
  }
}

export function formatCompact(n) {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n)
}