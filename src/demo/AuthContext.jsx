// Demo auth — a drop-in replacement for src/context/AuthContext.jsx used by
// `npm run demo`. There is no Firebase and no real account: you start signed in
// as a sample user, and the login form accepts anything. Nothing leaves the
// browser and nothing is stored.
import { createContext, useContext, useState } from 'react'

const AuthContext = createContext(null)

const DEMO_USER = {
  uid: 'demo-user',
  email: 'demo@example.com',
  displayName: 'Demo Herder',
  photoURL: '',
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(DEMO_USER)
  const [error, setError] = useState(null)

  const signup = async (email, _password, displayName) => {
    const u = { ...DEMO_USER, email: email || DEMO_USER.email, displayName: displayName || DEMO_USER.displayName }
    setUser(u)
    return u
  }

  const login = async (email) => {
    const u = { ...DEMO_USER, email: email || DEMO_USER.email }
    setUser(u)
    return u
  }

  const logout = async () => setUser(null)

  const updateDisplayName = async (newName) => setUser((u) => ({ ...u, displayName: newName }))

  const changePassword = async () => {}

  const uploadProfilePhoto = async (file) => {
    if (!file) throw new Error('No file selected')
    if (!file.type.startsWith('image/')) throw new Error('File must be an image')
    const url = URL.createObjectURL(file)
    setUser((u) => ({ ...u, photoURL: url }))
    return url
  }

  const removeProfilePhoto = async () => setUser((u) => ({ ...u, photoURL: '' }))

  return (
    <AuthContext.Provider
      value={{
        user, loading: false, error, signup, login, logout, setError,
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

export function authErrorToKey() {
  return 'auth.errGeneric'
}
