import { firebaseServer } from '../server/firebase.ts'
import { handler } from '../server/http.ts'

export default handler(() => {
  const { auth, store } = firebaseServer()
  return { store, verify: token => auth.verifyIdToken(token, true) }
})
