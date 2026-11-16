import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, Pencil, Trash2, Receipt, Archive, ArchiveRestore } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useLocale } from '../context/LocaleContext'
import { subscribeFlocks, subscribeExpenses, deleteFlock, setFlockArchived } from '../hooks/useFirestore'
import {
  totalInvested, currentValue, realizedProfit, unrealizedProfit,
  roi, liveSheepCount, holdingDays, isArchived,
} from '../utils/calculations'
import { livestockEmoji } from '../utils/livestock'
import { formatMoney, formatDate } from '../utils/format'
import AddFlockModal from '../components/AddFlockModal'
import AddExpenseModal from '../components/AddExpenseModal'

function FlockCardActions({ flock }) {
  const { user } = useAuth()
  const { t } = useLocale()
  const [editing, setEditing] = useState(false)
  const [addingExp, setAddingExp] = useState(false)

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
  const onArchive = async (e) => {
    e.preventDefault(); e.stopPropagation()
    if (!confirm(t('flocks.archiveQ', { name: flock.name }))) return
    await setFlockArchived(user.uid, flock.id, true)
  }
  const onRestore = async (e) => {
    e.preventDefault(); e.stopPropagation()
    if (!confirm(t('flocks.unarchiveQ', { name: flock.name }))) return
    await setFlockArchived(user.uid, flock.id, false)
  }
  return (
    <>
      <div className="flex items-center gap-1">
        {flock.status !== 'sold' && !isArchived(flock) && (
          <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setAddingExp(true) }}
                  className="btn-secondary px-2 py-1.5 text-xs" title={t('dash.addExpense')}>
            <Receipt className="w-3.5 h-3.5" /> {t('dash.expense')}
          </button>
        )}
        {!isArchived(flock) && (
          <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditing(true) }}
                  className="btn-ghost p-2" title={t('common.edit')}>
            <Pencil className="w-4 h-4" />
          </button>
        )}
        <button onClick={onDelete} className="btn-ghost p-2 text-red-600 dark:text-red-400" title={t('common.delete')}>
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      {editing && <AddFlockModal flock={flock} onClose={() => setEditing(false)} />}
      {addingExp && <AddExpenseModal flockId={flock.id} onClose={() => setAddingExp(false)} />}
    </>
  )
}

