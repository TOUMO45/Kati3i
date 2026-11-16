import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLocale } from '../context/LocaleContext'
import { ModalShell } from './AddFlockModal'
import { addWeight } from '../hooks/useFirestore'

// Records a new "average weight" snapshot for a flock. The latest record is
// used everywhere as the flock's current avg weight, so this is the primary
// way the user keeps the per-KG cost and weight-based sales accurate.
export default function AddWeightModal({ flockId, onClose }) {
  const { user } = useAuth()
  const { t } = useLocale()
  const today = new Date().toISOString().slice(0, 10)

  const [avgWeight, setAvgWeight] = useState('')
  const [date, setDate] = useState(today)
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    const w = Number(avgWeight)
    if (!w || w <= 0) return setError(t('weight.errWeight'))
    setBusy(true)
    try {
      await addWeight(user.uid, {
        flockId,
        avgWeight: w,
        date,
        notes: notes.trim() || null,
      })
      onClose()
    } catch {
      setError(t('weight.errSave'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalShell onClose={onClose} title={t('weight.add')}>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="label">{t('weight.avgWeight')}</label>
          <input
            className="input"
            type="number" min="0" inputMode="decimal" step="0.1"
            value={avgWeight} onChange={(e) => setAvgWeight(e.target.value)}
            placeholder="35.0" autoFocus
          />
        </div>
        <div>
          <label className="label">{t('weight.date')}</label>
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className="label">{t('weight.notes')}</label>
          <textarea
            className="input" rows={2}
            value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder={t('weight.notesPh')}
          />
        </div>
        {error && <div className="alert-error">{error}</div>}
        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">{t('common.cancel')}</button>
          <button type="submit" disabled={busy} className="btn-primary flex-1">
            {busy ? t('common.saving') : t('weight.save')}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}
