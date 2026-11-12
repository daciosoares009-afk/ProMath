import type { IncomingMessage, ServerResponse } from 'node:http'
import { requireTeacher, readAdmin, saveQuestion, saveRules } from './admin.ts'
import { gameService, GameError, rulesFor, uuid, validSecret } from './game.ts'
import type { Store } from './store.ts'
import type { PublicStats, Ranking } from '../shared/model.ts'

export type Backend = { store: Store; verify?: (token: string) => Promise<{ uid: string }> }
async function payload(req: IncomingMessage): Promise<Record<string, unknown>> {
  const existing = (req as IncomingMessage & { body?: unknown }).body
  if (!req.headers['content-type']?.startsWith('application/json')) throw new GameError('Formato inválido.', 415)
  let parsed: unknown
  try {
    if (existing !== undefined) {
      const raw = typeof existing === 'string' ? existing : JSON.stringify(existing)
      if (Buffer.byteLength(raw) > 16_384) throw new GameError('Requisição muito grande.', 413)
      parsed = JSON.parse(raw)
    } else {
      let size = 0
      const chunks: Buffer[] = []
      for await (const chunk of req) {
        const data = Buffer.from(chunk)
        size += data.length
        if (size > 16_384) throw new GameError('Requisição muito grande.', 413)
        chunks.push(data)
      }
      parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    }
  } catch (error) {
    if (error instanceof GameError) throw error
    throw new GameError('JSON inválido.')
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new GameError('Requisição inválida.')
  return parsed as Record<string, unknown>
}
const smallInteger = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 4

export function handler(backend: () => Promise<Backend> | Backend) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    try {
      if (req.method !== 'POST') throw new GameError('Método inválido.', 405)
      const data = await payload(req)
      const { store, verify } = await backend()
      const game = gameService(store)
      async function dispatch() {
        const { action, id, secret, index, choice, requestId } = data
        if (action === 'rules') return store.run(async tx => ({ maxAttempts: (await rulesFor(tx)).maxAttempts }))
        if (action === 'public') return store.run(async tx => {
          const { participants, games } = await tx.get<PublicStats>('publicStats', 'global') ?? { participants: 0, games: 0 }
          const { maxAttempts } = await rulesFor(tx)
          const ranking = await tx.list<Ranking>('rankings', { sort: [['points', 'desc'], ['correct', 'desc'], ['completedAt', 'asc'], ['id', 'asc']], limit: 100 })
          return { participants, games, maxAttempts, ranking }
        })
        if (typeof action === 'string' && action.startsWith('admin:')) {
          if (!verify) throw new GameError('Configure o Firebase Authentication para acessar o painel.', 503)
          await requireTeacher(store, req.headers.authorization?.match(/^Bearer (\S+)$/)?.[1] ?? '', verify)
          if (action === 'admin:read') return readAdmin(store)
          if (action === 'admin:question') return saveQuestion(store, data)
          if (action === 'admin:rules') return saveRules(store, data)
          throw new GameError('Operação desconhecida.', 404)
        }
        if (!uuid(id) || !validSecret(secret)) throw new GameError('Sessão inválida.')
        const session = { id, secret }
        if (action === 'start') return game.start(session, data.nickname)
        if (action === 'resume') return game.resume(session)
        if (action === 'position') return game.position(session)
        if (action === 'answer' && smallInteger(index) && smallInteger(choice)) return game.answer(session, index, choice)
        if (action === 'next' && smallInteger(index)) return game.next(session, index)
        if (action === 'launch' && smallInteger(index) && uuid(requestId)) return game.launch(session, requestId, index)
        throw new GameError('Operação inválida.')
      }
      res.end(JSON.stringify(await dispatch()))
    } catch (error) {
      if (!(error instanceof GameError)) console.error('Falha no ProbMath', error instanceof Error ? error.name : 'UnknownError')
      res.statusCode = error instanceof GameError ? error.status : 503
      res.end(JSON.stringify({ error: error instanceof GameError ? error.message : 'O serviço está temporariamente indisponível. Tente novamente.' }))
    }
  }
}