export default function Flocks() {
  const { user } = useAuth()
  const { t } = useLocale()
  const [flocks, setFlocks] = useState([])
  const [expenses, setExpenses] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const [filter, setFilter] = useState('all') // all | active | sold | archived
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!user) return
    const u1 = subscribeFlocks(user.uid, setFlocks)
    const u2 = subscribeExpenses(user.uid, setExpenses)
    return () => { u1(); u2() }
  }, [user])

  const filtered = flocks
    .filter((f) => {
      if (filter === 'archived') return isArchived(f)
      if (filter === 'all')      return !isArchived(f)
      if (filter === 'active')   return !isArchived(f) && f.status !== 'sold'
      if (filter === 'sold')     return !isArchived(f) && f.status === 'sold'
      return true
    })
    .filter((f) => f.name.toLowerCase().includes(query.toLowerCase()))

  const archivedCount = flocks.filter(isArchived).length

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t('flocks.title')}</h1>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            {t('flocks.subtitle', { n: flocks.length })}
            {archivedCount > 0 && (
              <span className="ms-2">· {archivedCount} {t('flocks.archived').toLowerCase()}</span>
            )}
          </p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary shrink-0">
          <Plus className="w-4 h-4" /> {t('flocks.new')}
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            className="input ps-9"
            placeholder={t('flocks.searchPh')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex bg-stone-100 dark:bg-stone-800 rounded-xl p-1 overflow-x-auto">
          {['all', 'active', 'sold', 'archived'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-sm rounded-lg font-medium whitespace-nowrap ${
                filter === f ? 'bg-white dark:bg-stone-700 shadow-sm text-stone-900 dark:text-stone-100' : 'text-stone-500 dark:text-stone-400'
              }`}
            >
              {f === 'archived' ? t('flocks.archived') : t(`filter.${f}`)}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card text-center py-12 text-stone-500">
          {filter === 'archived' ? (
            <>
              <p>{t('flocks.empty.archived')}</p>
            </>
          ) : flocks.length === 0 ? (
            <>
              <p>{t('flocks.empty')}</p>
              <button onClick={() => setShowAdd(true)} className="mt-3 btn-primary">
                <Plus className="w-4 h-4" /> {t('flocks.emptyCta')}
              </button>
            </>
          ) : (
            <p>{t('flocks.emptyFilter')}</p>
          )}
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((f) => {
            const invested = totalInvested(f, expenses)
            const value = currentValue(f, expenses)
            const profit = f.status === 'sold' ? realizedProfit(f, expenses) : unrealizedProfit(f, expenses)
            const r = roi(f, expenses)
            const archived = isArchived(f)
            return (
              <li key={f.id} className={`card ${archived ? 'opacity-70' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <Link to={`/flocks/${f.id}`} className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xl leading-none" aria-hidden="true">{livestockEmoji(f)}</span>
                      <h3 className="font-semibold truncate">{f.name}</h3>
                      <span className={`badge ${
                        f.status === 'sold'
                          ? 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300'
                          : 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300'
                      }`}>
                        {f.status === 'sold' ? t('detail.sold') : t('detail.active')}
                      </span>
                      {archived && (
                        <span className="badge bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200">{t('flocks.archived')}</span>
                      )}
                    </div>
                    <div className="text-sm text-stone-500 dark:text-stone-400">
                      {t('flocks.summary', { live: liveSheepCount(f, expenses), total: f.initialCount, days: holdingDays(f), date: formatDate(f.buyDate) })}
                    </div>
                    <div className="text-sm mt-0.5 font-medium text-stone-700 dark:text-stone-300">
                      {t('flocks.buyPrice', { amount: formatMoney(f.buyPrice) })}
                    </div>
                  </Link>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <div className="text-stone-500 dark:text-stone-400 text-xs">{t('flocks.invested')}</div>
                    <div className="font-semibold">{formatMoney(invested)}</div>
                  </div>
                  <div>
                    <div className="text-stone-500 dark:text-stone-400 text-xs">{f.status === 'sold' ? t('flocks.soldFor') : t('flocks.value')}</div>
                    <div className="font-semibold">{formatMoney(value)}</div>
                  </div>
                  <div>
                    <div className="text-stone-500 dark:text-stone-400 text-xs">{profit >= 0 ? t('flocks.profit') : t('flocks.loss')}</div>
                    <div className={`font-semibold ${profit >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                      {formatMoney(profit)} <span className="text-xs opacity-70">({r.toFixed(1)}%)</span>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex justify-between items-center gap-2">
                  <div>
                    {archived ? (
                      <button
                        onClick={async (e) => {
                          e.preventDefault(); e.stopPropagation()
                          if (!confirm(t('flocks.unarchiveQ', { name: f.name }))) return
                          await setFlockArchived(user.uid, f.id, false)
                        }}
                        className="text-xs text-brand-700 dark:text-brand-400 hover:underline font-medium flex items-center gap-1"
                      >
                        <ArchiveRestore className="w-3 h-3" /> {t('flocks.unarchive')}
                      </button>
                    ) : (
                      <button
                        onClick={async (e) => {
                          e.preventDefault(); e.stopPropagation()
                          if (!confirm(t('flocks.archiveQ', { name: f.name }))) return
                          await setFlockArchived(user.uid, f.id, true)
                        }}
                        className="text-xs text-stone-500 dark:text-stone-400 hover:text-amber-700 dark:hover:text-amber-400 font-medium flex items-center gap-1"
                      >
                        <Archive className="w-3 h-3" /> {t('flocks.archive')}
                      </button>
                    )}
                  </div>
                  <FlockCardActions flock={f} />
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {showAdd && <AddFlockModal onClose={() => setShowAdd(false)} />}
    </div>
  )
}