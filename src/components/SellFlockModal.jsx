import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLocale } from '../context/LocaleContext'
import { ModalShell } from './AddFlockModal'
import {
  liveSheepCount, currentCostPerSheep, totalInvested, breakEvenPrice,
  currentAvgWeight, totalInvestmentRecovered, totalRevenue,
} from '../utils/calculations'
import { formatMoney } from '../utils/format'
import { addSale, updateFlock, subscribeExpenses, subscribeWeights, subscribeSales } from '../hooks/useFirestore'

// New selling modal: lets the user pick between selling the entire flock at
// once, or selling a selected quantity at a per-sheep price. Both flows record
// an immutable entry in the `sales` collection so historical figures never
// change when future expenses are added (costPerSheepAtSale is frozen).
export default function SellFlockModal({ flock, onClose, onComplete }) {
  const { user } = useAuth()
  const { t } = useLocale()
  const [expenses, setExpenses] = useState([])
  const [weights, setWeights] = useState([])
  const [priorSales, setPriorSales] = useState([])

  const [mode, setMode] = useState('full') // 'full' | 'partial' | 'weight'

  // Common
  const [saleDate, setSaleDate] = useState(new Date().toISOString().slice(0, 10))

  // Full sale
  const [totalPrice, setTotalPrice] = useState('')

  // Partial sale
  const [quantity, setQuantity] = useState('')
  const [pricePerSheep, setPricePerSheep] = useState('')

  // Weight sale (KG-based)
  const [weightQty, setWeightQty] = useState('')
  const [avgWeight, setAvgWeight] = useState('')
  const [pricePerKg, setPricePerKg] = useState('')

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!user) return
    const u1 = subscribeExpenses(user.uid, setExpenses, flock.id)
    const u2 = subscribeWeights(user.uid, setWeights, flock.id)
    const u3 = subscribeSales(user.uid, setPriorSales, flock.id)
    return () => { u1(); u2(); u3() }
  }, [user, flock.id])

  // Latest recorded weight for this flock (falls back to initialAvgWeight,
  // then 0). Used to pre-fill the weight-mode input.
  const latestWeight = currentAvgWeight(flock, weights)

  // Reset mode-specific fields when switching so stale values don't leak.
  // On entering weight mode, default avgWeight to the latest record so the
  // user can confirm the auto-filled value or override it.
  useEffect(() => {
    setError(null)
    if (mode === 'full') {
      setQuantity(''); setPricePerSheep('')
      setWeightQty(''); setAvgWeight(''); setPricePerKg('')
    } else if (mode === 'partial') {
      setWeightQty(''); setAvgWeight(''); setPricePerKg('')
    } else if (mode === 'weight') {
      setQuantity(''); setPricePerSheep('')
      // Pre-fill once when switching INTO weight mode; user can still edit.
      setAvgWeight(latestWeight > 0 ? String(latestWeight) : '')
      setWeightQty(''); setPricePerKg('')
    }
  // latestWeight intentionally omitted so re-renders don't overwrite edits.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  const live = liveSheepCount(flock, expenses)
  const cps  = currentCostPerSheep(flock, expenses, priorSales)
  const totalInvestedNow = totalInvested(flock, expenses)
  const bep  = breakEvenPrice(flock, expenses, priorSales)
  // Investment not yet recovered by earlier sales of this flock. The sale that
  // CLOSES the flock (the whole flock, or the last remaining animals) carries
  // all of it, so a flock's sales always add up to revenue − total invested.
  // Before this, selling the rest after a partial sale charged the full
  // investment a second time and recorded a large false loss.
  const unrecovered = Math.max(0, totalInvestedNow - totalInvestmentRecovered(priorSales))

  // Live preview numbers — recomputed on every keystroke.
  const preview = useMemo(() => {
    if (mode === 'full') {
      const tp = Number(totalPrice || 0)
      const revenue = tp
      const investment = unrecovered
      const profit = revenue - investment
      const qty = live
      return {
        quantity: qty, revenue, investment, profit,
        pricePerSheep: live ? revenue / qty : 0,
        avgWeight: 0, totalWeight: 0, pricePerKg: 0,
      }
    }
    if (mode === 'partial') {
      const q = Number(quantity || 0)
      const pps = Number(pricePerSheep || 0)
      const revenue = q * pps
      const investment = q > 0 && q >= live ? unrecovered : cps * q
      const profit = revenue - investment
      return {
        quantity: q, revenue, investment, profit,
        pricePerSheep: pps,
        avgWeight: 0, totalWeight: 0, pricePerKg: 0,
      }
    }
    // weight mode: revenue = quantity × avgWeight × pricePerKg
    const q = Number(weightQty || 0)
    const w = Number(avgWeight || 0)
    const ppk = Number(pricePerKg || 0)
    const totalWeight = q * w
    const revenue = totalWeight * ppk
    const investment = q > 0 && q >= live ? unrecovered : cps * q
    const profit = revenue - investment
    return {
      quantity: q, revenue, investment, profit,
      pricePerSheep: q ? revenue / q : 0,
      avgWeight: w, totalWeight, pricePerKg: ppk,
    }
  }, [mode, totalPrice, quantity, pricePerSheep, weightQty, avgWeight, pricePerKg, live, cps, unrecovered])

  const submit = async (e) => {
    e.preventDefault()
    setError(null)

    // Validations
    if (mode === 'full') {
      if (!totalPrice || Number(totalPrice) < 0) return setError(t('sell.errPrice'))
    } else if (mode === 'partial') {
      const q = Number(quantity)
      const p = Number(pricePerSheep)
      if (!q || q < 1)                return setError(t('sell.errQty'))
      if (q > live)                   return setError(t('sell.errQtyExceed', { live }))
      if (p < 0 || Number.isNaN(p))  return setError(t('sell.errPrice'))
    } else if (mode === 'weight') {
      const q = Number(weightQty)
      const w = Number(avgWeight)
      const ppk = Number(pricePerKg)
      if (!q || q < 1)              return setError(t('sell.errQty'))
      if (q > live)                 return setError(t('sell.errQtyExceed', { live }))
      if (!w || w <= 0)             return setError(t('sell.errWeight'))
      if (!ppk || ppk <= 0)         return setError(t('sell.errPricePerKg'))
    }

    setBusy(true)
    try {
      // 1. Persist the immutable sale record. Schema is shared across modes
      //    with mode-specific extras (totalPrice for 'full', weight fields for
      //    'weight'). Defaults: saleMethod='QUANTITY' for full/partial,
      //    'WEIGHT' for the weight mode.
      const saleRecord = {
        flockId: flock.id,
        flockName: flock.name,
        saleType: mode,                // 'full' | 'partial' | 'weight'
        saleMethod: mode === 'weight' ? 'WEIGHT' : 'QUANTITY',
        quantitySold: preview.quantity,
        pricePerSheep: mode === 'partial'
          ? Number(pricePerSheep)
          : mode === 'weight'
            ? preview.pricePerSheep
            : (live ? Number(totalPrice) / live : 0),
        totalPrice: mode === 'full' ? Number(totalPrice) : null,
        costPerSheepAtSale: cps,        // FROZEN at the moment of sale
        investmentCost: preview.investment,
        revenue: preview.revenue,
        profit: preview.profit,
        saleDate,
        // Weight-only extras — kept null for non-weight sales so the field
        // shape is consistent across the collection.
        avgWeight:   mode === 'weight' ? Number(avgWeight)  : null,
        totalWeight: mode === 'weight' ? preview.totalWeight : null,
        pricePerKg:  mode === 'weight' ? Number(pricePerKg) : null,
      }
      await addSale(user.uid, saleRecord)

      // 2. Update the flock to reflect the new state.
      const newSoldCount = Number(flock.soldCount || 0) + preview.quantity
      const remainingLive = live - preview.quantity
      const flockUpdate = { soldCount: newSoldCount }

      if (mode === 'full' || remainingLive <= 0) {
        // Flock is fully sold. Record the legacy fields too so other parts
        // of the app (currentValue, Sold flocks dashboard section) keep working.
        Object.assign(flockUpdate, {
          status: 'sold',
          soldDate: saleDate,
          // Everything the flock was sold for, across all of its sales.
          soldPrice: totalRevenue(priorSales) + preview.revenue,
          soldCount: Number(flock.initialCount || 0) - (expenses.filter((e) => e.flockId === flock.id && e.type === 'death').reduce((s, e) => s + Number(e.sheepLost || 0), 0)),
        })
      }
      await updateFlock(user.uid, flock.id, flockUpdate)

      onComplete?.()
      onClose()
    } catch (err) {
      console.error('SellFlockModal save error:', err)
      // Surface the real Firebase error code if we have one — much more
      // useful than a generic "try again" message when rules are missing.
      const code = err && (err.code || (err.error && err.error.code))
      let msg = t('sell.errSave')
      if (code === 'permission-denied' || /permission/i.test(String(err.message || ''))) {
        msg = t('sell.errPermission')
      } else if (code === 'unavailable' || /network|offline/i.test(String(err.message || ''))) {
        msg = t('sell.errNetwork')
      } else if (err && err.message) {
        msg = `${msg} (${err.code || err.message})`
      }
      setError(msg)
    } finally {
      setBusy(false)
    }
  }

  const profitPositive = preview.profit >= 0

  return (
    <ModalShell onClose={onClose} title={t('sell.title', { name: flock.name })}>
      <form onSubmit={submit} className="space-y-4">
        {/* Quick stats about the flock right now */}
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="bg-stone-50 dark:bg-stone-800 rounded-xl p-2">
            <div className="text-stone-500 dark:text-stone-400">{t('sell.live')}</div>
            <div className="font-bold text-base">{live}</div>
          </div>
          <div className="bg-stone-50 dark:bg-stone-800 rounded-xl p-2">
            <div className="text-stone-500 dark:text-stone-400">{t('sell.costSheep')}</div>
            <div className="font-bold text-base">{formatMoney(cps)}</div>
          </div>
          <div className="bg-stone-50 dark:bg-stone-800 rounded-xl p-2">
            <div className="text-stone-500 dark:text-stone-400">{t('sell.invested')}</div>
            <div className="font-bold text-base">{formatMoney(totalInvestedNow)}</div>
          </div>
        </div>

        {/* Mode selector — three options: full, by quantity, by weight (KG) */}
        <div>
          <label className="label">{t('sell.mode')}</label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setMode('full')}
              className={`p-3 rounded-xl border-2 text-start transition ${
                mode === 'full'
                  ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300'
                  : 'border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800'
              }`}
            >
              <div className="font-semibold text-sm">{t('sell.full')}</div>
              <div className="text-[11px] opacity-70 mt-0.5">{t('sell.fullHint')}</div>
            </button>
            <button
              type="button"
              onClick={() => setMode('partial')}
              className={`p-3 rounded-xl border-2 text-start transition ${
                mode === 'partial'
                  ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300'
                  : 'border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800'
              }`}
            >
              <div className="font-semibold text-sm">{t('sell.partial')}</div>
              <div className="text-[11px] opacity-70 mt-0.5">{t('sell.partialHint', { live })}</div>
            </button>
            <button
              type="button"
              onClick={() => setMode('weight')}
              className={`p-3 rounded-xl border-2 text-start transition ${
                mode === 'weight'
                  ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300'
                  : 'border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800'
              }`}
            >
              <div className="font-semibold text-sm">{t('sell.weight')}</div>
              <div className="text-[11px] opacity-70 mt-0.5">{t('sell.weightHint')}</div>
            </button>
          </div>
        </div>

        {/* Inputs */}
        {mode === 'full' && (
          <div>
            <label className="label">{t('sell.totalPrice')}</label>
            <input
              className="input"
              type="number" min="0" inputMode="decimal" step="0.01"
              value={totalPrice} onChange={(e) => setTotalPrice(e.target.value)}
              placeholder={`${Math.round(unrecovered)}`} autoFocus
            />
            <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">
              {t('sell.fullHintBreakEven', { bep: formatMoney(bep), live })}
            </div>
          </div>
        )}

        {mode === 'partial' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">{t('sell.quantity')}</label>
                <input
                  className="input"
                  type="number" min="1" max={live} inputMode="numeric"
                  value={quantity} onChange={(e) => setQuantity(e.target.value)}
                  placeholder={`1 - ${live}`} autoFocus
                />
              </div>
              <div>
                <label className="label">{t('sell.pricePerSheep')}</label>
                <input
                  className="input"
                  type="number" min="0" inputMode="decimal" step="0.01"
                  value={pricePerSheep} onChange={(e) => setPricePerSheep(e.target.value)}
                  placeholder={formatMoney(bep)}
                />
              </div>
            </div>
            <div className="text-xs text-stone-500 dark:text-stone-400">
              {t('sell.partialHintBreakEven', { bep: formatMoney(bep) })}
            </div>
          </>
        )}

        {mode === 'weight' && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">{t('sell.quantity')}</label>
                <input
                  className="input"
                  type="number" min="1" max={live} inputMode="numeric"
                  value={weightQty} onChange={(e) => setWeightQty(e.target.value)}
                  placeholder={`1 - ${live}`} autoFocus
                />
              </div>
              <div>
                <label className="label">{t('sell.avgWeight')}</label>
                <input
                  className="input"
                  type="number" min="0" inputMode="decimal" step="0.1"
                  value={avgWeight} onChange={(e) => setAvgWeight(e.target.value)}
                  placeholder="35.0"
                />
              </div>
              <div>
                <label className="label">{t('sell.pricePerKg')}</label>
                <input
                  className="input"
                  type="number" min="0" inputMode="decimal" step="0.01"
                  value={pricePerKg} onChange={(e) => setPricePerKg(e.target.value)}
                  placeholder="1500"
                />
              </div>
            </div>
            <div className="text-xs text-stone-500 dark:text-stone-400">
              {t('sell.weightHintBreakEven', { bep: formatMoney(bep) })}
            </div>
          </>
        )}

        <div>
          <label className="label">{t('sell.date')}</label>
          <input className="input" type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} />
        </div>

        {/* Live calculation summary */}
        <div className={`p-3 rounded-xl border ${
          profitPositive
            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-100 dark:border-emerald-900'
            : 'bg-red-50 dark:bg-red-950/40 border-red-100 dark:border-red-900'
        }`}>
          <div className="text-xs font-medium uppercase tracking-wide opacity-70 mb-2">
            {t('sell.summary')}
          </div>
          <ul className="space-y-1 text-sm">
            <li className="flex justify-between">
              <span className="opacity-80">{t('sell.summ.quantity')}</span>
              <span className="font-semibold">{preview.quantity}</span>
            </li>
            {mode === 'weight' ? (
              <>
                <li className="flex justify-between">
                  <span className="opacity-80">{t('sell.summ.avgWeight')}</span>
                  <span className="font-semibold">{preview.avgWeight} KG</span>
                </li>
                <li className="flex justify-between">
                  <span className="opacity-80">{t('sell.summ.totalWeight')}</span>
                  <span className="font-semibold">{preview.totalWeight.toFixed(2)} KG</span>
                </li>
                <li className="flex justify-between">
                  <span className="opacity-80">{t('sell.summ.pricePerKg')}</span>
                  <span className="font-semibold">{formatMoney(preview.pricePerKg)}</span>
                </li>
              </>
            ) : (
              <li className="flex justify-between">
                <span className="opacity-80">{t('sell.summ.pricePerSheep')}</span>
                <span className="font-semibold">{formatMoney(preview.pricePerSheep)}</span>
              </li>
            )}
            <li className="flex justify-between">
              <span className="opacity-80">{t('sell.summ.revenue')}</span>
              <span className="font-semibold">{formatMoney(preview.revenue)}</span>
            </li>
            <li className="flex justify-between">
              <span className="opacity-80">{t('sell.summ.investment')}</span>
              <span className="font-semibold">{formatMoney(preview.investment)}</span>
            </li>
            <li className={`flex justify-between text-base pt-1 border-t border-current/10 ${profitPositive ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-400'}`}>
              <span className="font-semibold">{profitPositive ? t('sell.summ.profit') : t('sell.summ.loss')}</span>
              <span className="font-bold">
                {profitPositive ? '+' : ''}{formatMoney(preview.profit)}
              </span>
            </li>
          </ul>
        </div>

        {error && <div className="alert-error">{error}</div>}

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">{t('common.cancel')}</button>
          <button type="submit" disabled={busy} className="btn-primary flex-1">
            {busy ? t('common.saving') : t('sell.confirm')}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}