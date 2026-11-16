import { useEffect, useState } from 'react'
import { History, Trash2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useLocale } from '../context/LocaleContext'
import { subscribeSales, deleteSale, getFlock, updateFlock } from '../hooks/useFirestore'
import { formatMoney, formatDate } from '../utils/format'

// Sales history for a single flock. Optionally pass flockId=null to render
// the same component as an all-flocks list (Reports page).
export default function SalesHistory({ flockId = null, compact = false }) {
  const { user } = useAuth()
  const { t } = useLocale()
  const [sales, setSales] = useState([])

  useEffect(() => {
    if (!user) return
    const unsub = subscribeSales(user.uid, setSales, flockId || undefined)
    return unsub
  }, [user, flockId])

  const saleTypeKey = (s) => {
    if (s.saleType === 'full')   return 'sell.full'
    if (s.saleType === 'weight') return 'sell.weight'
    return 'sell.partial'
  }

  const onDelete = async (s) => {
    if (!confirm(t('sales.deleteQ', { type: t(saleTypeKey(s)), qty: s.quantitySold }))) return
    await deleteSale(user.uid, s.id)
    // A deleted sale never happened: put its animals back in the flock, and
    // reopen the flock if that sale had closed it. Without this the animals
    // stayed counted as sold with no sale behind them.
    const flock = await getFlock(user.uid, s.flockId)
    if (!flock) return
    const patch = {
      soldCount: Math.max(0, Number(flock.soldCount || 0) - Number(s.quantitySold || 0)),
    }
    if (flock.status === 'sold') Object.assign(patch, { status: 'active', soldPrice: null, soldDate: null })
    await updateFlock(user.uid, s.flockId, patch)
  }

  if (sales.length === 0) {
    return (
      <div className="text-center py-6 text-stone-500 text-sm">
        <History className="w-5 h-5 mx-auto mb-1 opacity-50" />
        {flockId ? t('sales.emptyFlock') : t('sales.emptyAll')}
      </div>
    )
  }

  return (
    <ul className={compact ? 'space-y-2' : 'divide-y divide-stone-100 dark:divide-stone-800'}>
      {sales.map((s) => {
        const positive = s.profit >= 0
        return (
          <li key={s.id} className={compact ? 'flex items-start gap-3 p-3 rounded-xl bg-stone-50 dark:bg-stone-800/50' : 'py-3 flex items-start gap-3'}>
            <div className={`w-9 h-9 rounded-xl grid place-items-center shrink-0 text-xs font-bold ${
              positive ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                      : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
            }`}>
              {positive ? '+' : '−'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm">
                  {t(saleTypeKey(s))}
                </span>
                {s.saleMethod === 'WEIGHT' && (
                  <span className="badge bg-sky-100 dark:bg-sky-900/40 text-sky-800 dark:text-sky-300 text-[10px]">KG</span>
                )}
                {!flockId && (
                  <span className="text-sm text-stone-700 dark:text-stone-300 font-medium truncate">
                    {s.flockName}
                  </span>
                )}
                <span className={`badge ${positive ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200' : 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200'}`}>
                  {positive ? '+' : ''}{formatMoney(s.profit)}
                </span>
              </div>
              <div className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 grid grid-cols-2 sm:grid-cols-4 gap-x-3">
                <span>{formatDate(s.saleDate)}</span>
                <span>{t('sales.sold')}: {s.quantitySold}</span>
                <span>{t('sales.cps')}: {formatMoney(s.costPerSheepAtSale)}</span>
                <span>{t('sales.revenue')}: {formatMoney(s.revenue)}</span>
                {s.saleMethod === 'WEIGHT' && s.totalWeight != null && (
                  <span className="col-span-2 sm:col-span-4">
                    {t('sell.summ.totalWeight')}: {Number(s.totalWeight).toFixed(2)} KG ·{' '}
                    {t('sell.summ.pricePerKg')}: {formatMoney(s.pricePerKg)} ·{' '}
                    {t('sell.summ.avgWeight')}: {s.avgWeight} KG
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => onDelete(s)}
              className="p-1.5 rounded text-stone-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-stone-100 dark:hover:bg-stone-800"
              title={t('common.delete')}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </li>
        )
      })}
    </ul>
  )
}