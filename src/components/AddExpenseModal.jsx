import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { addExpense, updateExpense, getFlock, subscribeExpenses, subscribeSales } from '../hooks/useFirestore'
import { useLocale } from '../context/LocaleContext'
import { useExpenseTypes } from '../hooks/useExpenseTypes'
import { ModalShell } from './AddFlockModal'
import { currentCostPerSheep } from '../utils/calculations'

export default function AddExpenseModal({ flockId, expense, onClose, onSaved, initialType }) {
  const { user } = useAuth()
  const { t } = useLocale()
  const types = useExpenseTypes()
  const isEdit = !!expense
  const today = new Date().toISOString().slice(0, 10)

  const [type, setType] = useState(expense?.type || initialType || 'food')
  const [amount, setAmount] = useState(expense?.amount ?? (initialType === 'death' ? '0' : ''))
  const [date, setDate] = useState(expense?.date || today)
  const [sheepLost, setSheepLost] = useState(expense?.sheepLost ?? '')
  const [note, setNote] = useState(expense?.note || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [flock, setFlock] = useState(null)
  const [flockExpenses, setFlockExpenses] = useState([])
  const [flockSales, setFlockSales] = useState([])

  const isDeath = type === 'death'

  useEffect(() => {
    if (!user?.uid || !flockId) return
    let cancelled = false
    getFlock(user.uid, flockId).then((f) => { if (!cancelled) setFlock(f) })
    const unsub = subscribeExpenses(user.uid, setFlockExpenses, flockId)
    const unsubSales = subscribeSales(user.uid, setFlockSales, flockId)
    return () => { cancelled = true; unsub?.(); unsubSales?.() }
  }, [user?.uid, flockId])

  // When editing a death record, exclude that record itself from the cost basis
  // so the displayed per-animal cost matches what it was at the moment the
  // expense was created (otherwise editing would feed the value back into itself).
  const expensesForCost = isEdit
    ? flockExpenses.filter((e) => e.id !== expense?.id)
    : flockExpenses
  const currentPrice = flock ? currentCostPerSheep(flock, expensesForCost, flockSales) : 0
  const deathAmount = isDeath ? (Number(sheepLost) || 0) * currentPrice : 0

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    if (isDeath) {
      if (!sheepLost || sheepLost < 1) return setError(t('addExp.errLost'))
    } else if (!amount || amount < 0) {
      return setError(t('addExp.errAmount'))
    }
    setBusy(true)
    try {
      const payload = {
        flockId,
        type,
        amount: isDeath ? Number(deathAmount.toFixed(2)) : Number(amount),
        date,
        note: note.trim(),
        sheepLost: isDeath ? Number(sheepLost) : 0,
      }
      if (isEdit) await updateExpense(user.uid, expense.id, payload)
      else await addExpense(user.uid, payload)
      onSaved?.()
      onClose()
    } catch {
      setError(t('addExp.errSave'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalShell onClose={onClose} title={isEdit ? t('addExp.title.edit') : t('addExp.title.new')}>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="label">{t('addExp.type')}</label>
          <div className="grid grid-cols-6 gap-1.5">
            {types.map((tt) => (
              <button
                key={tt.id}
                type="button"
                onClick={() => setType(tt.id)}
                className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border text-[11px] sm:text-xs font-medium transition ${
                  type === tt.id
                    ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300'
                    : 'border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: tt.color }} />
                {tt.label}
              </button>
            ))}
          </div>
        </div>

        {isDeath ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label text-red-700 dark:text-red-400">{t('addExp.sheepLost')}</label>
                <input
                  className="input border-red-200 focus:ring-red-500"
                  type="number" min="1" inputMode="numeric"
                  value={sheepLost}
                  onChange={(e) => setSheepLost(e.target.value)}
                  placeholder="1"
                  autoFocus
                />
              </div>
              <div>
                <label className="label">{t('addExp.currentPrice')}</label>
                <input
                  className="input bg-stone-100 dark:bg-stone-800 cursor-not-allowed"
                  type="text"
                  value={currentPrice ? currentPrice.toLocaleString(undefined, { maximumFractionDigits: 2 }) : ''}
                  readOnly
                  tabIndex={-1}
                />
              </div>
            </div>
            <div className="text-xs text-stone-500 -mt-1">{t('addExp.sheepLostHint')}</div>
            <div>
              <label className="label">{t('addExp.deathLoss')}</label>
              <input
                className="input bg-stone-100 dark:bg-stone-800 cursor-not-allowed"
                type="text"
                value={deathAmount ? deathAmount.toLocaleString(undefined, { maximumFractionDigits: 2 }) : ''}
                readOnly
                tabIndex={-1}
              />
            </div>
            <div>
              <label className="label">{t('addExp.date')}</label>
              <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t('addExp.amount')}</label>
              <input className="input" type="number" min="0" inputMode="decimal" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" autoFocus />
            </div>
            <div>
              <label className="label">{t('addExp.date')}</label>
              <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
        )}

        <div>
          <label className="label">{t('addExp.note')}</label>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder={isDeath ? t('addExp.noteDeathPh') : t('addExp.notePh')} />
        </div>

        {error && <div className="alert-error">{error}</div>}

        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">{t('common.cancel')}</button>
          <button type="submit" disabled={busy} className="btn-primary flex-1">{busy ? t('common.saving') : isEdit ? t('common.saveChanges') : t('common.save')}</button>
        </div>
      </form>
    </ModalShell>
  )
}