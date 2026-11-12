import { CATEGORIES, DIFFICULTIES, type AdminData, type AdminGame, type Activity, type Participant, type Question, type Rules } from '../shared/model.ts'
import { activity, GameError, rulesFor, SESSION_MS, statsFor } from './game.ts'
import type { Store } from './store.ts'

export type Identity = { uid: string }
export async function requireTeacher(store: Store, token: string, verify: (token: string) => Promise<Identity>) {
  if (!token) throw new GameError('Entre com a sua conta de professor.', 401)
  const identity = await verify(token).catch(() => { throw new GameError('Sua sessão expirou. Entre novamente.', 401) })
  const grant = await store.run(tx => tx.get('admins', identity.uid))
  if (!grant) throw new GameError('Esta conta não tem acesso ao painel.', 403)
  return identity
}

export async function readAdmin(store: Store): Promise<AdminData> {
  return store.run(async tx => {
    const [stats, questions, recent, players, history, rules] = await Promise.all([
      statsFor(tx), tx.list<Question>('questions'),
      tx.list<AdminGame & { startedAt: number }>('games', { sort: [['startedAt', 'desc']], limit: 50 }),
      tx.list<Participant>('players', { sort: [['lastPlayedAt', 'desc']], limit: 100 }),
      tx.list<Activity>('activity', { sort: [['at', 'desc']], limit: 50 }), rulesFor(tx),
    ])
    const games: AdminGame[] = recent.map(({ id, nickname, stage, correct, tokens, points, startedAt }) => ({
      id, nickname, correct, tokens, points, stage: stage !== 'complete' && Date.now() - startedAt >= SESSION_MS ? 'expired' : stage,
    }))
    const participants = players.filter(player => typeof player.lastPlayedAt === 'number')
      .map(({ id, nickname, attempts, lastPlayedAt }) => ({ id, nickname, attempts, lastPlayedAt }))
    return { stats, questions, games, participants, activity: history, rules }
  })
}

const clean = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max + 1) : ''
export function saveQuestion(store: Store, input: Record<string, unknown>) {
  const id = clean(input.id, 80)
  const prompt = clean(input.prompt, 500)
  const explanation = clean(input.explanation, 1200)
  const options = Array.isArray(input.options) ? input.options.map(option => clean(option, 200)) : []
  const { correct, difficulty, category, active } = input as Partial<Question>
  if (!/^[a-z0-9-]{1,80}$/.test(id) || !prompt || prompt.length > 500 || !explanation || explanation.length > 1200 ||
      options.length !== 4 || options.some(option => !option || option.length > 200) || new Set(options).size !== 4 ||
      typeof correct !== 'number' || !Number.isInteger(correct) || correct < 0 || correct > 3 ||
      !difficulty || !DIFFICULTIES.includes(difficulty) || !category || !CATEGORIES.includes(category) || typeof active !== 'boolean') {
    throw new GameError('Preencha a pergunta, as quatro alternativas distintas, o gabarito e a explicação.')
  }
  return store.run(async tx => {
    const all = await tx.list<Question>('questions')
    if (all.some(question => question.id !== id && question.prompt.toLowerCase() === prompt.toLowerCase())) {
      throw new GameError('Já existe uma questão com este enunciado.', 409)
    }
    const next = [...all.filter(question => question.id !== id), { id, prompt, explanation, options, correct, difficulty, category, active }]
    const enabled = next.filter(question => question.active)
    if (enabled.length < 5 || DIFFICULTIES.some(level => !enabled.some(question => question.difficulty === level))) {
      throw new GameError('Mantenha pelo menos cinco questões ativas e uma de cada dificuldade.')
    }
    tx.set('questions', id, next[next.length - 1])
    activity(tx, `Questão ${id} atualizada.`)
    return { saved: true }
  })
}
export function saveRules(store: Store, input: Record<string, unknown>) {
  const { maxAttempts, blockedWords } = input as Partial<Rules>
  if (typeof maxAttempts !== 'number' || !Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 20 ||
      !Array.isArray(blockedWords) || blockedWords.length > 100 || blockedWords.some(word => typeof word !== 'string' || !word.trim() || word.length > 40)) {
    throw new GameError('Use de 1 a 20 tentativas e até 100 termos bloqueados.')
  }
  return store.run(async tx => {
    tx.set('settings', 'competition', { maxAttempts, blockedWords: [...new Set(blockedWords.map(word => word.trim()))] })
    activity(tx, 'Regulamento atualizado.')
    return { saved: true }
  })
}
