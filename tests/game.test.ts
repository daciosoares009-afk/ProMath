import { randomBytes, randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync, rmdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import assert from 'node:assert/strict'
import test from 'node:test'
import { BINS, compareRanking, draw, type Decision, type Game, type Ranking, type Stats } from '../shared/model.ts'
import { requireTeacher, saveQuestion, saveRules } from '../server/admin.ts'
import { gameService, selectQuestions } from '../server/game.ts'
import { INITIAL_QUESTIONS } from '../server/questions.ts'
import { sqliteStore } from '../server/sqlite.ts'

const session = () => ({ id: randomUUID(), secret: randomBytes(32).toString('hex') })
async function fixture(path = ':memory:') {
  const store = sqliteStore(path)
  await store.run(async tx => {
    for (const question of INITIAL_QUESTIONS) tx.set('questions', question.id, question)
  })
  return { store, game: gameService(store, () => 1) }
}
function choiceFor(game: Game, correct: boolean) {
  const question = INITIAL_QUESTIONS.find(row => row.id === game.question?.id)!
  const right = game.question!.options.indexOf(question.options[question.correct])
  return correct ? right : (right + 1) % 4
}
async function quiz(game: ReturnType<typeof gameService>, player: ReturnType<typeof session>, starting: Game, correct: number) {
  let current = starting
  for (let i = 0; i < 5; i++) {
    assert.equal(current.index, i)
    const choice = choiceFor(current, i < correct)
    await game.answer(player, i, choice)
    current = await game.next(player, i)
  }
  return current
}

test('banco inicial, seleção sem repetição e gabarito privado', async () => {
  assert.equal(INITIAL_QUESTIONS.length, 50)
  assert.equal(new Set(INITIAL_QUESTIONS.map(q => q.prompt)).size, 50)
  for (const q of INITIAL_QUESTIONS) {
    assert.equal(new Set(q.options).size, 4)
    assert.ok(q.options[q.correct])
    assert.ok(q.explanation)
  }
  for (let i = 0; i < 25; i++) {
    const questions = selectQuestions(INITIAL_QUESTIONS)
    assert.equal(questions.length, 5)
    assert.equal(new Set(questions.map(q => q.id)).size, 5)
    assert.equal(new Set(questions.map(q => q.difficulty)).size, 3)
  }
  const { game } = await fixture()
  const starting = await game.start(session(), 'Jogadora')
  assert.ok(starting.question)
  assert.equal('correct' in starting.question, false)
  assert.equal('explanation' in starting.question, false)
})

test('resposta confirmada é idempotente e apenas o acerto concede ficha', async () => {
  const { game, store } = await fixture()
  const player = session()
  const started = await game.start(player, 'Jogadora')
  await assert.rejects(game.next(player, 0), /Confirme/)
  await assert.rejects(game.answer(player, 1, 2), /inválida/)
  const right = choiceFor(started, true)
  const results = await Promise.all([game.answer(player, 0, right), game.answer(player, 0, right)])
  assert.deepEqual(results[0], results[1])
  assert.equal(results[0].game.tokens, 1)
  await assert.rejects(game.answer(player, 0, (right + 1) % 4), /já foi confirmada/)
  const second = await game.next(player, 0)
  const wrong = await game.answer(player, 1, choiceFor(second, false))
  assert.equal(wrong.game.tokens, 1)
  assert.equal(wrong.game.correct, 1)
  const stats = await store.run(tx => tx.get<Stats>('adminStats', 'global'))
  assert.equal(stats?.correct, 1)
  assert.equal(stats?.wrong, 1)
})

test('cinco acertos rendem cinco fichas e permitem exatamente cinco lançamentos', async () => {
  const { game, store } = await fixture()
  const player = session()
  const starting = await game.start(player, 'Maratona')
  const result = await quiz(game, player, starting, 5)
  assert.equal(result.tokens, 5)
  assert.equal(result.index, 5)
  assert.equal(result.stage, 'machine')
  await assert.rejects(game.answer(player, 5, 0), /inválida/)
  for (let i = 0; i < 5; i++) {
    const launched = await game.launch(player, randomUUID(), i)
    assert.equal(launched.game.tokens, 4 - i)
    assert.equal(launched.game.points, 100 * (i + 1))
  }
  await assert.rejects(game.launch(player, randomUUID(), 5), /indisponível/)
  const stats = await store.run(tx => tx.get<Stats>('adminStats', 'global'))
  assert.equal(stats?.spent, 5)
  assert.equal(stats?.completed, 1)
  assert.deepEqual(stats?.bins, [0, 0, 0, 0, 5])
})

test('lançamentos concorrentes debitam uma vez e persistem pontuação, recibo e ranking', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'probmath-'))
  const path = join(dir, 'game.sqlite')
  const { game, store } = await fixture(path)
  let secondStore: ReturnType<typeof sqliteStore> | undefined
  try {
    const player = session()
    const started = await game.start(player, 'Finalista')
    await quiz(game, player, started, 2)
    const requestId = randomUUID()
    const [winner, loser] = await Promise.allSettled([
      game.launch(player, requestId, 0), game.launch(player, randomUUID(), 0),
    ])
    assert.equal(winner.status, 'fulfilled')
    assert.equal(loser.status, 'rejected')
    assert.equal((await store.run(tx => tx.list('launches'))).length, 1)
    secondStore = sqliteStore(path)
    const reopened = gameService(secondStore, () => 0)
    const replay = await reopened.launch(player, requestId, 0)
    assert.equal(replay.game.tokens, 1)
    assert.equal(replay.game.stage, 'machine')
    assert.equal(replay.game.points, 100)
    assert.equal(replay.drop.points, 100)
    await assert.rejects(reopened.launch(player, requestId, 1), /já utilizado/)
    const last = await reopened.launch(player, randomUUID(), 1)
    assert.equal(last.game.tokens, 0)
    assert.equal(last.game.stage, 'complete')
    assert.deepEqual(await reopened.position(player), { position: 1, rankedPoints: 100 })
  } finally {
    secondStore?.close()
    store.close()
    rmSync(path, { force: true })
    rmdirSync(dir)
  }
})

