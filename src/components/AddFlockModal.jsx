import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { addFlock, updateFlock } from '../hooks/useFirestore'
import { useLocale } from '../context/LocaleContext'
import { LIVESTOCK_TYPES, DEFAULT_LIVESTOCK_TYPE } from '../utils/livestock'

export default function AddFlockModal({ flock, onClose, onSaved }) {
  const { user } = useAuth()
  const { t } = useLocale()
  const isEdit = !!flock
  const today = new Date().toISOString().slice(0, 10)

  const [livestockType, setLivestockType] = useState(flock?.livestockType || DEFAULT_LIVESTOCK_TYPE)
  const [name, setName] = useState(flock?.name || '')
  const [initialCount, setInitialCount] = useState(flock?.initialCount ?? '')
  const initialUnitPrice =
    flock?.buyPrice != null && flock?.initialCount > 0
      ? String(Number(flock.buyPrice) / Number(flock.initialCount))
      : ''
  const [unitPrice, setUnitPrice] = useState(initialUnitPrice)
  const countNum = Number(initialCount) || 0
  const unitPriceNum = Number(unitPrice) || 0
  const buyPrice = countNum * unitPriceNum
  const [buyDate, setBuyDate] = useState(flock?.buyDate || today)
  const [initialAvgWeight, setInitialAvgWeight] = useState(flock?.initialAvgWeight ?? '')
  const [notes, setNotes] = useState(flock?.notes || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    if (!name.trim()) return setError(t('addFlock.errName'))
    if (!initialCount || initialCount < 1) return setError(t('addFlock.errCount'))
    if (!unitPrice || unitPriceNum < 0) return setError(t('addFlock.errPrice'))
    setBusy(true)
    try {
      const payload = {
        livestockType,
        name: name.trim(),
        initialCount: Number(initialCount),
        buyPrice: Number(buyPrice),
        buyDate,
        initialAvgWeight: initialAvgWeight === '' ? null : Number(initialAvgWeight),
        notes: notes.trim(),
      }
      if (isEdit) {
        await updateFlock(user.uid, flock.id, payload)
      } else {
        await addFlock(user.uid, { ...payload, status: 'active' })
      }
      onSaved?.()
      onClose()
    } catch {
      setError(t('addFlock.errSave'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalShell onClose={onClose} title={isEdit ? t('addFlock.title.edit', { name: flock.name }) : t('addFlock.title.new')}>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="label">{t('addFlock.livestockType')}</label>
          <div className="grid grid-cols-4 gap-2">
            {LIVESTOCK_TYPES.map((lt) => (
              <button
                key={lt.id}
                type="button"
                onClick={() => setLivestockType(lt.id)}
                className={`p-2.5 rounded-xl border-2 text-center transition ${
                  livestockType === lt.id
                    ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300'
                    : 'border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800'
                }`}
              >
                <div className="text-2xl leading-none">{lt.emoji}</div>
                <div className="text-[11px] mt-1 font-medium">{t(lt.labelKey)}</div>
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label">{t('addFlock.name')}</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('addFlock.namePh')} autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">{t('addFlock.count')}</label>
            <input className="input" type="number" min="1" inputMode="numeric" value={initialCount} onChange={(e) => setInitialCount(e.target.value)} placeholder="50" />
          </div>
          <div>
            <label className="label">{t('addFlock.unitPrice')}</label>
            <input className="input" type="number" min="0" inputMode="decimal" step="0.01" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} placeholder="10000" />
          </div>
        </div>
        <div>
          <label className="label">{t('addFlock.totalAuto')}</label>
          <input
            className="input bg-stone-100 dark:bg-stone-800 cursor-not-allowed"
            type="text"
            value={buyPrice ? buyPrice.toLocaleString() : ''}
            readOnly
            tabIndex={-1}
          />
        </div>
        <div>
          <label className="label">{t('addFlock.buyDate')}</label>
          <input className="input" type="date" value={buyDate} onChange={(e) => setBuyDate(e.target.value)} />
        </div>
        <div>
          <label className="label">{t('addFlock.initialAvgWeight')}</label>
          <input
            className="input"
            type="number" min="0" inputMode="decimal" step="0.1"
            value={initialAvgWeight}
            onChange={(e) => setInitialAvgWeight(e.target.value)}
            placeholder="35.0"
          />
          <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            {t('addFlock.initialAvgWeightHint')}
          </div>
        </div>
        <div>
          <label className="label">{t('addFlock.notes')}</label>
          <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('addFlock.notesPh')} />
        </div>
        {error && <div className="alert-error">{error}</div>}
        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">{t('common.cancel')}</button>
          <button type="submit" disabled={busy} className="btn-primary flex-1">{busy ? t('common.saving') : isEdit ? t('common.saveChanges') : t('addFlock.save.new')}</button>
        </div>
      </form>
    </ModalShell>
  )
}

export function ModalShell({ children, onClose, title }) {
  const { t } = useLocale()
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end sm:place-items-center bg-black/50 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="modal-sheet relative bg-white dark:bg-stone-900 w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-5 pt-7 sm:pt-5 max-h-[92vh] overflow-y-auto shadow-xl"
        style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800" aria-label={t('common.cancel')}>
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}