import { useState, useRef } from 'react'
import { Camera, Trash2, Loader2, Upload } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useLocale } from '../context/LocaleContext'

const MAX_SIZE = 5 * 1024 * 1024 // 5MB

// Reusable avatar with optional photo. Shows a colored initial if no photo.
export function Avatar({ user, size = 'lg', onClick }) {
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-12 h-12 text-base',
    lg: 'w-20 h-20 text-2xl',
    xl: 'w-28 h-28 text-4xl',
  }
  const initial = ((user?.displayName || user?.email || '?').trim().charAt(0) || '?').toUpperCase()
  const cls = `${sizeClasses[size]} rounded-full grid place-items-center font-bold text-white shadow-md shrink-0 ${onClick ? 'cursor-pointer' : ''}`

  if (user?.photoURL) {
    return (
      <img
        src={user.photoURL}
        alt={user.displayName || 'avatar'}
        onClick={onClick}
        className={`${cls} object-cover`}
        referrerPolicy="no-referrer"
      />
    )
  }
  // Fallback: colored initial
  const palette = ['#16a34a', '#0ea5e9', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899']
  let h = 0
  for (let i = 0; i < (user?.uid || '').length; i++) h = (h * 31 + (user?.uid || '').charCodeAt(i)) >>> 0
  const bg = palette[h % palette.length]
  return (
    <div onClick={onClick} className={cls} style={{ backgroundColor: bg }}>{initial}</div>
  )
}

export function PhotoUploader() {
  const { user, uploadProfilePhoto, removeProfilePhoto } = useAuth()
  const { t } = useLocale()
  const inputRef = useRef(null)
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const onPick = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setError(t('profile.photo.errType')); return }
    if (file.size > MAX_SIZE)            { setError(t('profile.photo.errSize')); return }
    setError(null)
    const reader = new FileReader()
    reader.onload = (ev) => setPreview({ url: ev.target.result, file })
    reader.readAsDataURL(file)
  }

  const onUpload = async () => {
    if (!preview?.file) return
    setBusy(true); setError(null)
    try {
      await uploadProfilePhoto(preview.file)
      setPreview(null)
      if (inputRef.current) inputRef.current.value = ''
    } catch (e) {
      // Surface the actual Firebase Storage error code (storage/unauthorized,
      // storage/unknown, etc.) — without it, "upload failed" is impossible
      // to diagnose. Common causes: Storage not enabled in the Firebase
      // console, storage.rules not deployed, wrong bucket name in .env.
      console.error('Photo upload failed:', e)
      const code = e?.code || e?.message || 'unknown'
      setError(`${t('profile.photo.errUpload')} (${code})`)
    } finally {
      setBusy(false)
    }
  }

  const onCancel = () => {
    setPreview(null)
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const onRemove = async () => {
    if (!confirm(t('profile.photo.removeQ'))) return
    setBusy(true); setError(null)
    try {
      await removeProfilePhoto()
    } catch {
      setError(t('profile.photo.errRemove'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      {/* Hidden file input. accept=image/* lets mobile users pick from camera
          or gallery; we also accept HEIC/HEIF and common formats. */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={onPick}
        className="hidden"
      />

      {!preview && (
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <Avatar user={user} size="lg" />
          <div className="flex-1 text-center sm:text-start">
            <div className="font-medium">{t('profile.photo.title')}</div>
            <div className="text-xs text-stone-500 dark:text-stone-400">{t('profile.photo.hint')}</div>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="btn-secondary"
            >
              <Upload className="w-4 h-4" /> {t('profile.photo.upload')}
            </button>
            {user?.photoURL && (
              <button
                onClick={onRemove}
                disabled={busy}
                className="btn-ghost text-red-600 dark:text-red-400"
                title={t('profile.photo.remove')}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {preview && (
        <div className="flex flex-col sm:flex-row items-center gap-4 p-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/50">
          <img src={preview.url} alt="preview" className="w-20 h-20 rounded-full object-cover shrink-0" />
          <div className="flex-1 text-center sm:text-start">
            <div className="font-medium">{t('profile.photo.preview')}</div>
            <div className="text-xs text-stone-500 dark:text-stone-400">
              {(preview.file.size / 1024).toFixed(0)} KB
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={onCancel} disabled={busy} className="btn-ghost">
              {t('common.cancel')}
            </button>
            <button onClick={onUpload} disabled={busy} className="btn-primary">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
              {t('common.save')}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="alert-error">{error}</div>
      )}
    </div>
  )
}