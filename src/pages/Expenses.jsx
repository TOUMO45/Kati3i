import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Pencil, Trash2, Wheat, Pill, Truck, Skull, MoreHorizontal, Droplet, Filter } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useLocale } from '../context/LocaleContext'
import { subscribeFlocks, subscribeExpenses, deleteExpense } from '../hooks/useFirestore'
import { formatMoney, formatDate } from '../utils/format'
import { useExpenseTypes } from '../hooks/useExpenseTypes'
import AddExpenseModal from '../components/AddExpenseModal'

const TYPE_ICON = {
  food: Wheat, water: Droplet, medicine: Pill, transport: Truck, death: Skull, other: MoreHorizontal,
}

export default function Expenses() {
  const { user } = useAuth()
  const { t } = useLocale()
  const types = useExpenseTypes()
  const [flocks, setFlocks] = useState([])
  const [expenses, setExpenses] = useState([])
  const [editing, setEditing] = useState(null)

  const [query, setQuery] = useState('')
  const [flockFilter, setFlockFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [sortBy, setSortBy] = useState('date')
  const [sortDir, setSortDir] = useState('desc')

  useEffect(() => {
    if (!user) return
    const u1 = subscribeFlocks(user.uid, setFlocks)
    const u2 = subscribeExpenses(user.uid, setExpenses)
    return () => { u1(); u2() }
  }, [user])

  const flockById = useMemo(() => {
    const m = {}
    for (const f of flocks) m[f.id] = f
    return m
  }, [flocks])

  const filtered = useMemo(() => {
    const out = expenses
      .filter((e) => flockFilter === 'all' || e.flockId === flockFilter)
      .filter((e) => typeFilter === 'all' || e.type === typeFilter)
      .filter((e) => {
        if (!query) return true
        const flockName = (flockById[e.flockId]?.name || '').toLowerCase()
        const note = (e.note || '').toLowerCase()
        return flockName.includes(query.toLowerCase()) || note.includes(query.toLowerCase())
      })
    out.sort((a, b) => {
      let cmp
      if (sortBy === 'date') cmp = (a.date || '').localeCompare(b.date || '')
      else cmp = Number(a.amount || 0) - Number(b.amount || 0)
      return sortDir === 'asc' ? cmp : -cmp
    })
    return out
  }, [expenses, flockFilter, typeFilter, query, sortBy, sortDir, flockById])

  const totalAmount = filtered.reduce((s, e) => s + Number(e.amount || 0), 0)
  const deathLosses = filtered.filter((e) => e.type === 'death')
  const totalSheepLost = deathLosses.reduce((s, e) => s + Number(e.sheepLost || 0), 0)
  const topCategory = useMemo(() => {
    const counts = {}
    for (const e of filtered) counts[e.type] = (counts[e.type] || 0) + Number(e.amount || 0)
    let best = null, bestV = 0
    for (const [k, v] of Object.entries(counts)) if (v > bestV) { best = k; bestV = v }
    return best ? types.find((x) => x.id === best) : null
  }, [filtered, types])

  const onDelete = async (e) => {
    if (!confirm(t('confirm.deleteExpQ'))) return
    await deleteExpense(user.uid, e.id)
  }

  const toggleSort = (col) => {
    if (sortBy === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortBy(col); setSortDir('desc') }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{t('exp.title')}</h1>
        <p className="text-sm text-stone-500 dark:text-stone-400">{t('exp.subtitle')}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card">
          <div className="text-xs text-stone-500 dark:text-stone-400">{t('exp.stat.total')}</div>
          <div className="text-xl font-bold">{formatMoney(totalAmount)}</div>
        </div>
        <div className="card">
          <div className="text-xs text-stone-500 dark:text-stone-400">{t('exp.stat.entries')}</div>
          <div className="text-xl font-bold">{filtered.length}</div>
        </div>
        <div className="card">
          <div className="text-xs text-stone-500 dark:text-stone-400">{t('exp.stat.sheepLost')}</div>
          <div className="text-xl font-bold text-red-700 dark:text-red-400">{totalSheepLost}</div>
        </div>
        <div className="card">
          <div className="text-xs text-stone-500 dark:text-stone-400">{t('exp.stat.topCat')}</div>
          <div className="text-xl font-bold" style={{ color: topCategory?.color }}>
            {topCategory?.label || '—'}
          </div>
        </div>
      </div>

      <div className="card space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            className="input ps-9"
            placeholder={t('exp.searchPh')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <select className="input" value={flockFilter} onChange={(e) => setFlockFilter(e.target.value)}>
            <option value="all">{t('exp.allFlocks')}</option>
            {flocks.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
          <select className="input" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="all">{t('exp.allTypes')}</option>
            {types.map((tt) => (
              <option key={tt.id} value={tt.id}>{tt.label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
          <Filter className="w-3.5 h-3.5" />
          <span>{t('exp.sort')}</span>
          <button onClick={() => toggleSort('date')}   className={`px-2 py-1 rounded ${sortBy === 'date'   ? 'bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 font-medium' : ''}`}>{t('exp.sortDate')}</button>
          <button onClick={() => toggleSort('amount')} className={`px-2 py-1 rounded ${sortBy === 'amount' ? 'bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 font-medium' : ''}`}>{t('exp.sortAmount')}</button>
          <span className="opacity-60">({sortDir === 'asc' ? '↑' : '↓'})</span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card text-center py-12 text-stone-500">
          {expenses.length === 0 ? t('exp.empty') : t('exp.emptyFilter')}
        </div>
      ) : (
        <>
          <div className="hidden md:block card !p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 dark:bg-stone-800 text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400">
                <tr>
                  <th className="text-start px-4 py-3 font-medium">{t('exp.col.date')}</th>
                  <th className="text-start px-4 py-3 font-medium">{t('exp.col.flock')}</th>
                  <th className="text-start px-4 py-3 font-medium">{t('exp.col.type')}</th>
                  <th className="text-start px-4 py-3 font-medium">{t('exp.col.note')}</th>
                  <th className="text-end px-4 py-3 font-medium">{t('exp.col.amount')}</th>
                  <th className="text-end px-4 py-3 font-medium w-24">{t('exp.col.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                {filtered.map((e) => {
                  const Icon = TYPE_ICON[e.type] || MoreHorizontal
                  const meta = types.find((x) => x.id === e.type)
                  const flock = flockById[e.flockId]
                  return (
                    <tr key={e.id} className="hover:bg-stone-50 dark:hover:bg-stone-800/50">
                      <td className="px-4 py-3 whitespace-nowrap text-stone-600 dark:text-stone-300">{formatDate(e.date)}</td>
                      <td className="px-4 py-3">
                        {flock
                          ? <Link to={`/flocks/${flock.id}`} className="text-brand-700 dark:text-brand-400 hover:underline font-medium">{flock.name}</Link>
                          : <span className="text-stone-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: meta?.color }} />
                          <Icon className="w-3.5 h-3.5" style={{ color: meta?.color }} />
                          <span>{meta?.label}</span>
                          {e.type === 'death' && e.sheepLost > 0 && (
                            <span className="text-red-600 dark:text-red-400 text-xs">{t('type.deathNote', { n: e.sheepLost })}</span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-stone-600 dark:text-stone-300 max-w-xs truncate">{e.note || '—'}</td>
                      <td className="px-4 py-3 text-end font-semibold whitespace-nowrap">{formatMoney(e.amount)}</td>
                      <td className="px-4 py-3 text-end whitespace-nowrap">
                        <button onClick={() => setEditing(e)} className="p-1.5 rounded text-stone-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-stone-100 dark:hover:bg-stone-800" title={t('common.edit')}>
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => onDelete(e)} className="p-1.5 rounded text-stone-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-stone-100 dark:hover:bg-stone-800" title={t('common.delete')}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <ul className="md:hidden space-y-2">
            {filtered.map((e) => {
              const Icon = TYPE_ICON[e.type] || MoreHorizontal
              const meta = types.find((x) => x.id === e.type)
              const flock = flockById[e.flockId]
              return (
                <li key={e.id} className="card flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-xl grid place-items-center shrink-0"
                    style={{ backgroundColor: `${meta?.color}20`, color: meta?.color }}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="font-semibold truncate">
                        {flock
                          ? <Link to={`/flocks/${flock.id}`} className="hover:underline">{flock.name}</Link>
                          : <span className="text-stone-400">{t('exp.deletedFlock')}</span>}
                      </div>
                      <div className="font-bold shrink-0">{formatMoney(e.amount)}</div>
                    </div>
                    <div className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                      <span style={{ color: meta?.color }} className="font-medium">{meta?.label}</span>
                      {e.type === 'death' && e.sheepLost > 0 && (
                        <span className="text-red-600 dark:text-red-400"> · {t('type.deathNote', { n: e.sheepLost })}</span>
                      )}
                      <span className="text-stone-400"> · {formatDate(e.date)}</span>
                    </div>
                    {e.note && <div className="text-sm text-stone-600 dark:text-stone-300 mt-1 truncate">{e.note}</div>}
                  </div>
                  <div className="flex flex-col gap-1">
                    <button onClick={() => setEditing(e)} className="p-1.5 rounded text-stone-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-stone-100 dark:hover:bg-stone-800" title={t('common.edit')}>
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => onDelete(e)} className="p-1.5 rounded text-stone-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-stone-100 dark:hover:bg-stone-800" title={t('common.delete')}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}

      {editing && (
        <AddExpenseModal
          flockId={editing.flockId}
          expense={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}