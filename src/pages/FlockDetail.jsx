import { useEffect, useState, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Plus, Wheat, Pill, Truck, Skull, MoreHorizontal, Droplet,
  DollarSign, Trash2, Pencil, History, Layers, Wallet, TrendingUp, TrendingDown,
  Scale, HardHat, FileText,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useLocale } from '../context/LocaleContext'
import {
  subscribeExpenses, subscribeFlocks, subscribeSales, subscribeWeights, updateFlock,
  deleteExpense, deleteFlock,
} from '../hooks/useFirestore'
import {
  totalInvested, currentValue, currentCostPerSheep, breakEvenPrice,
  unsoldInvestmentValue, liveSheepCount, holdingDays,
  flockProfit, flockRevenue, roi,
  totalRealizedProfit, currentAvgWeight, totalLiveWeight, costPerKg,
  totalSheepLost,
} from '../utils/calculations'
import { livestockEmoji, livestockLabelKey } from '../utils/livestock'
import { formatMoney, formatDate } from '../utils/format'
import { useExpenseTypes } from '../hooks/useExpenseTypes'
import AddExpenseModal from '../components/AddExpenseModal'
import AddFlockModal from '../components/AddFlockModal'
import SellFlockModal from '../components/SellFlockModal'
import SalesHistory from '../components/SalesHistory'
import AddWeightModal from '../components/AddWeightModal'
import WeightHistory from '../components/WeightHistory'

const TYPE_ICON = {
  food: Wheat, water: Droplet, medicine: Pill, transport: Truck,
  worker: HardHat, death: Skull, other: MoreHorizontal,
}

function MiniCard({ label, value, hint, tone }) {
  const tones = {
    neutral: 'bg-white dark:bg-stone-900 border-stone-100 dark:border-stone-800 text-stone-900 dark:text-stone-100',
    profit:  'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-100 dark:border-emerald-900 text-emerald-900 dark:text-emerald-200',
    loss:    'bg-red-50 dark:bg-red-950/40 border-red-100 dark:border-red-900 text-red-900 dark:text-red-400',
    warn:    'bg-amber-50 dark:bg-amber-950/40 border-amber-100 dark:border-amber-900 text-amber-900 dark:text-amber-200',
    brand:   'bg-brand-50 dark:bg-brand-950/40 border-brand-100 dark:border-brand-900 text-brand-900 dark:text-brand-200',
  }
  return (
    <div className={`rounded-2xl border p-4 ${tones[tone || 'neutral']}`}>
      <div className="text-xs opacity-80">{label}</div>
      <div className="text-xl font-bold mt-0.5">{value}</div>
      {hint && <div className="text-xs opacity-70 mt-0.5">{hint}</div>}
    </div>
  )
}

// Renders a synthetic "legacy" sale row when a flock was sold (status='sold'
// with soldPrice) but no record exists in the sales collection. Keeps the
// Sales History section useful for flocks sold before the sales collection
// existed or for sales that failed to write a record.
function SyntheticLegacySale({ flock, expenses }) {
  const { t } = useLocale()
  const invested = totalInvested(flock, expenses)
  const soldPrice = Number(flock.soldPrice || 0)
  const profit = soldPrice - invested
  const positive = profit >= 0
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-stone-50 dark:bg-stone-800/50">
      <div className={`w-9 h-9 rounded-xl grid place-items-center shrink-0 text-xs font-bold ${
        positive ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
      }`}>
        {positive ? '+' : '−'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm">{t('sell.full')}</span>
          <span className="badge bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-200 text-[10px]">
            {t('sales.legacy')}
          </span>
          <span className={`badge ${positive ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200' : 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200'}`}>
            {positive ? '+' : ''}{formatMoney(profit)}
          </span>
        </div>
        <div className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
          {formatDate(flock.soldDate)} · {t('sales.revenue')}: {formatMoney(soldPrice)} · {t('sales.invested')}: {formatMoney(invested)}
        </div>
      </div>
    </div>
  )
}

