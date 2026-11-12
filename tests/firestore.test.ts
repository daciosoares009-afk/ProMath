import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'

const projectId = process.env.FIREBASE_PROJECT_ID
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST
const emulators = Boolean(projectId?.startsWith('demo-') && firestoreHost && authHost && !process.env.VERCEL)

test('regras do Firestore isolam gabarito, dados privados e escritas críticas', { skip: !emulators }, async () => {
  const { initializeApp, deleteApp } = await import('firebase/app')
  const { getAuth, connectAuthEmulator, signInAnonymously } = await import('firebase/auth')
  const { getFirestore, connectFirestoreEmulator, doc, getDocFromServer, setDoc, terminate } = await import('firebase/firestore')
  const { firebaseServer } = await import('../server/firebase.ts')
  const { store } = firebaseServer()
  const client = initializeApp({ apiKey: 'demo-key', projectId }, randomUUID())
  const auth = getAuth(client)
  connectAuthEmulator(auth, `http://${authHost}`, { disableWarnings: true })
  const db = getFirestore(client)
  const [host, port] = firestoreHost!.split(':')
  connectFirestoreEmulator(db, host, Number(port))
  const id = randomUUID()
  const denied = { code: 'permission-denied' }
  try {
    await store.run(async tx => {
      tx.set('questions', id, { correct: 1 })
      tx.set('adminStats', 'global', { completed: 1 })
      tx.set('rankings', id, { nickname: 'Feira', points: 25 })
    })
    assert.equal((await getDocFromServer(doc(db, 'rankings', id))).data()?.points, 25)
    await assert.rejects(getDocFromServer(doc(db, 'questions', id)), denied)
    await assert.rejects(getDocFromServer(doc(db, 'adminStats', 'global')), denied)
    const { user } = await signInAnonymously(auth)
    await assert.rejects(getDocFromServer(doc(db, 'adminStats', 'global')), denied)
    await assert.rejects(setDoc(doc(db, 'admins', user.uid), { grantedAt: Date.now() }), denied)
    await store.run(async tx => tx.set('admins', user.uid, { grantedAt: Date.now() }))
    assert.equal((await getDocFromServer(doc(db, 'adminStats', 'global'))).data()?.completed, 1)
    await assert.rejects(setDoc(doc(db, 'rankings', id), { points: 500 }), denied)
    await assert.rejects(setDoc(doc(db, 'games', id), { tokens: 5 }), denied)
    await assert.rejects(getDocFromServer(doc(db, 'questions', id)), denied)
  } finally {
    await terminate(db)
    await deleteApp(client)
  }
})
