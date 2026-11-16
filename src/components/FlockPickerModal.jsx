import { useEffect, useState } from 'react'
import { ModalShell } from './AddFlockModal'
import { useAuth } from '../context/AuthContext'
import { subscribeFlocks } from '../hooks/useFirestore'
import { useLocale } from '../context/LocaleContext'

export default function FlockPickerModal({ onPick, onClose }) {
  const { user } = useAuth()
  const { t } = useLocale()
  const [flocks, setFlocks] = useState([])

  useEffect(() => {
    if (!user) return
    const unsub = subscribeFlocks(user.uid, setFlocks)
    return unsub
  }, [user])

  const active = flocks.filter((f) => f.status !== 'sold')

  return (
    <ModalShell onClose={onClose} title={t('picker.title')}>
      {active.length === 0 ? (
        <div className="text-center py-6 text-stone-500 dark:text-stone-400">
          {t('picker.empty')}<br />
          <span className="text-sm">{t('picker.emptyCta')}</span>
        </div>
      ) : (
        <ul className="space-y-2">
          {active.map((f) => (
            <li key={f.id}>
              <button
                onClick={() => onPick(f)}
                className="w-full text-start px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-700 hover:bg-brand-50 dark:hover:bg-stone-800 hover:border-brand-300 dark:hover:border-brand-700 transition"
              >
                <div className="font-semibold">{f.name}</div>
                <div className="text-xs text-stone-500 dark:text-stone-400">
                  {t('picker.rowMeta', { n: f.initialCount, date: f.buyDate })}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </ModalShell>
  )
}