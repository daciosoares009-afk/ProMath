import { useEffect, useState } from 'react'
import { collection, doc, limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import { api, message } from '../services/api'
import { db } from '../services/firebase'
import type { Ranking, PublicStats } from '../../shared/model'

type PublicData = PublicStats & { ranking: Ranking[]; maxAttempts: number }
export function usePublicData() {
  const [stats, setStats] = useState<PublicStats | null>(null)
  const [ranking, setRanking] = useState<Ranking[] | null>(null)
  const [maxAttempts, setMaxAttempts] = useState<number | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    let pending = false
    const refresh = async () => {
      if (pending) return
      pending = true
      try {
        const data = await api<PublicData>(db ? 'rules' : 'public')
        if (active) {
          if (!db) { setStats(data); setRanking(data.ranking) }
          setMaxAttempts(data.maxAttempts)
          if (!db) setError('')
        }
      } catch (error) {
        if (active && !db) setError(message(error))
      } finally { pending = false }
    }
    void refresh()
    const timer = window.setInterval(refresh, db ? 30_000 : 3000)
    const unsubscribers = db ? [
      onSnapshot(doc(db, 'publicStats', 'global'), snapshot => {
        setStats(snapshot.exists() ? snapshot.data() as PublicStats : { participants: 0, games: 0 })
      }, () => setError('Os indicadores em tempo real estão indisponíveis.')),
      onSnapshot(query(collection(db, 'rankings'), orderBy('points', 'desc'), orderBy('correct', 'desc'), orderBy('completedAt'), limit(100)),
        snapshot => { setRanking(snapshot.docs.map(row => row.data() as Ranking)); setError('') },
        () => setError('O ranking em tempo real está indisponível.')),
    ] : []
    return () => { active = false; window.clearInterval(timer); unsubscribers.forEach(unsubscribe => unsubscribe()) }
  }, [])
  return { stats, ranking, maxAttempts, error }
}
