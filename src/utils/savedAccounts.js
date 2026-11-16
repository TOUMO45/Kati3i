// Tracks accounts that have previously signed in on this device so the
// login screen can offer one-tap "switch back to this account" cards.
// We deliberately store only public profile info (uid, email, displayName,
// photoURL) — NEVER a password or any auth token.

const KEY = 'sheep-tracker:savedAccounts'
const MAX = 6

function read() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function write(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)))
  } catch {
    // localStorage may be unavailable (private mode, quota) — fail silently.
  }
}

export function getSavedAccounts() {
  return read()
}

export function rememberAccount(u) {
  if (!u || !u.email) return
  const entry = {
    uid: u.uid,
    email: u.email,
    displayName: u.displayName || '',
    photoURL: u.photoURL || '',
    lastUsed: Date.now(),
  }
  const list = read().filter((a) => a.email !== u.email)
  list.unshift(entry)
  write(list)
}

export function forgetAccount(email) {
  write(read().filter((a) => a.email !== email))
}
