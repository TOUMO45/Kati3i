import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Plus, TrendingUp, TrendingDown, Wallet, Layers, Skull, ArrowRight,
  Pencil, Trash2, Receipt, CircleDollarSign, Wheat, Pill, Truck, Droplet,
  MoreHorizontal, HandCoins, Archive, ArchiveRestore, Eye, Calendar, Coins,
  ChevronRight, Activity, BarChart3, Sparkles, Users, Scale, HardHat,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useLocale } from '../context/LocaleContext'
import {
  subscribeFlocks, subscribeExpenses, subscribeSales, subscribeWeights,
  deleteFlock, deleteExpense, updateFlock,
  setFlockArchived,
} from '../hooks/useFirestore'
import {
  portfolioTotals, totalInvested, currentValue, realizedProfit,
  unrealizedProfit, roi, liveSheepCount, holdingDays, visibleFlocks,
  isArchived, currentCostPerSheep,
  totalLiveWeight, currentAvgWeight,
} from '../utils/calculations'
import { livestockEmoji } from '../utils/livestock'
import { formatMoney, formatDate } from '../utils/format'
import { useExpenseTypes } from '../hooks/useExpenseTypes'
import AddFlockModal from '../components/AddFlockModal'
import AddExpenseModal from '../components/AddExpenseModal'
import FlockPickerModal from '../components/FlockPickerModal'
import SellFlockModal from '../components/SellFlockModal'

const TYPE_ICON = {
  food: Wheat, water: Droplet, medicine: Pill, transport: Truck,
  worker: HardHat, death: Skull, other: MoreHorizontal,
}

function StatCard({ icon: Icon, label, value, hint, tone = 'neutral', size = 'md' }) {
  const tones = {
    neutral: 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-stone-900 dark:text-stone-100',
    profit:  'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900 text-emerald-900 dark:text-emerald-200',
    loss:    'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900 text-red-900 dark:text-red-200',
    brand:   'bg-brand-50 dark:bg-brand-950/30 border-brand-200 dark:border-brand-900 text-brand-900 dark:text-brand-200',
    warn:    'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200',
    info:    'bg-sky-50 dark:bg-sky-950/30 border-sky-200 dark:border-sky-900 text-sky-900 dark:text-sky-200',
  }
  const valueSize = size === 'lg' ? 'text-3xl' : 'text-xl'
  return (
    <div className={`rounded-2xl border p-4 ${tones[tone]} transition-colors`}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider opacity-70">
        <Icon className="w-3.5 h-3.5" />
        <span>{label}</span>
      </div>
      <div className={`mt-1.5 ${valueSize} font-bold`}>{value}</div>
      {hint && <div className="text-xs opacity-70 mt-0.5">{hint}</div>}
    </div>
  )
}

