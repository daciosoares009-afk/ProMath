import { createHash, randomInt, randomUUID, timingSafeEqual } from 'node:crypto'
import {
  compareRanking, DEFAULT_RULES, DIFFICULTIES, draw, EMPTY_STATS, publicQuestion, QUESTION_COUNT,
  type Answer, type Decision, type Drop, type Game, type Question, type Ranking, type Rules, type Stats,
} from '../shared/model.ts'
import type { Store, Transaction } from './store.ts'

export class GameError extends Error {
  readonly status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}
export const digest = (text: string) => createHash('sha256').update(text).digest('hex')
export const uuid = (value: unknown): value is string => typeof value === 'string' && /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/.test(value)
export const validSecret = (value: unknown): value is string => typeof value === 'string' && /^[\da-f]{64}$/.test(value)
export const canonical = (value: string) => value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
const randomBit = () => randomInt(2) as Decision
export const SESSION_MS = 30 * 60_000
type PrivateGame = Omit<Game, 'question' | 'answer'> & { key: string; questions: Question[]; answers: Answer[]; drops: Drop[]; startedAt: number }
export type Session = { id: string; secret: string }

function view(game: PrivateGame): Game {
  const { id, nickname, stage, index, correct, tokens, points, completedAt } = game
  return {
    id, nickname, stage, index, correct, tokens, points, completedAt,
    question: stage === 'quiz' ? publicQuestion(game.questions[index]) : null,
    answer: stage === 'quiz' ? game.answers[index] ?? null : null,
  }
}
function shuffled<T>(values: T[]) {
  const items = [...values]
  for (let i = items.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[items[i], items[j]] = [items[j], items[i]]
  }
  return items
}
export function selectQuestions(questions: Question[]) {
  const active = shuffled(questions.filter(question => question.active))
  const required = DIFFICULTIES.flatMap(difficulty => active.find(q => q.difficulty === difficulty) ?? [])
  const chosen = [...required, ...active.filter(q => !required.includes(q))].slice(0, QUESTION_COUNT)
  if (chosen.length !== QUESTION_COUNT || required.length !== DIFFICULTIES.length) {
    throw new GameError('O banco de questões precisa de cinco questões ativas e dos três níveis de dificuldade.', 503)
  }
  return shuffled(chosen).map(question => {
    const positions = shuffled([0, 1, 2, 3])
    return { ...question, options: positions.map(i => question.options[i]), correct: positions.indexOf(question.correct) }
  })
}
export function nicknameFor(value: unknown, rules: Rules) {
  if (typeof value !== 'string') throw new GameError('Informe um apelido.')
  const nickname = value.normalize('NFKC').trim().replace(/\s+/g, ' ')
  if (!/^[\p{L}\p{N}][\p{L}\p{N} _.-]{1,18}[\p{L}\p{N}]$/u.test(nickname) || canonical(nickname).length < 3) {
    throw new GameError('Use de 3 a 20 caracteres, com letras, números, espaços, ponto, hífen ou sublinhado.')
  }
  if (rules.blockedWords.some(word => canonical(word) && canonical(nickname).includes(canonical(word)))) {
    throw new GameError('Escolha outro apelido.')
  }
  return nickname
}
export function activity(tx: Transaction, message: string) {
  const id = randomUUID()
  tx.set('activity', id, { id, message, at: Date.now() })
}
export const statsFor = async (tx: Transaction) => await tx.get<Stats>('adminStats', 'global') ?? structuredClone(EMPTY_STATS)
export const rulesFor = async (tx: Transaction) => await tx.get<Rules>('settings', 'competition') ?? DEFAULT_RULES
function saveStats(tx: Transaction, stats: Stats) {
  tx.set('adminStats', 'global', stats)
}
function authorize(game: PrivateGame | undefined, secret: string): PrivateGame {
  if (!game || !timingSafeEqual(Buffer.from(game.key), Buffer.from(digest(secret)))) {
    throw new GameError('Partida não encontrada ou sessão inválida.', 404)
  }
  if (game.stage !== 'complete' && Date.now() - game.startedAt >= SESSION_MS) {
    throw new GameError('O prazo desta partida terminou. Inicie uma nova tentativa.', 410)
  }
  return game
}
async function finish(tx: Transaction, game: PrivateGame, stats: Stats) {
  game.stage = 'complete'
  game.completedAt = Date.now()
  const playerKey = digest(canonical(game.nickname))
  const prior = await tx.get<Ranking>('rankings', playerKey)
  const entry = { id: playerKey, nickname: game.nickname, correct: game.correct, points: game.points, completedAt: game.completedAt }
  if (!prior || compareRanking(entry, prior) < 0) tx.set('rankings', playerKey, entry)
  stats.completed++
  stats.points += game.points
  activity(tx, `${game.nickname} concluiu uma partida com ${game.points} pontos.`)
}
export function gameService(store: Store, bit: () => Decision = randomBit) {
  function sessionWork<T>(session: Session, work: (tx: Transaction, game: PrivateGame) => Promise<T>) {
    return store.run(async tx => work(tx, authorize(await tx.get('games', session.id), session.secret)))
  }
  return {
    start(session: Session, name: unknown) {
      return store.run(async tx => {
        const existing = await tx.get<PrivateGame>('games', session.id)
        if (existing) return view(authorize(existing, session.secret))
        const rules = await rulesFor(tx)
        const nickname = nicknameFor(name, rules)
        const playerKey = digest(canonical(nickname))
        const player = await tx.get<{ attempts: number; activeId: string }>('players', playerKey)
        const activeGame = player && await tx.get<PrivateGame>('games', player.activeId)
        if (activeGame && activeGame.stage !== 'complete' && Date.now() - activeGame.startedAt < SESSION_MS) {
          throw new GameError('Este apelido já tem uma partida em andamento. Use o navegador original ou tente outro apelido.', 409)
        }
        if (player && player.attempts >= rules.maxAttempts) throw new GameError('Este apelido atingiu o limite de tentativas.', 409)
        const questions = selectQuestions(await tx.list<Question>('questions'))
        const stats = await statsFor(tx)
        const game: PrivateGame = {
          id: session.id, nickname, stage: 'quiz', index: 0, correct: 0, tokens: 0, points: 0,
          completedAt: null, questions, answers: [], drops: [], key: digest(session.secret), startedAt: Date.now(),
        }
        stats.participants += Number(!player)
        stats.games++
        tx.set('games', game.id, game)
        tx.set('players', playerKey, {
          id: playerKey, nickname, attempts: (player?.attempts ?? 0) + 1, activeId: game.id, lastPlayedAt: game.startedAt,
        })
        saveStats(tx, stats)
        tx.set('publicStats', 'global', { participants: stats.participants, games: stats.games })
        return view(game)
      })
    },
    resume(session: Session) {
      return sessionWork(session, async (_, game) => ({ game: view(game), launches: game.drops.length }))
    },
    position(session: Session) {
      return sessionWork(session, async (tx, game) => {
        if (game.stage !== 'complete') throw new GameError('Conclua a partida para ver sua posição.', 409)
        const id = digest(canonical(game.nickname))
        const ranked = await tx.get<Ranking>('rankings', id)
        if (!ranked) throw new GameError('Resultado indisponível.', 404)
        const leading = await tx.list<Ranking>('rankings', {
          sort: [['points', 'desc'], ['correct', 'desc'], ['completedAt', 'asc'], ['id', 'asc']], limit: 100,
        })
        const index = leading.findIndex(row => row.id === id)
        const position = index >= 0 ? index + 1 : 1 + (await tx.list<Ranking>('rankings')).filter(row => compareRanking(row, ranked) < 0).length
        return { position, rankedPoints: ranked.points }
      })
    },
    answer(session: Session, index: number, choice: number) {
      return sessionWork(session, async (tx, game) => {
        const old = game.answers[index]
        if (old) {
          if (old.choice !== choice) throw new GameError('A resposta já foi confirmada.', 409)
          return { game: view(game), answer: old }
        }
        if (game.stage !== 'quiz' || index !== game.index || !Number.isInteger(choice) || choice < 0 || choice > 3) throw new GameError('Resposta inválida.', 409)
        const { correct, explanation } = game.questions[index]
        const answer = { choice, correct, explanation }
        const stats = await statsFor(tx)
        if (choice === correct) {
          game.correct++
          game.tokens++
          stats.correct++
        } else stats.wrong++
        game.answers.push(answer)
        tx.set('games', game.id, game)
        saveStats(tx, stats)
        return { game: view(game), answer }
      })
    },
    next(session: Session, index: number) {
      return sessionWork(session, async (tx, game) => {
        if (index < game.index) return view(game)
        if (game.stage !== 'quiz' || game.index !== index || !game.answers[index]) throw new GameError('Confirme a resposta primeiro.', 409)
        game.index++
        if (game.index === QUESTION_COUNT) {
          game.stage = 'machine'
          if (!game.tokens) {
            const stats = await statsFor(tx)
            await finish(tx, game, stats)
            saveStats(tx, stats)
          }
        }
        tx.set('games', game.id, game)
        return view(game)
      })
    },
    launch(session: Session, id: string, ordinal: number) {
      return sessionWork(session, async (tx, game) => {
        const old = game.drops.find(drop => drop.id === id)
        if (old) {
          if (game.drops[ordinal]?.id !== id) throw new GameError('Identificador já utilizado.', 409)
          return { game: view(game), drop: old }
        }
        if (game.stage !== 'machine' || game.tokens < 1 || ordinal !== game.drops.length) throw new GameError('Lançamento indisponível. Atualize a partida.', 409)
        const drop = { id, ...draw(bit) }
        const stats = await statsFor(tx)
        game.tokens--
        game.points += drop.points
        game.drops.push(drop)
        stats.spent++
        stats.bins[drop.bin]++
        if (!game.tokens) await finish(tx, game, stats)
        tx.set('games', game.id, game)
        tx.set('launches', `${game.id}_${id}`, { ...drop, gameId: game.id, ordinal, at: Date.now() })
        saveStats(tx, stats)
        return { game: view(game), drop }
      })
    },
  }
}

