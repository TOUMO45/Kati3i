import { Trash2, Scale } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useLocale } from '../context/LocaleContext'
import { deleteWeight } from '../hooks/useFirestore'
import { formatDate } from '../utils/format'

// Renders a flock's weight history. Caller passes the already-subscribed
// `weights` array (filtered to this flock) so we don't open a duplicate
// listener — FlockDetail already subscribes.
export default function WeightHistory({ weights }) {
  const { user } = useAuth()
  const { t } = useLocale()

  const onDelete = async (w) => {
    if (!confirm(t('weight.deleteQ'))) return
    await deleteWeight(user.uid, w.id)
  }

  if (!weights || weights.length === 0) {
    return (
      <div className="text-center py-6 text-stone-500 text-sm">
        <Scale className="w-5 h-5 mx-auto mb-1 opacity-50" />
        {t('weight.empty')}
      </div>
    )
  }

  return (
    <ul className="divide-y divide-stone-100 dark:divide-stone-800">
      {weights.map((w, i) => (
        <li key={w.id} className="py-3 flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl grid place-items-center shrink-0 ${
            i === 0
              ? 'bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300'
              : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400'
          }`}>
            <Scale className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm">
              {Number(w.avgWeight).toFixed(2)} KG
              {i === 0 && (
                <span className="ms-2 badge bg-sky-100 dark:bg-sky-900/40 text-sky-800 dark:text-sky-300">
                  {t('weight.current')}
                </span>
              )}
            </div>
            <div className="text-xs text-stone-500 dark:text-stone-400">
              {formatDate(w.date)}{w.notes ? ` · ${w.notes}` : ''}
            </div>
          </div>
          <button
            onClick={() => onDelete(w)}
            className="p-1.5 rounded text-stone-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-stone-100 dark:hover:bg-stone-800"
            title={t('common.delete')}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </li>
      ))}
    </ul>
  )
}
