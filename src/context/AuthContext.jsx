import { createContext, useContext, useEffect, useState } from 'react'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from 'firebase/auth'
import {
  ref, uploadBytes, getDownloadURL, deleteObject,
} from 'firebase/storage'
import { auth, storage } from '../lib/firebase'
import { rememberAccount } from '../utils/savedAccounts'

const AuthContext = createContext(null)

// Compress an image File to a smaller JPEG (max 400px on the long side) before
// uploading. Keeps the avatar small (~30-50KB) so it loads fast and doesn't
// blow up the storage quota.
async function compressImage(file, maxSide = 400, quality = 0.85) {
  const dataUrl = await new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = reject
    r.readAsDataURL(file)
  })
  const img = await new Promise((resolve, reject) => {
    const i = new Image()
    i.onload = () => resolve(i)
    i.onerror = reject
    i.src = dataUrl
  })
  const ratio = Math.min(maxSide / img.width, maxSide / img.height, 1)
  const w = Math.round(img.width * ratio)
  const h = Math.round(img.height * ratio)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0, w, h)
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality)
  })
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)
      if (u) rememberAccount(u)
    })
    return unsub
  }, [])

  const signup = async (email, password, displayName) => {
    setError(null)
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password)
      if (displayName) await updateProfile(cred.user, { displayName })
      return cred.user
    } catch (e) {
      setError(e.code)
      throw e
    }
  }

  const login = async (email, password) => {
    setError(null)
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password)
      return cred.user
    } catch (e) {
      setError(e.code)
      throw e
    }
  }

  const logout = () => signOut(auth)

  const updateDisplayName = async (newName) => {
    if (!auth.currentUser) throw new Error('Not signed in')
    await updateProfile(auth.currentUser, { displayName: newName })
    setUser({ ...auth.currentUser })
  }

  const changePassword = async (currentPassword, newPassword) => {
    if (!auth.currentUser) throw new Error('Not signed in')
    const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword)
    await reauthenticateWithCredential(auth.currentUser, credential)
    await updatePassword(auth.currentUser, newPassword)
  }

  // Upload a profile photo: compress → upload to Storage → save URL on the
  // Firebase Auth user. Returns the new photoURL.
  //
  // Step-by-step console logging is deliberate — it makes it possible to
  // see which exact Firebase call is failing when uploads break (Storage
  // not enabled vs. rules blocking vs. wrong bucket are otherwise hard
  // to tell apart). Remove if it becomes noisy.
  const uploadProfilePhoto = async (file) => {
    console.log('[upload] starting', { name: file?.name, size: file?.size, type: file?.type })
    if (!auth.currentUser) throw new Error('Not signed in')
    if (!file) throw new Error('No file selected')
    if (!file.type.startsWith('image/')) throw new Error('File must be an image')
    if (file.size > 5 * 1024 * 1024) throw new Error('Image must be under 5MB')

    console.log('[upload] compressing…')
    const compressed = await compressImage(file)
    if (!compressed) throw new Error('Could not process image')
    console.log('[upload] compressed', { size: compressed.size })

    const path = `users/${auth.currentUser.uid}/profile/avatar.jpg`
    const storageRef = ref(storage, path)
    console.log('[upload] uploading to', path, 'bucket =', storage?.app?.options?.storageBucket)
    await uploadBytes(storageRef, compressed, { contentType: 'image/jpeg' })
    console.log('[upload] uploaded; getting URL…')
    const url = await getDownloadURL(storageRef)
    console.log('[upload] got URL', url)
    await updateProfile(auth.currentUser, { photoURL: url })
    setUser({ ...auth.currentUser })
    console.log('[upload] done — profile updated')
    return url
  }

  const removeProfilePhoto = async () => {
    if (!auth.currentUser) throw new Error('Not signed in')
    const path = `users/${auth.currentUser.uid}/profile/avatar.jpg`
    try {
      await deleteObject(ref(storage, path))
    } catch {
      // ignore — file may not exist
    }
    await updateProfile(auth.currentUser, { photoURL: '' })
    setUser({ ...auth.currentUser })
  }

  return (
    <AuthContext.Provider
      value={{
        user, loading, error, signup, login, logout, setError,
        updateDisplayName, changePassword,
        uploadProfilePhoto, removeProfilePhoto,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

export function authErrorToKey(code) {
  switch (code) {
    case 'auth/email-already-in-use':    return 'auth.errEmailInUse'
    case 'auth/invalid-email':            return 'auth.errBadEmail'
    case 'auth/weak-password':            return 'auth.errWeakPass'
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':       return 'auth.errBadCreds'
    case 'auth/too-many-requests':        return 'auth.errTooMany'
    case 'auth/invalid-current-password': return 'auth.errBadCurrent'
    case 'auth/requires-recent-login':    return 'auth.errReauth'
    default:                              return 'auth.errGeneric'
  }
}