export default function FlockDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const { t } = useLocale()
  const navigate = useNavigate()
  const types = useExpenseTypes()
  const [flocks, setFlocks] = useState([])
  const [expenses, setExpenses] = useState([])
  const [sales, setSales] = useState([])
  const [weights, setWeights] = useState([])
  const [showExpense, setShowExpense] = useState(false)
  const [showSell, setShowSell] = useState(false)
  const [showWeight, setShowWeight] = useState(false)
  const [registerDeath, setRegisterDeath] = useState(false)
  const [editingExpense, setEditingExpense] = useState(null)
  const [editingFlock, setEditingFlock] = useState(false)

  useEffect(() => {
    if (!user) return
    const u1 = subscribeFlocks(user.uid, setFlocks)
    const u2 = subscribeExpenses(user.uid, setExpenses, id)
    const u3 = subscribeSales(user.uid, setSales, id)
    const u4 = subscribeWeights(user.uid, setWeights, id)
    return () => { u1(); u2(); u3(); u4() }
  }, [user, id])

  const flock = flocks.find((f) => f.id === id)
  const flockExpenses = useMemo(() => expenses.filter((e) => e.flockId === id), [expenses, id])

  if (!flock) {
    return (
      <div className="card text-center py-10 text-stone-500">
        <p>{t('detail.loading')}</p>
        <Link to="/flocks" className="btn-secondary mt-4 inline-flex">
          <ArrowLeft className="w-4 h-4 rtl:rotate-180" /> {t('detail.back')}
        </Link>
      </div>
    )
  }

  const live      = liveSheepCount(flock, flockExpenses)
  const invested  = totalInvested(flock, flockExpenses)
  const cps       = currentCostPerSheep(flock, flockExpenses)
  const bep       = breakEvenPrice(flock, flockExpenses)
  const unsoldVal = unsoldInvestmentValue(flock, flockExpenses)
  const value     = currentValue(flock, flockExpenses)
  const flockRealized = totalRealizedProfit(sales)
  const avgWeight = currentAvgWeight(flock, weights)
  const tlw       = totalLiveWeight(flock, flockExpenses, weights)
  const cpkg      = costPerKg(flock, flockExpenses, weights)
  const deathRecords = flockExpenses.filter((e) => e.type === 'death')
  const deathsTotal  = totalSheepLost(flockExpenses, flock.id)
  const flockWeights = weights.filter((w) => w.flockId === flock.id)

  // Profit so far = what this flock's sales earned (unsold animals are carried
  // at cost). Falls back to soldPrice − invested for a legacy sold flock that
  // has no sale records.
  const profit = flockProfit(flock, flockExpenses, sales)
  const r = roi(flock, flockExpenses, sales)

  const onDeleteExpense = async (eid) => {
    if (!confirm(t('detail.deleteExpQ'))) return
    await deleteExpense(user.uid, eid)
  }
  const onDeleteFlock = async () => {
    if (!confirm(t('detail.deleteFlockQ', { name: flock.name }))) return
    try {
      await deleteFlock(user.uid, flock.id)
      navigate('/flocks')
    } catch (err) {
      console.error('deleteFlock failed:', err)
      const code = err?.code || err?.message || 'unknown error'
      alert(`Delete failed: ${code}`)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Link to="/flocks" className="btn-secondary px-3">
          <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
        </Link>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setEditingFlock(true)} className="btn-secondary">
            <Pencil className="w-4 h-4" /> {t('detail.edit')}
          </button>
          <Link
            to={`/flocks/${flock.id}/report`}
            className="btn-secondary"
          >
            <FileText className="w-4 h-4" /> {t('detail.report')}
          </Link>
          {flock.status !== 'sold' && (
            <>
              <button onClick={() => setShowWeight(true)} className="btn-secondary">
                <Scale className="w-4 h-4" /> {t('weight.add')}
              </button>
              <button
                onClick={() => setRegisterDeath(true)}
                className="btn-secondary text-red-700 dark:text-red-300"
              >
                <Skull className="w-4 h-4" /> {t('death.register')}
              </button>
              <button onClick={() => setShowSell(true)} className="btn-primary">
                <DollarSign className="w-4 h-4" /> {t('detail.markSold')}
              </button>
            </>
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-3xl leading-none" aria-hidden="true">{livestockEmoji(flock)}</span>
          <h1 className="text-2xl font-bold">{flock.name}</h1>
          <span className="badge bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300">
            {t(livestockLabelKey(flock))}
          </span>
          <span className={`badge ${
            flock.status === 'sold'
              ? 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300'
              : 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300'
          }`}>
            {flock.status === 'sold' ? t('detail.sold') : t('detail.active')}
          </span>
        </div>
        <p className="text-sm text-stone-500 dark:text-stone-400">
          {t('detail.bought', { date: formatDate(flock.buyDate), n: holdingDays(flock) })}
          {flock.status === 'sold' && flock.soldDate && t('detail.soldOn', { date: formatDate(flock.soldDate) })}
        </p>
      </div>

      <div className={`card ${profit >= 0 ? 'bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/40 dark:to-stone-900' : 'bg-gradient-to-br from-red-50 to-white dark:from-red-950/40 dark:to-stone-900'}`}>
        <div className="text-sm text-stone-500 dark:text-stone-400">
          {t('detail.realized')}
        </div>
        <div className={`text-3xl font-bold ${profit >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
          {formatMoney(profit)}
        </div>
        <div className={`text-sm mt-0.5 ${profit >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
          {r.toFixed(1)}% ROI
        </div>
      </div>

      {/* Investment metrics — current cost per sheep, break-even, unsold value */}
      <div className="grid grid-cols-2 gap-3">
        <MiniCard
          label={t('detail.liveSheep')}
          value={`${live} / ${flock.initialCount}`}
          hint={Number(flock.soldCount || 0) > 0 ? t('detail.soldHint', { n: flock.soldCount }) : null}
        />
        <MiniCard
          label={t('detail.buyPrice')}
          value={formatMoney(flock.buyPrice)}
        />
        <MiniCard
          label={t('detail.totalInvested')}
          value={formatMoney(invested)}
          tone="warn"
        />
        <MiniCard
          label={flock.status === 'sold' ? t('flocks.soldFor') : t('detail.costPerSheep')}
          value={flock.status === 'sold' ? formatMoney(flockRevenue(flock, sales)) : formatMoney(cps)}
          tone="brand"
        />
        <MiniCard
          label={t('detail.breakEven')}
          value={formatMoney(bep)}
          hint={t('detail.breakEvenHint')}
        />
        <MiniCard
          label={t('detail.unsoldValue')}
          value={formatMoney(unsoldVal)}
          hint={t('detail.unsoldValueHint', { n: live })}
        />
      </div>

      {/* Weight metrics — only when we actually have weight data on the flock
          (avoids showing meaningless 0 KG cards for flocks created before
          weight tracking shipped). */}
      {avgWeight > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <MiniCard
            label={t('weight.current')}
            value={`${avgWeight.toFixed(2)} KG`}
            tone="info"
          />
          <MiniCard
            label={t('weight.totalLive')}
            value={`${tlw.toFixed(2)} KG`}
            hint={`${live} × ${avgWeight.toFixed(2)}`}
          />
          <MiniCard
            label={t('weight.costPerKg')}
            value={formatMoney(cpkg)}
            tone="brand"
          />
        </div>
      )}

      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">{t('detail.expenses', { n: flockExpenses.length })}</h2>
          {flock.status !== 'sold' && (
            <button onClick={() => setShowExpense(true)} className="btn-primary px-3 py-2 text-sm">
              <Plus className="w-4 h-4" /> {t('common.add')}
            </button>
          )}
        </div>

        {flockExpenses.length === 0 ? (
          <div className="text-center py-6 text-stone-500 text-sm">{t('detail.noExpenses')}</div>
        ) : (
          <ul className="divide-y divide-stone-100 dark:divide-stone-800">
            {flockExpenses.map((e) => {
              const Icon = TYPE_ICON[e.type] || MoreHorizontal
              const meta = types.find((tt) => tt.id === e.type)
              return (
                <li key={e.id} className="py-3 flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-xl grid place-items-center shrink-0"
                    style={{ backgroundColor: `${meta?.color}20`, color: meta?.color }}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">
                      {meta?.label}
                      {e.type === 'death' && e.sheepLost > 0 && (
                        <span className="text-red-600 dark:text-red-400 text-sm font-normal"> · {t('type.deathNote', { n: e.sheepLost })}</span>
                      )}
                    </div>
                    <div className="text-xs text-stone-500 dark:text-stone-400">
                      {formatDate(e.date)}
                      {e.note ? ` · ${e.note}` : ''}
                    </div>
                  </div>
                  <div className="text-end shrink-0">
                    <div className="font-semibold">{formatMoney(e.amount)}</div>
                    <div className="flex items-center justify-end gap-1 mt-0.5">
                      <button onClick={() => setEditingExpense(e)} className="p-1.5 rounded text-stone-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-stone-100 dark:hover:bg-stone-800" title={t('common.edit')}>
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => onDeleteExpense(e.id)} className="p-1.5 rounded text-stone-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-stone-100 dark:hover:bg-stone-800" title={t('common.delete')}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Weight history — only render the section if the flock has any weight
          data (initial OR at least one record), to avoid clutter for users who
          don't care about weight tracking. */}
      {(avgWeight > 0 || flockWeights.length > 0) && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold flex items-center gap-2">
              <Scale className="w-4 h-4" /> {t('weight.title')}
            </h2>
            {flock.status !== 'sold' && (
              <button onClick={() => setShowWeight(true)} className="btn-primary px-3 py-2 text-sm">
                <Plus className="w-4 h-4" /> {t('common.add')}
              </button>
            )}
          </div>
          <WeightHistory weights={flockWeights} />
        </div>
      )}

      {/* Death history — dedicated view of all death records for this flock.
          Each row mirrors the relevant fields from the underlying death
          expense (date, count lost, optional reason). Hidden when no deaths
          have been recorded so it doesn't take up space unnecessarily. */}
      {deathRecords.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold flex items-center gap-2">
              <Skull className="w-4 h-4 text-red-600 dark:text-red-400" />
              {t('death.history')}
            </h2>
            <span className="badge bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200">
              {t('death.totalLost', { n: deathsTotal })}
            </span>
          </div>
          <ul className="divide-y divide-stone-100 dark:divide-stone-800">
            {deathRecords.map((e) => (
              <li key={e.id} className="py-2.5 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl grid place-items-center shrink-0 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">
                  <Skull className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">
                    {t('type.deathNote', { n: e.sheepLost || 0 })}
                  </div>
                  <div className="text-xs text-stone-500 dark:text-stone-400">
                    {formatDate(e.date)}{e.note ? ` · ${e.note}` : ''}
                  </div>
                </div>
                <div className="text-end shrink-0 text-xs">
                  {Number(e.amount) > 0 && (
                    <span className="text-stone-500 dark:text-stone-400">{formatMoney(e.amount)}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Sales history for this flock. If no real sales exist but the flock
          was marked sold (e.g. sold before the sales collection existed, or
          via a previous version of the modal), synthesize a "legacy" entry
          from the flock's status='sold' + soldPrice + soldDate fields. */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold flex items-center gap-2">
            <History className="w-4 h-4" /> {t('sales.title')}
          </h2>
          {flockRealized !== 0 && (
            <span className={`badge ${flockRealized >= 0 ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200' : 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200'}`}>
              {t('sales.flockProfit')}: {flockRealized >= 0 ? '+' : ''}{formatMoney(flockRealized)}
            </span>
          )}
        </div>
        {sales.length === 0 && flock.status === 'sold' && Number(flock.soldPrice || 0) > 0 ? (
          <SyntheticLegacySale flock={flock} expenses={flockExpenses} />
        ) : (
          <SalesHistory flockId={id} />
        )}
      </div>

      {flock.notes && (
        <div className="card">
          <div className="text-xs text-stone-500 dark:text-stone-400 mb-1">{t('detail.notes')}</div>
          <div className="text-sm whitespace-pre-wrap">{flock.notes}</div>
        </div>
      )}

      <button onClick={onDeleteFlock} className="text-xs text-stone-400 hover:text-red-600 mx-auto block">
        {t('detail.deleteFlock')}
      </button>

      {showExpense && <AddExpenseModal flockId={id} onClose={() => setShowExpense(false)} />}
      {editingExpense && (
        <AddExpenseModal
          flockId={id}
          expense={editingExpense}
          onClose={() => setEditingExpense(null)}
        />
      )}
      {editingFlock && <AddFlockModal flock={flock} onClose={() => setEditingFlock(false)} />}
      {showSell && (
        <SellFlockModal
          flock={flock}
          onClose={() => setShowSell(false)}
          onComplete={() => setShowSell(false)}
        />
      )}
      {showWeight && (
        <AddWeightModal
          flockId={flock.id}
          onClose={() => setShowWeight(false)}
        />
      )}
      {/* "Register Death" reuses AddExpenseModal pre-filled with type='death'
          so we keep one code path for storing death events (they're still
          expense records — that's how the underlying calculations work). */}
      {registerDeath && (
        <AddExpenseModal
          flockId={flock.id}
          initialType="death"
          onClose={() => setRegisterDeath(false)}
        />
      )}
    </div>
  )
}