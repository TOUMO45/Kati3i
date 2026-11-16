// Small helpers that combine EXPENSE_TYPES metadata with translated labels.
import { useLocale } from '../context/LocaleContext'
import { EXPENSE_TYPES } from '../utils/calculations'

// Returns the full type object for an id, with the label filled in from translations.
export function useExpenseTypes() {
  const { t } = useLocale()
  return EXPENSE_TYPES.map((x) => ({ ...x, label: t(`type.${x.id}`) }))
}

export function useExpenseType(id) {
  const types = useExpenseTypes()
  return types.find((x) => x.id === id)
}