import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { FieldPath, getFirestore, type DocumentData, type Query as FirestoreQuery } from 'firebase-admin/firestore'
import type { Store, Sort } from './store.ts'

export function firebaseServer() {
  if (process.env.VERCEL && (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST)) {
    throw new Error('Emuladores do Firebase disponíveis somente localmente.')
  }
  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  const emulated = process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST && !process.env.VERCEL
  if (!projectId || (!emulated && (!clientEmail || !privateKey))) throw new Error('Configuração administrativa do Firebase ausente.')
  const app = getApps()[0] ?? initializeApp({
    projectId,
    ...(emulated ? {} : { credential: cert({ projectId, clientEmail, privateKey }) }),
  })
  const db = getFirestore(app)
  const store: Store = {
    run: work => db.runTransaction(native => work({
      async get<T>(collection: string, id: string) {
        return (await native.get(db.collection(collection).doc(id))).data() as T | undefined
      },
      async list<T>(collection: string, { sort = [], limit }: {sort?: Sort[]; limit?: number} = {}) {
        let query: FirestoreQuery<DocumentData> = db.collection(collection)
        for (const [field, order] of sort) query = query.orderBy(field === 'id' ? FieldPath.documentId() : field, order)
        if (limit) query = query.limit(limit)
        return (await native.get(query)).docs.map(doc => doc.data() as T)
      },
      set(collection, id, value) { native.set(db.collection(collection).doc(id), value) },
    })),
  }
  return { store, auth: getAuth(app) }
}
