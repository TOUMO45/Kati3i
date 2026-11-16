import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { useAuth, authErrorToKey } from '../context/AuthContext'
import { useLocale } from '../context/LocaleContext'
import { ModalShell } from './AddFlockModal'

export function EditNameModal({ onClose }) {
  const { user, updateDisplayName } = useAuth()
  const { t } = useLocale()
  const [name, setName] = useState(user?.displayName || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    const trimmed = name.trim()
    if (!trimmed) return setError(t('profile.errName'))
    setBusy(true)
    try {
      await updateDisplayName(trimmed)
      onClose()
    } catch (e) {
      setError(t(authErrorToKey(e.code)))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalShell onClose={onClose} title={t('profile.editName')}>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="label">{t('profile.name')}</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('auth.namePh')}
            autoFocus
          />
        </div>
        {error && <div className="alert-error">{error}</div>}
        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">{t('common.cancel')}</button>
          <button type="submit" disabled={busy} className="btn-primary flex-1">
            {busy ? t('common.saving') : t('common.saveChanges')}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

export function ChangePasswordModal({ onClose }) {
  const { user, changePassword } = useAuth()
  const { t } = useLocale()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    if (!current)         return setError(t('profile.errCurrent'))
    if (next.length < 6)  return setError(t('auth.errWeakPass'))
    if (next !== confirm) return setError(t('profile.errMismatch'))
    setBusy(true)
    try {
      await changePassword(current, next)
      onClose()
    } catch (e) {
      setError(t(authErrorToKey(e.code)))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalShell onClose={onClose} title={t('profile.changePassword')}>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="label">{t('profile.currentPassword')}</label>
          <input className="input" type="password" required value={current} onChange={(e) => setCurrent(e.target.value)} autoFocus />
        </div>
        <div>
          <label className="label">{t('profile.newPassword')}</label>
          <input className="input" type="password" required minLength={6} value={next} onChange={(e) => setNext(e.target.value)} placeholder={t('auth.passwordPh')} />
        </div>
        <div>
          <label className="label">{t('profile.confirmPassword')}</label>
          <input className="input" type="password" required minLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
        {error && <div className="alert-error">{error}</div>}
        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">{t('common.cancel')}</button>
          <button type="submit" disabled={busy} className="btn-primary flex-1">
            {busy ? t('common.saving') : t('profile.changePassword')}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}