function FlockActions({ flock }) {
  const { user } = useAuth()
  const { t } = useLocale()
  const [editing, setEditing] = useState(false)
  const [addingExp, setAddingExp] = useState(false)
  const [selling, setSelling] = useState(false)

  const onDelete = async (e) => {
    e.preventDefault(); e.stopPropagation()
    if (!confirm(t('confirm.deleteFlockQ', { name: flock.name }))) return
    try {
      await deleteFlock(user.uid, flock.id)
    } catch (err) {
      console.error('deleteFlock failed:', err)
      const code = err?.code || err?.message || 'unknown error'
      alert(`Delete failed: ${code}`)
    }
  }
  const onEdit = (e) => { e.preventDefault(); e.stopPropagation(); setEditing(true) }
  const onAddExp = (e) => { e.preventDefault(); e.stopPropagation(); setAddingExp(true) }
  const onSell = (e) => { e.preventDefault(); e.stopPropagation(); setSelling(true) }

  return (
    <>
      <div className="flex flex-col items-end gap-1 shrink-0">
        {flock.status !== 'sold' && (
          <button
            onClick={onSell}
            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-900/60 flex items-center gap-1"
            title={t('detail.markSold')}
          >
            <HandCoins className="w-3.5 h-3.5" /> {t('detail.markSold')}
          </button>
        )}
        <div className="flex items-center gap-0.5">
          {flock.status !== 'sold' && (
            <button onClick={onAddExp} className="p-1.5 rounded text-stone-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-stone-100 dark:hover:bg-stone-800" title={t('dash.addExpense')}>
              <CircleDollarSign className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={onEdit} className="p-1.5 rounded text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800" title={t('common.edit')}>
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={onDelete} className="p-1.5 rounded text-stone-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-stone-100 dark:hover:bg-stone-800" title={t('common.delete')}>
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {editing   && <AddFlockModal flock={flock} onClose={() => setEditing(false)} />}
      {addingExp && <AddExpenseModal flockId={flock.id} onClose={() => setAddingExp(false)} />}
      {selling   && (
        <SellFlockModal
          flock={flock}
          onClose={() => setSelling(false)}
          onComplete={() => setSelling(false)}
        />
      )}
    </>
  )
}

function SoldFlockCard({ flock, expenses }) {
  const { user } = useAuth()
  const { t } = useLocale()
  const [restoring, setRestoring] = useState(false)
  const invested = totalInvested(flock, expenses)
  const flockExpenses = expenses.filter((e) => e.flockId === flock.id)
  const expenseCount = flockExpenses.length
  const expenseTotal = flockExpenses.reduce((s, e) => s + Number(e.amount || 0), 0)
  const soldPrice = Number(flock.soldPrice || 0)
  const profit = realizedProfit(flock, expenses)
  const r = roi(flock, expenses)
  const days = holdingDays(flock)
  const positive = profit >= 0

  const onArchive = async (e) => {
    e.preventDefault(); e.stopPropagation()
    if (!confirm(t('flocks.archiveQ', { name: flock.name }))) return
    await setFlockArchived(user.uid, flock.id, true)
  }
  const onRestore = async (e) => {
    e.preventDefault(); e.stopPropagation()
    if (!confirm(t('flocks.unarchiveQ', { name: flock.name }))) return
    setRestoring(true)
    await setFlockArchived(user.uid, flock.id, false)
    setRestoring(false)
  }

  return (
    <li className={`card ${isArchived(flock) ? 'opacity-70' : ''}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xl leading-none" aria-hidden="true">{livestockEmoji(flock)}</span>
            <h3 className="font-semibold truncate">{flock.name}</h3>
            <span className="badge bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300">{t('detail.sold')}</span>
            {isArchived(flock) && (
              <span className="badge bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200">{t('flocks.archived')}</span>
            )}
          </div>
        </div>
        <div className={`text-end shrink-0 px-3 py-1 rounded-xl ${positive ? 'bg-emerald-50 dark:bg-emerald-950/40' : 'bg-red-50 dark:bg-red-950/40'}`}>
          <div className="text-xs opacity-70">{positive ? t('flocks.profit') : t('flocks.loss')}</div>
          <div className={`text-lg font-bold ${positive ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
            {formatMoney(profit)}
          </div>
          <div className={`text-xs ${positive ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>{r.toFixed(1)}% ROI</div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        <div className="bg-stone-50 dark:bg-stone-800 rounded-lg p-2">
          <div className="text-stone-500 dark:text-stone-400">{t('flocks.buy')}</div>
          <div className="font-semibold mt-0.5">{formatDate(flock.buyDate)}</div>
          <div className="text-stone-500 dark:text-stone-400 mt-0.5">{formatMoney(flock.buyPrice)}</div>
        </div>
        <div className="bg-stone-50 dark:bg-stone-800 rounded-lg p-2">
          <div className="text-stone-500 dark:text-stone-400">{t('flocks.expenses')}</div>
          <div className="font-semibold mt-0.5">{expenseCount}</div>
          <div className="text-stone-500 dark:text-stone-400 mt-0.5">{formatMoney(expenseTotal)}</div>
        </div>
        <div className="bg-stone-50 dark:bg-stone-800 rounded-lg p-2">
          <div className="text-stone-500 dark:text-stone-400">{t('flocks.sale')}</div>
          <div className="font-semibold mt-0.5">{formatDate(flock.soldDate)}</div>
          <div className="text-stone-500 dark:text-stone-400 mt-0.5">{formatMoney(soldPrice)}</div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 text-xs text-stone-500 dark:text-stone-400 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {t('flocks.duration', { n: days })}</span>
          <span className="flex items-center gap-1"><Coins className="w-3 h-3" /> {t('flocks.invested')}: {formatMoney(invested)}</span>
        </div>
        <div className="flex items-center gap-2">
          <Link to={`/flocks/${flock.id}`} className="text-brand-700 dark:text-brand-400 hover:underline font-medium flex items-center gap-1">
            <Eye className="w-3.5 h-3.5" /> {t('common.seeAll')}
          </Link>
          {!isArchived(flock) ? (
            <button
              onClick={onArchive}
              className="px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700 font-medium flex items-center gap-1"
            >
              <Archive className="w-3.5 h-3.5" /> {t('flocks.archive')}
            </button>
          ) : (
            <button
              onClick={onRestore}
              disabled={restoring}
              className="px-2.5 py-1 rounded-lg bg-brand-100 dark:bg-brand-900/40 text-brand-800 dark:text-brand-300 hover:bg-brand-200 dark:hover:bg-brand-900/60 font-medium flex items-center gap-1 disabled:opacity-50"
            >
              <ArchiveRestore className="w-3.5 h-3.5" /> {t('flocks.unarchive')}
            </button>
          )}
        </div>
      </div>
    </li>
  )
}

function SectionHeader({ icon: Icon, title }) {
  return (
    <div className="flex items-center gap-2 px-1">
      <Icon className="w-4 h-4 text-stone-400" />
      <h2 className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider">{title}</h2>
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const { t } = useLocale()
  const types = useExpenseTypes()
  const [flocks, setFlocks] = useState([])
  const [expenses, setExpenses] = useState([])
  const [sales, setSales] = useState([])
  const [weights, setWeights] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickedFlock, setPickedFlock] = useState(null)

  useEffect(() => {
    if (!user) return
    const u1 = subscribeFlocks(user.uid, setFlocks)
    const u2 = subscribeExpenses(user.uid, setExpenses)
    const u3 = subscribeSales(user.uid, setSales)
    const u4 = subscribeWeights(user.uid, setWeights)
    return () => { u1(); u2(); u3(); u4() }
  }, [user])

  const visible = useMemo(() => visibleFlocks(flocks), [flocks])
  const totals = portfolioTotals(visible, expenses, sales)
  const totalExpensesOnly = useMemo(
    () => expenses
      .filter((e) => visible.some((f) => f.id === e.flockId))
      .reduce((s, e) => s + Number(e.amount || 0), 0),
    [expenses, visible]
  )
  const buyPriceTotal = useMemo(
    () => visible.reduce((s, f) => s + Number(f.buyPrice || 0), 0),
    [visible]
  )
  const activeFlocks = useMemo(() => visible.filter((f) => f.status !== 'sold'), [visible])
  const soldFlocks   = useMemo(() => visible.filter((f) => f.status === 'sold'), [visible])
  const archivedCount = flocks.length - visible.length

  // Animal & weight aggregates across active flocks.
  // - totalAnimals: sum of every flock's *original* count (gives a stable
  //   "size of operation" figure that doesn't shrink as you sell).
  // - liveWeightAll: Σ (currentAvgWeight × liveAnimals) per flock.
  // - costPerKgAll : Σ totalInvested / Σ live weight (weighted across flocks).
  const totalAnimals = useMemo(
    () => activeFlocks.reduce((s, f) => s + Number(f.initialCount || 0), 0),
    [activeFlocks]
  )
  const liveWeightAll = useMemo(
    () => activeFlocks.reduce((s, f) => s + totalLiveWeight(f, expenses, weights), 0),
    [activeFlocks, expenses, weights]
  )
  const investedActive = useMemo(
    () => activeFlocks.reduce((s, f) => s + totalInvested(f, expenses), 0),
    [activeFlocks, expenses]
  )
  const costPerKgAll = liveWeightAll > 0 ? investedActive / liveWeightAll : 0
  const anyFlockHasWeight = activeFlocks.some((f) => currentAvgWeight(f, weights) > 0)

  const activeFlockIds = useMemo(() => new Set(activeFlocks.map((f) => f.id)), [activeFlocks])
  const recentExpenses = useMemo(
    () => expenses.filter((e) => activeFlockIds.has(e.flockId)).slice(0, 6),
    [expenses, activeFlockIds]
  )

  // Hero trend indicator
  const trendUp = totals.profit >= 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-brand-600" /> {t('dash.title')}
          </h1>
          <p className="text-sm text-stone-500 dark:text-stone-400">{t('dash.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => activeFlocks.length === 1 ? setPickedFlock(activeFlocks[0]) : setPickerOpen(true)}
            disabled={activeFlocks.length === 0}
            className="btn-secondary"
            title={t('dash.addExpense')}
          >
            <Receipt className="w-4 h-4" /> {t('dash.expense')}
          </button>
          <button onClick={() => setShowAdd(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> {t('dash.newFlock')}
          </button>
        </div>
      </div>

      {/* Hero card */}
      <div className={`card relative overflow-hidden p-5 sm:p-6 ${
        trendUp
          ? 'bg-gradient-to-br from-emerald-50 via-white to-brand-50 dark:from-emerald-950/40 dark:via-stone-900 dark:to-brand-950/40 border-emerald-200 dark:border-emerald-900'
          : 'bg-gradient-to-br from-red-50 via-white to-stone-50 dark:from-red-950/40 dark:via-stone-900 dark:to-stone-900 border-red-200 dark:border-red-900'
      }`}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider opacity-70">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{t('dash.hero.label')}</span>
            </div>
            <div className={`text-3xl sm:text-4xl font-bold mt-1 ${trendUp ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>
              {formatMoney(totals.totalValue)}
            </div>
            <div className={`text-sm mt-1 font-medium ${trendUp ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>
              {trendUp ? '+' : ''}{formatMoney(totals.profit)} · {totals.roi.toFixed(1)}% ROI
            </div>
          </div>
          <div className="text-end">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <div className="text-stone-500 dark:text-stone-400">{t('dash.hero.sheep')}</div>
              <div className="font-semibold text-end">{totals.sheepTotal}</div>
              <div className="text-stone-500 dark:text-stone-400">{t('dash.hero.active')}</div>
              <div className="font-semibold text-end">{totals.activeCount}</div>
              <div className="text-stone-500 dark:text-stone-400">{t('dash.hero.sold')}</div>
              <div className="font-semibold text-end">{totals.soldCount}</div>
              {archivedCount > 0 && (
                <>
                  <div className="text-stone-500 dark:text-stone-400">{t('dash.hero.archived')}</div>
                  <div className="font-semibold text-end">{archivedCount}</div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Performance — just Invested + Expenses. Profit lives in the hero
          card above (no duplicate "0 د.ج · 0% ROI" row). */}
      <div className="space-y-2">
        <SectionHeader icon={Activity} title={t('dash.section.performance')} />
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            icon={Wallet}
            label={t('dash.stat.invested')}
            value={formatMoney(totals.totalInvested)}
            hint={t('dash.hint.buySplit', { buy: formatMoney(buyPriceTotal) })}
          />
          <StatCard
            icon={Receipt}
            label={t('dash.stat.expenses')}
            value={formatMoney(totalExpensesOnly)}
            hint={t('dash.hint.entries', { n: expenses.filter((e) => visible.some((f) => f.id === e.flockId)).length })}
            tone="warn"
          />
        </div>
      </div>

      {/* Inventory — one full-width card with live / original / sold rolled
          into a single hint. When the user has actual weight data we add a
          second row with total live weight and cost / KG. */}
      <div className="space-y-2">
        <SectionHeader icon={Users} title={t('dash.section.inventory')} />
        <StatCard
          icon={Layers}
          label={t('dash.stat.inventory')}
          value={`${totals.sheepTotal} / ${totalAnimals}`}
          hint={t('dash.hint.inventory', {
            live: totals.sheepTotal,
            total: totalAnimals,
            sold: totals.totalSheepSold,
          })}
          size="md"
        />
        {anyFlockHasWeight && (
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              icon={Scale}
              label={t('dash.stat.totalLiveWeight')}
              value={`${liveWeightAll.toFixed(2)} KG`}
              hint={t('dash.hint.totalLiveWeight', { n: totals.sheepTotal })}
              tone="info"
            />
            <StatCard
              icon={Sparkles}
              label={t('dash.stat.costPerKg')}
              value={formatMoney(costPerKgAll)}
              hint={t('dash.hint.costPerKg')}
              tone="warn"
            />
          </div>
        )}
      </div>

      {/* Sales performance — only the two figures that actually mean something
          before any sale exists. Unsold investment value duplicated Invested
          when no sales had been recorded, so it's gone. */}
      <div className="space-y-2">
        <SectionHeader icon={HandCoins} title={t('dash.section.sales')} />
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            icon={HandCoins}
            label={t('dash.stat.revenue')}
            value={formatMoney(totals.totalRevenue)}
            hint={t('dash.hint.revenue', { n: sales.length })}
            tone="profit"
          />
          <StatCard
            icon={totals.realized >= 0 ? TrendingUp : TrendingDown}
            label={t('dash.stat.realizedProfit')}
            value={formatMoney(totals.realized)}
            hint={t('dash.hint.realized', { n: totals.totalSheepSold })}
            tone={totals.realized >= 0 ? 'profit' : 'loss'}
          />
        </div>
      </div>

      {/* Per-animal cost — single card with weighted-avg + per-flock breakdown.
          Cost-per-animal and break-even price are the same number by definition,
          so they no longer get separate cards. When 2+ flocks are active, each
          one's own cost-per-animal is listed so the average makes sense. */}
      {activeFlocks.length > 0 && (
        <div className="space-y-2">
          <SectionHeader icon={Layers} title={t('dash.section.cost')} />
          <div className="card">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-3">
              <Layers className="w-3.5 h-3.5" />
              <span>{t('dash.stat.costPerSheep')}</span>
            </div>
            {activeFlocks.length === 1 ? (
              // Single flock: show the per-animal cost as one big number —
              // there's nothing to "compare", so a list of one row would be
              // visual noise.
              (() => {
                const f = activeFlocks[0]
                return (
                  <div className="flex items-center justify-between gap-2">
                    <Link to={`/flocks/${f.id}`} className="flex items-center gap-1.5 min-w-0 hover:underline">
                      <span className="text-xl leading-none" aria-hidden="true">{livestockEmoji(f)}</span>
                      <span className="truncate font-medium">{f.name}</span>
                    </Link>
                    <span className="text-2xl font-bold tabular-nums shrink-0">
                      {formatMoney(currentCostPerSheep(f, expenses))}
                    </span>
                  </div>
                )
              })()
            ) : (
              // 2+ flocks: list each one with its own cost. No aggregate /
              // weighted-average number — that was the source of confusion.
              <ul className="space-y-2">
                {activeFlocks.map((f) => {
                  const cps = currentCostPerSheep(f, expenses)
                  return (
                    <li key={f.id} className="flex items-center justify-between gap-2 text-sm">
                      <Link to={`/flocks/${f.id}`} className="flex items-center gap-1.5 min-w-0 hover:underline">
                        <span className="text-base leading-none" aria-hidden="true">{livestockEmoji(f)}</span>
                        <span className="truncate font-medium">{f.name}</span>
                      </Link>
                      <span className="font-semibold tabular-nums shrink-0">{formatMoney(cps)}</span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Active flocks */}
      <div className="card">
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <h2 className="font-semibold">{t('dash.active.title')}</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={() => activeFlocks.length === 1 ? setPickedFlock(activeFlocks[0]) : setPickerOpen(true)}
              disabled={activeFlocks.length === 0}
              className="text-sm text-brand-700 dark:text-brand-400 font-medium flex items-center gap-1 disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" /> {t('dash.addExpense')}
            </button>
            <Link to="/flocks" className="text-sm text-stone-500 dark:text-stone-400 font-medium flex items-center gap-1">
              {t('common.seeAll')} <ChevronRight className="w-4 h-4 rtl:rotate-180" />
            </Link>
          </div>
        </div>
        {activeFlocks.length === 0 ? (
          <div className="text-center py-8 text-stone-500">
            <p>{t('dash.active.empty')}</p>
            <button onClick={() => setShowAdd(true)} className="mt-3 btn-primary">
              <Plus className="w-4 h-4" /> {t('dash.active.emptyCta')}
            </button>
          </div>
        ) : (
          <ul className="space-y-3">
            {activeFlocks.slice(0, 5).map((f) => {
              const live     = liveSheepCount(f, expenses)
              const invested = totalInvested(f, expenses)
              const cps      = currentCostPerSheep(f, expenses)
              const value    = currentValue(f, expenses)
              const profit   = unrealizedProfit(f, expenses)
              const r        = roi(f, expenses)
              const positive = profit >= 0
              return (
                <li
                  key={f.id}
                  className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-stone-50/60 dark:bg-stone-800/30 p-3"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <Link to={`/flocks/${f.id}`} className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xl leading-none" aria-hidden="true">{livestockEmoji(f)}</span>
                        <h3 className="font-semibold truncate">{f.name}</h3>
                        <span className="badge bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300">
                          {t('detail.active')}
                        </span>
                      </div>
                      <div className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                        {formatDate(f.buyDate)} · {t('dash.flock.days', { n: holdingDays(f) })}
                      </div>
                    </Link>
                    <FlockActions flock={f} />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                    <div className="bg-white dark:bg-stone-900 rounded-lg p-2 border border-stone-100 dark:border-stone-800">
                      <div className="text-stone-500 dark:text-stone-400">{t('dash.flock.live')}</div>
                      <div className="font-semibold mt-0.5 text-sm">{live} / {f.initialCount}</div>
                    </div>
                    <div className="bg-white dark:bg-stone-900 rounded-lg p-2 border border-stone-100 dark:border-stone-800">
                      <div className="text-stone-500 dark:text-stone-400">{t('dash.flock.invested')}</div>
                      <div className="font-semibold mt-0.5 text-sm">{formatMoney(invested)}</div>
                    </div>
                    <div className="bg-white dark:bg-stone-900 rounded-lg p-2 border border-stone-100 dark:border-stone-800">
                      <div className="text-stone-500 dark:text-stone-400">{t('dash.flock.costPer')}</div>
                      <div className="font-semibold mt-0.5 text-sm">{formatMoney(cps)}</div>
                    </div>
                    <div className={`rounded-lg p-2 border ${
                      positive
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-100 dark:border-emerald-900'
                        : 'bg-red-50 dark:bg-red-950/40 border-red-100 dark:border-red-900'
                    }`}>
                      <div className={positive ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}>
                        {positive ? t('dash.flock.profit') : t('dash.flock.loss')}
                      </div>
                      <div className={`font-semibold mt-0.5 text-sm ${
                        positive ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'
                      }`}>
                        {formatMoney(profit)}
                      </div>
                      <div className={`text-[10px] mt-0.5 ${
                        positive ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'
                      }`}>
                        {r.toFixed(1)}% ROI · {formatMoney(value)}
                      </div>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {showAdd && <AddFlockModal onClose={() => setShowAdd(false)} />}

      {/* Sold flocks */}
      {soldFlocks.length > 0 && (
        <div className="space-y-2">
          <SectionHeader icon={HandCoins} title={t('flocks.soldSection')} />
          <ul className="space-y-3">
            {soldFlocks.map((f) => (
              <SoldFlockCard key={f.id} flock={f} expenses={expenses} />
            ))}
          </ul>
        </div>
      )}

      {/* Recent expenses — only for ACTIVE flocks */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">{t('dash.recent.title')}</h2>
          <Link to="/expenses" className="text-sm text-stone-500 dark:text-stone-400 font-medium flex items-center gap-1">
            {t('common.seeAll')} <ChevronRight className="w-4 h-4 rtl:rotate-180" />
          </Link>
        </div>
        {recentExpenses.length === 0 ? (
          <div className="text-center py-6 text-stone-500 text-sm">
            {activeFlocks.length === 0 ? t('dash.recent.emptyAllDone') : t('dash.recent.empty')}
          </div>
        ) : (
          <ul className="divide-y divide-stone-100 dark:divide-stone-800">
            {recentExpenses.map((e) => {
              const Icon = TYPE_ICON[e.type] || MoreHorizontal
              const meta = types.find((tt) => tt.id === e.type)
              const flock = activeFlocks.find((f) => f.id === e.flockId)
              return (
                <li key={e.id} className="py-2.5 flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-xl grid place-items-center shrink-0"
                    style={{ backgroundColor: `${meta?.color}20`, color: meta?.color }}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {flock
                        ? <Link to={`/flocks/${flock.id}`} className="hover:underline">
                            <span aria-hidden="true">{livestockEmoji(flock)}</span> {flock.name}
                          </Link>
                        : <span className="text-stone-400">{t('exp.deletedFlock')}</span>}
                      <span className="text-stone-400 font-normal"> · {meta?.label}</span>
                    </div>
                    <div className="text-xs text-stone-500 dark:text-stone-400">
                      {formatDate(e.date)}
                      {e.note ? ` · ${e.note}` : ''}
                      {e.type === 'death' && e.sheepLost > 0 && (
                        <span className="text-red-600 dark:text-red-400"> · {t('type.deathNote', { n: e.sheepLost })}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-end shrink-0">
                    <div className="font-semibold">{formatMoney(e.amount)}</div>
                    <button
                      onClick={() => {
                        if (!confirm(t('confirm.deleteExpQ'))) return
                        deleteExpense(user.uid, e.id)
                      }}
                      className="text-xs text-stone-400 hover:text-red-600 dark:hover:text-red-400"
                    >
                      {t('common.delete')}
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {archivedCount > 0 && (
        <div className="text-center text-xs text-stone-400 dark:text-stone-500 pt-2">
          {archivedCount} {archivedCount === 1 ? 'flock' : 'flocks'} {t('flocks.archived').toLowerCase()} ·{' '}
          <Link to="/flocks" className="text-brand-700 dark:text-brand-400 hover:underline">
            {t('common.seeAll')}
          </Link>
        </div>
      )}

      {pickerOpen && (
        <FlockPickerModal
          onPick={(f) => { setPickerOpen(false); setPickedFlock(f) }}
          onClose={() => setPickerOpen(false)}
        />
      )}
      {pickedFlock && (
        <AddExpenseModal
          flockId={pickedFlock.id}
          onClose={() => setPickedFlock(null)}
        />
      )}
    </div>
  )
}