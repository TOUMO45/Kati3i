// Demo data layer — a drop-in, in-memory replacement for src/hooks/useFirestore.js.
//
// `npm run demo` (vite --mode demo) aliases every import of useFirestore to this
// file, so the whole app runs with realistic sample data and NO Firebase project,
// NO network and NO account. Nothing is persisted: a refresh resets the data.
//
// Every export mirrors the real module's signature one-to-one.
import { seed } from './seed'

const db = seed()
const listeners = { flocks: new Set(), expenses: new Set(), sales: new Set(), weights: new Set() }

let counter = 1000
const newId = (prefix) => `${prefix}-${++counter}`
const stamp = () => {
  const ms = Date.now()
  return { toMillis: () => ms }
}
const byDateDesc = (field) => (a, b) => String(b[field] || '').localeCompare(String(a[field] || ''))
const byCreatedDesc = (a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)

function view(name, flockId) {
  const rows = flockId ? db[name].filter((r) => r.flockId === flockId) : [...db[name]]
  if (name === 'flocks') return rows.sort(byCreatedDesc)
  if (name === 'sales') return rows.sort(byDateDesc('saleDate'))
  return rows.sort(byDateDesc('date'))
}

function emit(name) {
  for (const l of listeners[name]) l.cb(view(name, l.flockId))
}

// Mirrors onSnapshot: first delivery is async, then one call per change.
function subscribe(name, cb, flockId) {
  const entry = { cb, flockId }
  listeners[name].add(entry)
  const timer = setTimeout(() => {
    if (listeners[name].has(entry)) cb(view(name, flockId))
  }, 0)
  return () => {
    clearTimeout(timer)
    listeners[name].delete(entry)
  }
}

function insert(name, prefix, data) {
  const row = { id: newId(prefix), ...data, createdAt: stamp() }
  db[name].push(row)
  emit(name)
  return row.id
}

function patch(name, id, data) {
  const row = db[name].find((r) => r.id === id)
  if (row) Object.assign(row, data, { updatedAt: stamp() })
  emit(name)
}

function remove(name, predicate) {
  db[name] = db[name].filter((r) => !predicate(r))
  emit(name)
}

// ---- Flocks ----
export function subscribeFlocks(uid, cb) {
  return subscribe('flocks', cb)
}

export async function getFlock(uid, id) {
  const f = db.flocks.find((x) => x.id === id)
  return f ? { ...f } : null
}

export async function addFlock(uid, data) {
  return insert('flocks', 'flock', { ...data, archived: false, soldCount: 0 })
}

export async function updateFlock(uid, id, data) {
  patch('flocks', id, data)
}

export async function setFlockArchived(uid, id, archived) {
  patch('flocks', id, { archived: !!archived, archivedAt: archived ? stamp() : null })
}

export async function deleteFlock(uid, id) {
  remove('expenses', (r) => r.flockId === id)
  remove('sales', (r) => r.flockId === id)
  remove('weights', (r) => r.flockId === id)
  remove('flocks', (r) => r.id === id)
}

// ---- Expenses ----
export function subscribeExpenses(uid, cb, flockId) {
  return subscribe('expenses', cb, flockId)
}

export async function addExpense(uid, data) {
  return insert('expenses', 'exp', data)
}

export async function updateExpense(uid, id, data) {
  patch('expenses', id, data)
}

export async function deleteExpense(uid, id) {
  remove('expenses', (r) => r.id === id)
}

// ---- Sales ----
export function subscribeSales(uid, cb, flockId) {
  return subscribe('sales', cb, flockId)
}

export async function addSale(uid, data) {
  return insert('sales', 'sale', data)
}

export async function deleteSale(uid, id) {
  remove('sales', (r) => r.id === id)
}

export async function deleteFlockCascadeSales(uid, id) {
  remove('sales', (r) => r.flockId === id)
}

// ---- Weights ----
export function subscribeWeights(uid, cb, flockId) {
  return subscribe('weights', cb, flockId)
}

export async function addWeight(uid, data) {
  return insert('weights', 'weight', data)
}

export async function deleteWeight(uid, id) {
  remove('weights', (r) => r.id === id)
}
