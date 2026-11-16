import { useState } from 'react'
import {
  User, Mail, Pencil, KeyRound, LogOut, Sun, Moon, Monitor, Languages, Coins, Info, Users,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useLocale } from '../context/LocaleContext'
import { getCurrency, setCurrency, formatMoney } from '../utils/format'
import { EditNameModal, ChangePasswordModal } from '../components/ProfileModals'
import { Avatar, PhotoUploader } from '../components/PhotoUploader'

const CURRENCIES = ['DZD', 'USD', 'EUR', 'MAD', 'EGP', 'SAR', 'GBP', 'TND']

export default function Profile() {
  const { user, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const { lang, setLang, t, supported } = useLocale()
  const [editing, setEditing] = useState(false)
  const [changing, setChanging] = useState(false)
  const [currency, setCur] = useState(getCurrency())

  const onCurrencyChange = (c) => {
    setCur(c)
    setCurrency(c)
    setTimeout(() => window.location.reload(), 50)
  }

  return (
    <div className="space-y-5">
      {/* Hero: avatar + name + email + photo upload */}
      <div className="card">
        <div className="flex flex-col items-center text-center">
          <Avatar user={user} size="xl" />
          <div className="mt-3 flex items-center justify-center gap-2">
            <h1 className="text-xl font-bold">{user?.displayName || t('profile.anonymous')}</h1>
            <button
              onClick={() => setEditing(true)}
              className="p-1.5 rounded-lg text-stone-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-stone-100 dark:hover:bg-stone-800"
              title={t('profile.editName')}
            >
              <Pencil className="w-4 h-4" />
            </button>
          </div>
          <div className="text-sm text-stone-500 dark:text-stone-400 flex items-center justify-center gap-1.5 mt-1">
            <Mail className="w-3.5 h-3.5" /> {user?.email}
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-stone-100 dark:border-stone-800">
          <PhotoUploader />
        </div>
      </div>

      {/* Account actions */}
      <div className="card">
        <h2 className="font-semibold mb-3 flex items-center gap-2">
          <User className="w-4 h-4" /> {t('profile.account')}
        </h2>
        <ul className="divide-y divide-stone-100 dark:divide-stone-800">
          <li>
            <button
              onClick={() => setEditing(true)}
              className="w-full text-start py-3 flex items-center justify-between gap-3 hover:bg-stone-50 dark:hover:bg-stone-800/50 -mx-4 px-4 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <Pencil className="w-4 h-4 text-stone-400" />
                <div>
                  <div className="font-medium">{t('profile.editName')}</div>
                  <div className="text-xs text-stone-500 dark:text-stone-400">{user?.displayName || t('profile.notSet')}</div>
                </div>
              </div>
              <span className="text-stone-400">›</span>
            </button>
          </li>
          <li>
            <button
              onClick={() => setChanging(true)}
              className="w-full text-start py-3 flex items-center justify-between gap-3 hover:bg-stone-50 dark:hover:bg-stone-800/50 -mx-4 px-4 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <KeyRound className="w-4 h-4 text-stone-400" />
                <div>
                  <div className="font-medium">{t('profile.changePassword')}</div>
                  <div className="text-xs text-stone-500 dark:text-stone-400">{t('profile.changePasswordHint')}</div>
                </div>
              </div>
              <span className="text-stone-400">›</span>
            </button>
          </li>
        </ul>
      </div>

      {/* Preferences */}
      <div className="card">
        <h2 className="font-semibold mb-3">{t('profile.preferences')}</h2>

        <div className="space-y-4">
          <div>
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
                      } else setTheme(opt.id)
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

          <div>
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
          </div>

          <div>
            <label className="label flex items-center gap-2">
              <Coins className="w-4 h-4" /> {t('set.currency')}
            </label>
            <select className="input" value={currency} onChange={(e) => onCurrencyChange(e.target.value)}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <div className="text-xs text-stone-400 mt-2">
              {t('set.preview', { amount: formatMoney(12345.67, currency) })}
            </div>
          </div>
        </div>
      </div>

      <div className="card text-center text-xs text-stone-500 dark:text-stone-400">
        <Info className="w-4 h-4 inline-block me-1" />
        {t('app.version')}
      </div>

      <button onClick={logout} className="btn-secondary w-full">
        <Users className="w-4 h-4" /> {t('auth.switchAccount')}
      </button>

      <button onClick={logout} className="btn-danger w-full">
        <LogOut className="w-4 h-4" /> {t('nav.signOut')}
      </button>

      {editing && <EditNameModal onClose={() => setEditing(false)} />}
      {changing && <ChangePasswordModal onClose={() => setChanging(false)} />}
    </div>
  )
}