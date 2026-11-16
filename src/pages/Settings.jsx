import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useLocale } from '../context/LocaleContext'
import { getCurrency, setCurrency, formatMoney } from '../utils/format'
import { LogOut, Sun, Moon, Monitor, Languages } from 'lucide-react'

const CURRENCIES = ['DZD', 'USD', 'EUR', 'MAD', 'EGP', 'SAR', 'GBP', 'TND']

export default function Settings() {
  const { user, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const { lang, setLang, t, supported } = useLocale()
  const [currency, setCur] = useState(getCurrency())

  const onCurrencyChange = (c) => {
    setCur(c)
    setCurrency(c)
    setTimeout(() => window.location.reload(), 50)
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{t('set.title')}</h1>
        <p className="text-sm text-stone-500 dark:text-stone-400">{t('set.subtitle')}</p>
      </div>

      <div className="card">
        <div className="text-xs text-stone-500 dark:text-stone-400 mb-1">{t('set.account')}</div>
        <div className="font-medium">{user?.displayName || 'User'}</div>
        <div className="text-sm text-stone-500 dark:text-stone-400">{user?.email}</div>
      </div>

      <div className="card">
        <label className="label">{t('set.appearance')}</label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { id: 'light',  label: t('theme.light'),  icon: Sun },
            { id: 'dark',   label: t('theme.dark'),   icon: Moon },
            { id: 'system', label: t('theme.system'), icon: Monitor },
          ].map((opt) => {
            const Icon = opt.icon
            const isActive = theme === opt.id
            return (
              <button
                key={opt.id}
                onClick={() => {
                  if (opt.id === 'system') {
                    const sys = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
                    setTheme(sys)
                    localStorage.removeItem('sheep-tracker-theme')
                  } else {
                    setTheme(opt.id)
                  }
                }}
                className={`flex flex-col items-center gap-1 py-3 rounded-xl border-2 transition ${
                  isActive
                    ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300'
                    : 'border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs font-medium">{opt.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="card">
        <label className="label flex items-center gap-2">
          <Languages className="w-4 h-4" /> {t('set.language')}
        </label>
        <div className="grid grid-cols-2 gap-2">
          {supported.map((l) => (
            <button
              key={l.code}
              onClick={() => setLang(l.code)}
              className={`flex items-center justify-between px-3 py-2.5 rounded-xl border-2 transition ${
                lang === l.code
                  ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300'
                  : 'border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800'
              }`}
            >
              <span className="font-medium">{l.native}</span>
              <span className="text-xs opacity-70">{l.label}</span>
            </button>
          ))}
        </div>
        <div className="text-xs text-stone-400 mt-2">
          {lang === 'ar' ? 'سيتم تطبيق الاتجاه من اليمين إلى اليسار تلقائياً.' : 'Right-to-left layout is applied automatically for Arabic.'}
        </div>
      </div>

      <div className="card">
        <label className="label">{t('set.currency')}</label>
        <select className="input" value={currency} onChange={(e) => onCurrencyChange(e.target.value)}>
          {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="text-xs text-stone-400 mt-2">
          {t('set.preview', { amount: formatMoney(12345.67, currency) })}
        </div>
      </div>

      <button onClick={logout} className="btn-secondary w-full">
        <LogOut className="w-4 h-4" /> {t('nav.signOut')}
      </button>

      <div className="text-center text-xs text-stone-400 pt-4">
        {t('app.version')}
      </div>
    </div>
  )
}