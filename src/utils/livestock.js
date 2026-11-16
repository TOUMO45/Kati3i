// Livestock types. Each flock has a livestockType field whose value is one of
// these constants. SHEEP is the default for backward compatibility — any flock
// created before this feature shipped is treated as sheep.
//
// Emoji + label-key pairs live here so every UI surface renders them the same
// way (Dashboard, Flocks list, FlockDetail header, SalesHistory rows).

export const LIVESTOCK_TYPES = [
  { id: 'SHEEP',  emoji: '🐑', labelKey: 'livestock.sheep'  },
  { id: 'GOAT',   emoji: '🐐', labelKey: 'livestock.goat'   },
  { id: 'COW',    emoji: '🐄', labelKey: 'livestock.cow'    },
  { id: 'CAMEL',  emoji: '🐪', labelKey: 'livestock.camel'  },
]

export const DEFAULT_LIVESTOCK_TYPE = 'SHEEP'

export function livestockMeta(id) {
  return LIVESTOCK_TYPES.find((t) => t.id === id) || LIVESTOCK_TYPES[0]
}

// Convenience: resolve a flock's type → emoji, defaulting to sheep for any
// pre-existing flock that doesn't carry a livestockType yet.
export function livestockEmoji(flock) {
  return livestockMeta(flock?.livestockType || DEFAULT_LIVESTOCK_TYPE).emoji
}

export function livestockLabelKey(flock) {
  return livestockMeta(flock?.livestockType || DEFAULT_LIVESTOCK_TYPE).labelKey
}
