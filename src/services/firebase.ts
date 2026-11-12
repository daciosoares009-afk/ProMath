import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'

const { VITE_FIREBASE_PROJECT_ID: projectId, VITE_FIREBASE_API_KEY: apiKey, VITE_FIREBASE_AUTH_DOMAIN: authDomain, VITE_FIREBASE_APP_ID: appId } = import.meta.env
const app = __PROBMATH_FIREBASE__ && projectId && apiKey && authDomain && appId ? initializeApp({ projectId, apiKey, authDomain, appId }) : null
export const auth = app ? getAuth(app) : null
export const db = app ? getFirestore(app) : null

if (import.meta.env.DEV && auth && db && import.meta.env.VITE_FIREBASE_EMULATORS === 'true') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
}
