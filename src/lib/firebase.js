// Firebase initialization. Reads config from .env (VITE_FIREBASE_*).
// See .env.example for the keys you need to set.
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

// Hard guard so users get a friendly error instead of cryptic Firebase crashes
// when they forget to fill in their .env file.
function checkConfig(cfg) {
  const missing = Object.entries(cfg)
    .filter(([, v]) => !v || v.startsWith('your-') || v.startsWith('000000'))
    .map(([k]) => k)
  if (missing.length) {
    throw new Error(
      `Firebase config is missing keys: ${missing.join(', ')}. ` +
      `Copy .env.example to .env and fill in your Firebase project credentials.`
    )
  }
}

checkConfig(firebaseConfig)

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)