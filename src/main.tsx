import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Shell } from './components/Shell'
import { useGame } from './hooks/useGame'
import { usePublicData } from './hooks/usePublicData'
import { Home, Instructions } from './pages/Home'
import { Play } from './pages/Play'
import { RankingPage } from './pages/Ranking'
import { Teachers } from './pages/Teachers'
import './styles.css'

const pages = ['inicio', 'jogar', 'ranking', 'como-jogar', 'professores']
function currentPage() {
  const hash = window.location.hash.slice(1)
  return pages.includes(hash) ? hash : 'inicio'
}

function App() {
  const [page, setPage] = useState(currentPage)
  const { stats, ranking, maxAttempts, error } = usePublicData()
  const game = useGame()
  useEffect(() => {
    function change() {
      setPage(currentPage())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', change)
    return () => window.removeEventListener('hashchange', change)
  }, [])
  return <Shell page={page}>
    {page === 'inicio' && <Home stats={stats} error={error} maxAttempts={maxAttempts}/>}
    {page === 'jogar' && <Play controller={game} ranking={ranking}/>}
    {page === 'ranking' && <RankingPage ranking={ranking} error={error} highlight={game.game?.nickname}/>}
    {page === 'como-jogar' && <Instructions standalone maxAttempts={maxAttempts}/>}
    {page === 'professores' && <Teachers ranking={ranking}/>}
  </Shell>
}

createRoot(document.getElementById('root')!).render(<App/>)

