import { firebaseServer } from '../server/firebase.ts'
import { INITIAL_QUESTIONS } from '../server/questions.ts'
import { DEFAULT_RULES, EMPTY_STATS } from '../shared/model.ts'

const { store, auth } = firebaseServer()
const email = process.argv[2]?.trim()
const teacher = email ? await auth.getUserByEmail(email) : null
await store.run(async tx => {
  const [questions, rules, stats] = await Promise.all([
    tx.list<{ id: string }>('questions'),
    tx.get('settings', 'competition'),
    tx.get('adminStats', 'global'),
  ])
  const ids = new Set(questions.map(question => question.id))
  for (const question of INITIAL_QUESTIONS) {
    if (!ids.has(question.id)) tx.set('questions', question.id, question)
  }
  if (!rules) tx.set('settings', 'competition', DEFAULT_RULES)
  if (!stats) {
    tx.set('adminStats', 'global', EMPTY_STATS)
    tx.set('publicStats', 'global', { participants: 0, games: 0 })
  }
  if (teacher) tx.set('admins', teacher.uid, { grantedAt: Date.now() })
})
console.log(teacher ? 'Banco inicial preparado e acesso concedido ao professor.' : 'Banco inicial preparado.')

