import { useEffect, useMemo, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList,
  PieChart, Pie,
} from 'recharts'
import { TrendingUp, TrendingDown, Trophy, ArrowDownCircle, BarChart3, Receipt, History } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useLocale } from '../context/LocaleContext'
import { subscribeFlocks, subscribeExpenses, subscribeSales } from '../hooks/useFirestore'
import { expenseBreakdown, portfolioTotals, visibleFlocks, EXPENSE_TYPES } from '../utils/calculations'
import { LIVESTOCK_TYPES, livestockEmoji } from '../utils/livestock'
import { formatMoney, formatDate } from '../utils/format'
import { useExpenseTypes } from '../hooks/useExpenseTypes'
import SalesHistory from '../components/SalesHistory'

// Custom dark-mode-aware tooltip
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg px-3 py-2 shadow-lg text-sm">
      {label && <div className="font-medium mb-0.5">{label}</div>}
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: p.payload.color || p.color }} />
        <span className="text-stone-500 dark:text-stone-400">{p.name || label}:</span>
        <span className="font-bold">{formatMoney(p.value)}</span>
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, hint, tone = 'neutral' }) {
  const tones = {
    neutral: 'bg-white dark:bg-stone-900 border-stone-100 dark:border-stone-800 text-stone-900 dark:text-stone-100',
    profit:  'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-100 dark:border-emerald-900 text-emerald-900 dark:text-emerald-200',
    loss:    'bg-red-50 dark:bg-red-950/40 border-red-100 dark:border-red-900 text-red-900 dark:text-red-200',
    warn:    'bg-amber-50 dark:bg-amber-950/40 border-amber-100 dark:border-amber-900 text-amber-900 dark:text-amber-200',
  }
  return (
    <div className={`rounded-2xl border p-4 ${tones[tone]}`}>
      <div className="flex items-center gap-2 text-sm opacity-80">
        <Icon className="w-4 h-4" /> {label}
      </div>
      <div className="mt-1.5 text-2xl font-bold">{value}</div>
      {hint && <div className="text-xs opacity-70 mt-0.5">{hint}</div>}
    </div>
  )
}

