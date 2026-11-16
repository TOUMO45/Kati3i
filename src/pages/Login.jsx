import { useState } from 'react'
import { useAuth, authErrorToKey } from '../context/AuthContext'
import { useLocale } from '../context/LocaleContext'
import { Loader2, X, UserPlus } from 'lucide-react'
import { getSavedAccounts, forgetAccount } from '../utils/savedAccounts'

export default function Login() {
  const { signup, login, error } = useAuth()
  const { t } = useLocale()
  const [accounts, setAccounts] = useState(getSavedAccounts())
  const initialMode = accounts.length > 0 ? 'picker' : 'login'
  const [mode, setMode] = useState(initialMode) // 'picker' | 'login' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState(null)

  const onSubmit = async (e) => {
    e.preventDefault()
    setLocalError(null)
    setBusy(true)
    try {
      if (mode === 'signup') await signup(email, password, name)
      else await login(email, password)
    } catch {
      /* error already set in context */
    } finally {
      setBusy(false)
    }
  }

  const pickAccount = (acc) => {
    setEmail(acc.email)
    setPassword('')
    setMode('login')
  }

  const removeAccount = (e, acc) => {
    e.stopPropagation()
    forgetAccount(acc.email)
    const next = getSavedAccounts()
    setAccounts(next)
    if (next.length === 0) setMode('login')
  }

  const err = localError || (error ? t(authErrorToKey(error)) : null)

  return (
    <div className="min-h-full grid place-items-center p-5 bg-gradient-to-b from-brand-50 to-stone-50 dark:from-stone-900 dark:to-stone-950">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex w-16 h-16 rounded-2xl bg-brand-600 items-center justify-center text-3xl mb-3" aria-hidden="true">🐑</div>
          <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100">{t('app.name')}</h1>
          <p className="text-stone-500 dark:text-stone-400 mt-1">{t('dash.subtitle')}</p>
        </div>

        {mode === 'picker' ? (
          <div className="card space-y-3">
            <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">
              {t('auth.chooseAccount')}
            </h2>
            <ul className="space-y-2">
              {accounts.map((acc) => (
                <li key={acc.uid || acc.email}>
                  <button
                    type="button"
                    onClick={() => pickAccount(acc)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800 transition text-start"
                  >
                    <AccountAvatar acc={acc} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-stone-900 dark:text-stone-100 truncate">
                        {acc.displayName || acc.email}
                      </div>
                      <div className="text-xs text-stone-500 dark:text-stone-400 truncate">{acc.email}</div>
                    </div>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => removeAccount(e, acc)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') removeAccount(e, acc) }}
                      className="p-1.5 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
                      aria-label={t('auth.forgetAccount')}
                    >
                      <X className="w-4 h-4" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => { setEmail(''); setPassword(''); setMode('login') }}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-stone-300 dark:border-stone-700 text-sm font-medium text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 transition"
            >
              <UserPlus className="w-4 h-4" />
              {t('auth.useDifferentAccount')}
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="card space-y-4">
            <div className="flex p-1 bg-stone-100 dark:bg-stone-800 rounded-xl">
              <button
                type="button"
                onClick={() => setMode('login')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                  mode === 'login' ? 'bg-white dark:bg-stone-700 shadow-sm text-stone-900 dark:text-stone-100' : 'text-stone-500 dark:text-stone-400'
                }`}
              >{t('auth.signIn')}</button>
              <button
                type="button"
                onClick={() => setMode('signup')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                  mode === 'signup' ? 'bg-white dark:bg-stone-700 shadow-sm text-stone-900 dark:text-stone-100' : 'text-stone-500 dark:text-stone-400'
                }`}
              >{t('auth.createAccount')}</button>
            </div>

            {mode === 'signup' && (
              <div>
                <label className="label">{t('auth.name')}</label>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('auth.namePh')} />
              </div>
            )}
            <div>
              <label className="label">{t('auth.email')}</label>
              <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('auth.emailPh')} />
            </div>
            <div>
              <label className="label">{t('auth.password')}</label>
              <input className="input" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('auth.passwordPh')} autoFocus={!!email} />
            </div>

            {err && <div className="alert-error">{err}</div>}

            <button type="submit" disabled={busy} className="btn-primary w-full">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {mode === 'signup' ? t('auth.createAccount') : t('auth.signIn')}
            </button>

            {accounts.length > 0 && (
              <button
                type="button"
                onClick={() => setMode('picker')}
                className="w-full text-sm text-stone-500 dark:text-stone-400 hover:text-brand-600 dark:hover:text-brand-400"
              >
                {t('auth.backToAccounts')}
              </button>
            )}
          </form>
        )}

        <p className="text-xs text-stone-400 dark:text-stone-500 text-center mt-6">
          {t('auth.privacy')}
        </p>
      </div>
    </div>
  )
}

function AccountAvatar({ acc }) {
  if (acc.photoURL) {
    return (
      <img
        src={acc.photoURL}
        alt=""
        className="w-10 h-10 rounded-full object-cover bg-stone-200 dark:bg-stone-700"
      />
    )
  }
  const initial = (acc.displayName || acc.email || '?').trim().charAt(0).toUpperCase()
  return (
    <div className="w-10 h-10 rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 grid place-items-center font-semibold">
      {initial}
    </div>
  )
}