test('tentativa por apelido normalizado, bloqueio de ofensas e autenticação da sessão', async () => {
  const { game, store } = await fixture()
  await saveRules(store, { maxAttempts: 1, blockedWords: ['ofensa'] })
  const player = session()
  await assert.rejects(game.start(session(), 'O-f-e-n-s-a'), /outro apelido/)
  const first = await game.start(player, 'Júlia')
  assert.deepEqual(await game.start(player, 'Outro apelido'), first)
  await assert.rejects(game.resume({ ...player, secret: session().secret }), /sessão inválida/)
  await assert.rejects(game.start(session(), 'Ju lia'), /andamento/)
  const final = await quiz(game, player, first, 0)
  assert.equal(final.stage, 'complete')
  assert.equal(final.tokens, 0)
  await assert.rejects(game.start(session(), 'JULIA'), /limite/)
})

test('desempates usam pontos, acertos, horário e identificador, nessa ordem', () => {
  const row = (id: string, points: number, correct: number, completedAt: number): Ranking => ({ id, nickname: id, points, correct, completedAt })
  const entries = [row('e', 50, 3, 20), row('d', 100, 3, 30), row('b', 100, 4, 20), row('c', 100, 4, 30), row('a', 100, 4, 20)]
  assert.deepEqual(entries.sort(compareRanking).map(value => value.id), ['a', 'b', 'c', 'd', 'e'])
})

test('os 16 caminhos equiprováveis reproduzem a distribuição exata', () => {
  const counts = [0, 0, 0, 0, 0]
  for (let bits = 0; bits < 16; bits++) {
    let index = 0
    const drop = draw(() => ((bits >> index++) & 1) as Decision)
    assert.equal(index, 4)
    assert.equal(drop.bin, drop.path.reduce<number>((a, b) => a + b, 0))
    assert.equal(drop.points, BINS[drop.bin].points)
    counts[drop.bin]++
  }
  assert.deepEqual(counts, [1, 4, 6, 4, 1])
  assert.deepEqual(counts.map(count => count / 16), BINS.map(bin => bin.probability))
})

test('administrador exige autenticação válida e autorização explícita', async () => {
  const { store } = await fixture()
  const verify = async (token: string) => {
    if (token === 'invalid') throw new Error('invalid')
    return { uid: token }
  }
  await assert.rejects(requireTeacher(store, '', verify), { status: 401 })
  await assert.rejects(requireTeacher(store, 'invalid', verify), { status: 401 })
  await assert.rejects(requireTeacher(store, 'participant', verify), { status: 403 })
  await store.run(async tx => tx.set('admins', 'teacher', { grantedAt: Date.now() }))
  assert.deepEqual(await requireTeacher(store, 'teacher', verify), { uid: 'teacher' })
  await assert.rejects(requireTeacher(store, 'participant', verify), { status: 403 })
  assert.deepEqual(await saveQuestion(store, { ...INITIAL_QUESTIONS[0], active: false }), { saved: true })
  assert.throws(() => saveQuestion(store, { ...INITIAL_QUESTIONS[0], correct: 4 }), /Preencha/)
})