export default function Reports() {
  const { user } = useAuth()
  const { t } = useLocale()
  const types = useExpenseTypes()
  const [flocks, setFlocks] = useState([])
  const [expenses, setExpenses] = useState([])
  const [sales, setSales] = useState([])
  const [scope, setScope] = useState('all')
  // Livestock-type filter pills: 'ALL' or one of SHEEP/GOAT/COW/CAMEL.
  const [typeFilter, setTypeFilter] = useState('ALL')

  useEffect(() => {
    if (!user) return
    const u1 = subscribeFlocks(user.uid, setFlocks)
    const u2 = subscribeExpenses(user.uid, setExpenses)
    const u3 = subscribeSales(user.uid, setSales)
    return () => { u1(); u2(); u3() }
  }, [user])

  const visible = useMemo(() => {
    const base = visibleFlocks(flocks)
    if (typeFilter === 'ALL') return base
    // Legacy flocks (created before livestockType existed) are treated as SHEEP
    // so the Sheep filter still matches them — matches the default elsewhere.
    return base.filter((f) => (f.livestockType || 'SHEEP') === typeFilter)
  }, [flocks, typeFilter])
  const visibleIds = useMemo(() => new Set(visible.map((f) => f.id)), [visible])
  const scopedExpenses = useMemo(
    () => expenses.filter((e) => visibleIds.has(e.flockId)),
    [expenses, visibleIds]
  )
  const flockId = scope === 'all' ? null : scope
  const scopedToFlock = useMemo(
    () => flockId ? scopedExpenses.filter((e) => e.flockId === flockId) : scopedExpenses,
    [scopedExpenses, flockId]
  )

  // Sorted, ready-to-render category breakdown (biggest first)
  const breakdown = useMemo(() => {
    const arr = expenseBreakdown(scopedToFlock, null)
    return arr
      .filter((b) => b.value > 0)
      .sort((a, b) => b.value - a.value)
  }, [scopedToFlock])

  const totals = portfolioTotals(visible, scopedExpenses)
  const totalExpenses = breakdown.reduce((s, b) => s + b.value, 0)
  const biggest = breakdown[0] || null
  const biggestPct = biggest ? (biggest.value / totalExpenses) * 100 : 0

  // Top 5 single expenses
  const topExpenses = useMemo(() => {
    return [...scopedToFlock]
      .sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))
      .slice(0, 5)
  }, [scopedToFlock])

  const flockById = useMemo(() => Object.fromEntries(visible.map((f) => [f.id, f])), [visible])
  const hasData = breakdown.length > 0

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-brand-600" /> {t('rep.title')}
        </h1>
        <p className="text-sm text-stone-500 dark:text-stone-400">{t('rep.subtitle')}</p>
      </div>

      {/* Livestock type filter pills — applies BEFORE the empty check so the
          user can switch types even when one type has no data. */}
      <div className="card !py-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-stone-500 dark:text-stone-400 shrink-0">
            {t('rep.livestockFilter')}:
          </span>
          <div className="flex bg-stone-100 dark:bg-stone-800 rounded-xl p-1 overflow-x-auto">
            <button
              onClick={() => { setTypeFilter('ALL'); setScope('all') }}
              className={`px-3 py-1.5 text-sm rounded-lg font-medium whitespace-nowrap ${
                typeFilter === 'ALL'
                  ? 'bg-white dark:bg-stone-700 shadow-sm text-stone-900 dark:text-stone-100'
                  : 'text-stone-500 dark:text-stone-400'
              }`}
            >
              {t('rep.allTypes')}
            </button>
            {LIVESTOCK_TYPES.map((lt) => (
              <button
                key={lt.id}
                onClick={() => { setTypeFilter(lt.id); setScope('all') }}
                className={`px-3 py-1.5 text-sm rounded-lg font-medium whitespace-nowrap flex items-center gap-1 ${
                  typeFilter === lt.id
                    ? 'bg-white dark:bg-stone-700 shadow-sm text-stone-900 dark:text-stone-100'
                    : 'text-stone-500 dark:text-stone-400'
                }`}
              >
                <span aria-hidden="true">{lt.emoji}</span>
                <span>{t(lt.labelKey)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {!hasData ? (
        <div className="card text-center py-16">
          <Receipt className="w-10 h-10 mx-auto text-stone-300 dark:text-stone-700" />
          <p className="mt-3 text-stone-500">{t('rep.empty')}</p>
        </div>
      ) : (
        <>
          {/* Scope selector */}
          <div className="card !py-3">
            <div className="flex items-center gap-3 flex-wrap">
              <label className="text-sm text-stone-500 dark:text-stone-400 shrink-0">{t('rep.scope')}:</label>
              <select className="input flex-1 min-w-0" value={scope} onChange={(e) => setScope(e.target.value)}>
                <option value="all">{t('rep.allFlocks')}</option>
                {visible.map((f) => (
                  <option key={f.id} value={f.id}>{livestockEmoji(f)} {f.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Insight card: biggest expense category */}
          {biggest && (
            <div className="card bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/40 dark:to-stone-900 border-amber-200 dark:border-amber-900">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 text-sm">
                <Trophy className="w-4 h-4" /> {t('rep.biggestCategory')}
              </div>
              <div className="mt-2 flex items-end justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-3xl font-bold text-amber-900 dark:text-amber-200 flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ background: biggest.color }} />
                    {biggest.label}
                  </div>
                  <div className="text-sm text-amber-800/80 dark:text-amber-300/80 mt-0.5">
                    {formatMoney(biggest.value)} · {biggestPct.toFixed(1)}% {t('rep.ofTotal')}
                  </div>
                </div>
                <div className="text-end">
                  <div className="text-xs text-amber-800/70 dark:text-amber-300/70">{t('rep.totalLabel')}</div>
                  <div className="text-xl font-bold text-amber-900 dark:text-amber-200">{formatMoney(totalExpenses)}</div>
                </div>
              </div>
            </div>
          )}

          {/* Stat cards: total expenses + profit + net position */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              icon={ArrowDownCircle}
              label={t('rep.totalExpenses')}
              value={formatMoney(totalExpenses)}
              hint={`${scopedToFlock.length} ${t('exp.stat.entries').toLowerCase()}`}
              tone="warn"
            />
            <StatCard
              icon={totals.profit >= 0 ? TrendingUp : TrendingDown}
              label={totals.profit >= 0 ? t('rep.profit') : t('rep.loss')}
              value={formatMoney(totals.profit)}
              hint={`${totals.roi.toFixed(1)}% ROI`}
              tone={totals.profit >= 0 ? 'profit' : 'loss'}
            />
          </div>

          {/* Bar chart — horizontal, sorted descending. Clearly shows which is biggest. */}
          <div className="card">
            <h2 className="font-semibold mb-1">{t('rep.barTitle')}</h2>
            <p className="text-xs text-stone-500 dark:text-stone-400 mb-3">{t('rep.barSubtitle')}</p>
            <div style={{ width: '100%', height: Math.max(200, breakdown.length * 56) }}>
              <ResponsiveContainer>
                <BarChart
                  data={breakdown}
                  layout="vertical"
                  margin={{ top: 5, right: 50, bottom: 5, left: 0 }}
                >
                  <XAxis type="number" hide tick={{ fontSize: 11 }} stroke="currentColor" />
                  <YAxis
                    dataKey="label"
                    type="category"
                    width={88}
                    tick={{ fontSize: 12 }}
                    stroke="currentColor"
                  />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'transparent' }} />
                  <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={26}>
                    {breakdown.map((b) => (
                      <Cell key={b.type} fill={b.color} />
                    ))}
                    <LabelList
                      dataKey="value"
                      position="right"
                      formatter={(v) => formatMoney(v)}
                      style={{ fontSize: 11, fill: 'currentColor' }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Category list with progress bars */}
          <div className="card">
            <h2 className="font-semibold mb-3">{t('rep.categoryBreakdown')}</h2>
            <ul className="space-y-3">
              {breakdown.map((b) => {
                const pct = totalExpenses ? (b.value / totalExpenses) * 100 : 0
                return (
                  <li key={b.type}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: b.color }} />
                        <span className="font-medium">{b.label}</span>
                        {b.type === biggest?.type && (
                          <span className="badge bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200">{t('rep.highest')}</span>
                        )}
                      </div>
                      <div className="text-end">
                        <span className="font-semibold">{formatMoney(b.value)}</span>
                        <span className="text-xs text-stone-500 dark:text-stone-400 ms-1">({pct.toFixed(0)}%)</span>
                      </div>
                    </div>
                    <div className="h-2 bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: b.color }}
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>

          {/* Top 5 single expenses */}
          <div className="card">
            <h2 className="font-semibold mb-3">{t('rep.topExpenses')}</h2>
            <ul className="divide-y divide-stone-100 dark:divide-stone-800">
              {topExpenses.map((e, i) => {
                const meta = types.find((tt) => tt.id === e.type)
                const flock = flockById[e.flockId]
                return (
                  <li key={e.id} className="py-2.5 flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full grid place-items-center text-xs font-bold bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 shrink-0">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        <span className="inline-block w-2 h-2 rounded-full me-1.5 align-middle" style={{ background: meta?.color }} />
                        {meta?.label}
                        {flock && <span className="text-stone-500 dark:text-stone-400 font-normal"> · {flock.name}</span>}
                      </div>
                      <div className="text-xs text-stone-500 dark:text-stone-400">{formatDate(e.date)}</div>
                    </div>
                    <div className="font-bold shrink-0">{formatMoney(e.amount)}</div>
                  </li>
                )
              })}
            </ul>
          </div>

          {/* Donut chart — compact visual breakdown */}
          <div className="card">
            <h2 className="font-semibold mb-3">{t('rep.donutTitle')}</h2>
            <div className="relative" style={{ width: '100%', height: 240 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={breakdown}
                    dataKey="value"
                    nameKey="label"
                    innerRadius={60}
                    outerRadius={95}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {breakdown.map((b, i) => <Cell key={i} fill={b.color} />)}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              {/* Center label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <div className="text-xs text-stone-500 dark:text-stone-400">{t('rep.totalLabel')}</div>
                <div className="text-lg font-bold">{formatMoney(totalExpenses)}</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 justify-center mt-3">
              {breakdown.map((b) => (
                <div key={b.type} className="flex items-center gap-1.5 text-xs">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: b.color }} />
                  <span>{b.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Sales history — all sales across flocks (or scope-filtered) */}
          <div className="card">
            <div className="flex items-center gap-2 mb-3">
              <History className="w-4 h-4" />
              <h2 className="font-semibold">{t('sales.allSalesTitle')}</h2>
            </div>
            <SalesHistory flockId={flockId || null} />
          </div>
        </>
      )}
    </div>
  )
}