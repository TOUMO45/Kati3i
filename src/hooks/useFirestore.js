// Firestore access layer. Keeps page components clean of Firebase boilerplate.
//
// All collections are scoped per-user via the path:
//   users/{uid}/flocks/{flockId}
//   users/{uid}/expenses/{expenseId}
// Security rules enforce that the requester.uid must match the path segment.
import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDoc,
  query, where, onSnapshot, serverTimestamp, orderBy, getDocs,
} from 'firebase/firestore'
import { db } from '../lib/firebase'

const userCol = (uid, name) => collection(db, 'users', uid, name)

// ---- Flocks ----
export function subscribeFlocks(uid, cb) {
  const q = query(userCol(uid, 'flocks'), orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  }, (err) => {
    console.error('flocks snapshot error', err)
    cb([], err)
  })
}

export async function getFlock(uid, id) {
  const snap = await getDoc(doc(db, 'users', uid, 'flocks', id))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export async function addFlock(uid, data) {
  const ref = await addDoc(userCol(uid, 'flocks'), {
    ...data,
    archived: false,
    soldCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateFlock(uid, id, data) {
  await updateDoc(doc(db, 'users', uid, 'flocks', id), {
    ...data,
    updatedAt: serverTimestamp(),
  })
}

// Mark a flock as archived (hidden from dashboard totals, kept in archive).
// Pass archived=false to restore it to active counting.
export async function setFlockArchived(uid, id, archived) {
  await updateDoc(doc(db, 'users', uid, 'flocks', id), {
    archived: !!archived,
    archivedAt: archived ? serverTimestamp() : null,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteFlock(uid, id) {
  // Cascade delete: remove every expense AND every sale attached to this flock,
  // then the flock itself. Firestore has no native cascade, so we do it
  // client-side. For typical flock sizes this is fast and safe.
  const expensesRef = collection(db, 'users', uid, 'expenses')
  const expSnap = await getDocs(query(expensesRef, where('flockId', '==', id)))
  await Promise.all(expSnap.docs.map((d) => deleteDoc(d.ref)))

  const salesRef = collection(db, 'users', uid, 'sales')
  const saleSnap = await getDocs(query(salesRef, where('flockId', '==', id)))
  await Promise.all(saleSnap.docs.map((d) => deleteDoc(d.ref)))

  const weightsRef = collection(db, 'users', uid, 'weights')
  const weightSnap = await getDocs(query(weightsRef, where('flockId', '==', id)))
  await Promise.all(weightSnap.docs.map((d) => deleteDoc(d.ref)))

  await deleteDoc(doc(db, 'users', uid, 'flocks', id))
}

// ---- Expenses ----
// NOTE: per-flock queries intentionally omit orderBy to avoid needing a
// composite index. We sort in the consumer (it's cheap for typical sizes and
// Firestore is happy with a single-field where-filter).
export function subscribeExpenses(uid, cb, flockId) {
  const base = userCol(uid, 'expenses')
  const q = flockId ? query(base, where('flockId', '==', flockId)) : query(base, orderBy('date', 'desc'))
  return onSnapshot(q, (snap) => {
    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    docs.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
    cb(docs)
  }, (err) => {
    console.error('expenses snapshot error', err)
    cb([], err)
  })
}

export async function addExpense(uid, data) {
  const ref = await addDoc(userCol(uid, 'expenses'), {
    ...data,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateExpense(uid, id, data) {
  await updateDoc(doc(db, 'users', uid, 'expenses', id), {
    ...data,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteExpense(uid, id) {
  await deleteDoc(doc(db, 'users', uid, 'expenses', id))
}

// ---- Sales ----
// Sales are stored at users/{uid}/sales/{saleId} with the flockId as a field.
// This makes cross-flock queries simple ("show me all sales") and keeps the
// sales history immutable: a stored sale never changes when future expenses
// are added (the costPerSheepAtSale field freezes the value at sale time).
//
// Per-flock queries intentionally omit orderBy to avoid needing a composite
// Firestore index. Sorted client-side instead.
export function subscribeSales(uid, cb, flockId) {
  const base = userCol(uid, 'sales')
  const q = flockId ? query(base, where('flockId', '==', flockId)) : query(base, orderBy('saleDate', 'desc'))
  return onSnapshot(q, (snap) => {
    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    docs.sort((a, b) => String(b.saleDate || '').localeCompare(String(a.saleDate || '')))
    cb(docs)
  }, (err) => {
    console.error('sales snapshot error', err)
    cb([], err)
  })
}

export async function addSale(uid, data) {
  const ref = await addDoc(userCol(uid, 'sales'), {
    ...data,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function deleteSale(uid, id) {
  await deleteDoc(doc(db, 'users', uid, 'sales', id))
}

// Cascade-delete: when a flock is removed, also remove every sale attached to
// it. Kept in sync with the same pattern used for expenses.
export async function deleteFlockCascadeSales(uid, id) {
  const salesRef = collection(db, 'users', uid, 'sales')
  const q = query(salesRef, where('flockId', '==', id))
  const snapshot = await getDocs(q)
  await Promise.all(snapshot.docs.map((d) => deleteDoc(d.ref)))
}

// ---- Weights ----
// Weight records track the flock's average live weight over time. Stored at
// users/{uid}/weights/{weightId} with flockId as a field. Per-flock queries
// omit orderBy to avoid composite-index requirements (sorted client-side).
//
// weight = { id, flockId, avgWeight, date, notes?, createdAt }
export function subscribeWeights(uid, cb, flockId) {
  const base = userCol(uid, 'weights')
  const q = flockId ? query(base, where('flockId', '==', flockId)) : query(base, orderBy('date', 'desc'))
  return onSnapshot(q, (snap) => {
    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    docs.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
    cb(docs)
  }, (err) => {
    console.error('weights snapshot error', err)
    cb([], err)
  })
}

export async function addWeight(uid, data) {
  const ref = await addDoc(userCol(uid, 'weights'), {
    ...data,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function deleteWeight(uid, id) {
  await deleteDoc(doc(db, 'users', uid, 'weights', id))
}