import { randomBytes, randomUUID } from 'node:crypto'
import { Readable } from 'node:stream'
import type { IncomingMessage, ServerResponse } from 'node:http'
import assert from 'node:assert/strict'
import test from 'node:test'
import type { Game } from '../shared/model.ts'
import { handler } from '../server/http.ts'
import { INITIAL_QUESTIONS } from '../server/questions.ts'
import { sqliteStore } from '../server/sqlite.ts'

test('API valida sessão, preserva gabarito e protege gravações administrativas', async () => {
  const store = sqliteStore(':memory:')
  await store.run(async tx => {
    for (const question of INITIAL_QUESTIONS) tx.set('questions', question.id, question)
    tx.set('admins', 'teacher', { grantedAt: Date.now() })
  })
  try {
    const endpoint = handler(() => ({ store, verify: async token => ({ uid: token }) }))
    async function post(body: object, token?: string) {
      const req = Object.assign(Readable.from([JSON.stringify(body)]), {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: token && `Bearer ${token}` },
      })
      let output: unknown
      const res = { statusCode: 200, setHeader() {}, end(value: string) { output = JSON.parse(value) } }
      await endpoint(req as unknown as IncomingMessage, res as unknown as ServerResponse)
      return { status: res.statusCode, output }
    }
    const credentials = { id: randomUUID(), secret: randomBytes(32).toString('hex') }
    const { output, status } = await post({ action: 'start', ...credentials, nickname: 'Feira Um' })
    assert.equal(status, 200)
    assert.ok((output as Game).question)
    assert.equal('correct' in (output as Game).question!, false)
    assert.equal((await post({ action: 'answer', ...credentials, index: 0, choice: 10 })).status, 400)
    assert.equal((await post({ action: 'launch', ...credentials, index: 0, requestId: randomUUID(), points: 500 })).status, 409)
    assert.equal((await post({ action: 'resume', ...credentials, secret: '0'.repeat(64) })).status, 404)
    assert.equal((await post({ action: 'admin:rules', maxAttempts: 5, blockedWords: [] })).status, 401)
    assert.equal((await post({ action: 'admin:rules', maxAttempts: 5, blockedWords: [] }, 'guest')).status, 403)
    assert.equal((await post({ action: 'admin:rules', maxAttempts: 5, blockedWords: [] }, 'teacher')).status, 200)
    assert.deepEqual(await post({ action: 'rules' }), { status: 200, output: { maxAttempts: 5 } })
  } finally { store.close() }
})
