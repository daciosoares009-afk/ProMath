import { useEffect, useRef, useState } from 'react'
import type { Drop, Game } from '../../shared/model'
import { api, ApiError, message, newSession, randomId, type Session } from '../services/api'

type Pending = { requestId: string; index: number }
type Saved = { session: Session; nickname: string; pending?: Pending }
const KEY = 'probmath:game'
function read(): Saved | null {
  try { return JSON.parse(localStorage.getItem(KEY) ?? 'null') } catch { return null }
}
function write(saved: Saved | null) {
  try {
    if (saved) localStorage.setItem(KEY, JSON.stringify(saved))
    else localStorage.removeItem(KEY)
  } catch { /* A partida continua nesta aba se o armazenamento estiver bloqueado. */ }
}

export function useGame() {
  const saved = useRef(read())
  const [game, setGame] = useState<Game | null>(null)
  const [screen, setScreen] = useState<'quiz' | 'summary' | 'machine' | 'complete'>('quiz')
  const [drop, setDrop] = useState<Drop | null>(null)
  const [launches, setLaunches] = useState(0)
  const [busy, setBusy] = useState(false)
  const [restoring, setRestoring] = useState(Boolean(saved.current))
  const [error, setError] = useState('')
  const queued = useRef<Game | null>(null)
  const locked = useRef(false)
  function save(value: Saved | null) { saved.current = value; write(value) }
  async function task(work: () => Promise<void>) {
    if (locked.current) return
    locked.current = true
    setBusy(true)
    setError('')
    try { await work() }
    catch (error) {
      if (error instanceof ApiError && error.status === 410) {
        save(null)
        setGame(null)
        setDrop(null)
        setScreen('quiz')
      }
      setError(message(error))
    }
    finally { locked.current = false; setBusy(false) }
  }
  async function restore() {
    const current = saved.current
    if (!current) return
    setRestoring(true)
    await task(async () => {
      try {
        const result = await api<{ game: Game; launches: number }>('resume', current.session)
        setGame(result.game)
        setLaunches(result.launches)
        setScreen(current.pending ? 'machine' : result.game.stage === 'machine' && !result.launches ? 'summary' : result.game.stage)
      } catch (error) {
        if (error instanceof ApiError && (error.status === 404 || error.status === 410)) save(null)
        throw error
      }
    })
    setRestoring(false)
  }
  useEffect(() => { void restore() }, [])
  function start(nickname: string) {
    return task(async () => {
      const current = saved.current?.nickname === nickname && !game ? saved.current : { session: newSession(), nickname }
      save(current)
      try {
        const next = await api<Game>('start', { ...current.session, nickname })
        setGame(next)
        setLaunches(0)
        setDrop(null)
        setScreen(next.stage === 'machine' ? 'summary' : next.stage)
      } catch (error) {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) save(null)
        throw error
      }
    })
  }
  function answer(choice: number) {
    if (!game || !saved.current) return
    const { session } = saved.current
    return task(async () => {
      const result = await api<{ game: Game }>('answer', { ...session, index: game.index, choice })
      setGame(result.game)
    })
  }
  function next() {
    if (!game || !saved.current) return
    const { session } = saved.current
    return task(async () => {
      const result = await api<Game>('next', { ...session, index: game.index })
      setGame(result)
      setScreen(result.stage === 'quiz' ? 'quiz' : 'summary')
    })
  }
  function launch() {
    const current = saved.current
    if (!game || !current || queued.current) return
    return task(async () => {
      const pending = current.pending ?? { requestId: randomId(), index: launches }
      save({ ...current, pending })
      try {
        const result = await api<{ game: Game; drop: Drop }>('launch', { ...current.session, ...pending })
        queued.current = result.game
        setDrop(result.drop)
      } catch (error) {
        if (error instanceof ApiError && error.status === 409) {
          const result = await api<{ game: Game; launches: number }>('resume', current.session)
          save({ ...current, pending: undefined })
          setGame(result.game)
          setLaunches(result.launches)
          setScreen(result.game.stage)
        }
        throw error
      }
    })
  }
  function settle() {
    const result = queued.current
    if (!result) return
    queued.current = null
    const current = saved.current
    if (current) {
      setLaunches((current.pending?.index ?? launches) + 1)
      save({ ...current, pending: undefined })
    }
    setGame(result)
  }
  function reset() {
    save(null)
    setGame(null)
    setDrop(null)
    setError('')
    setScreen('quiz')
  }
  return { game, screen, setScreen, busy, restoring, error, saved: saved.current, restore, start, answer, next, launch, drop, settle, reset, animating: Boolean(queued.current) }
}

