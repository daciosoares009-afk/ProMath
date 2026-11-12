import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { defineConfig, loadEnv, normalizePath, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { sqliteStore } from './server/sqlite'
import { handler, type Backend } from './server/http'
import { INITIAL_QUESTIONS } from './server/questions'

function localApi(): Plugin {
  let backend: Promise<Backend> | undefined
  async function createBackend(): Promise<Backend> {
    if (process.env.PROBMATH_BACKEND === 'firebase') {
      const moduleUrl = new URL('./server/firebase.ts', import.meta.url).href
      const { firebaseServer } = await import(moduleUrl) as typeof import('./server/firebase.ts')
      const { auth, store } = firebaseServer()
      return { store, verify: token => auth.verifyIdToken(token, true) }
    }
    const path = process.env.PROBMATH_SQLITE_PATH || '.local/probmath.sqlite'
    mkdirSync(dirname(path), { recursive: true })
    const store = sqliteStore(path)
    await store.run(async tx => {
      if (!(await tx.list('questions', { limit: 1 })).length) {
        for (const question of INITIAL_QUESTIONS) tx.set('questions', question.id, question)
      }
    })
    return { store }
  }
  const api = handler(() => {
    backend ??= createBackend().catch(error => { backend = undefined; throw error })
    return backend
  })
  return {
    name: 'probmath-api',
    configureServer(server) { server.middlewares.use('/api/probmath', api) },
    configurePreviewServer(server) { server.middlewares.use('/api/probmath', api) },
  }
}
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const root = normalizePath(process.cwd())
  for (const [name, value] of Object.entries(env)) {
    if (/^(FIREBASE_|FIRESTORE_|PROBMATH_)/.test(name) && process.env[name] === undefined) process.env[name] = value
  }
  return {
    define: { __PROBMATH_FIREBASE__: JSON.stringify(Boolean(process.env.VERCEL || process.env.PROBMATH_BACKEND === 'firebase')) },
    server: { fs: { deny: [
      '.env', '.env.*', '*.{crt,pem,key,p12,pfx,cer,der}', '.npmrc', '.yarnrc.yml', '**/.git/**',
      '**/.local/**', '**/*.sqlite', '**/*.sqlite-shm', '**/*.sqlite-wal',
      ...['api', 'server', 'scripts', 'tests'].map(dir => `${root}/${dir}/**`),
    ] } },
    plugins: [react(), tailwindcss(), localApi()],
  }
})
