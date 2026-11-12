import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Crown, Maximize2, Minimize2, Trophy } from 'lucide-react'
import { number, type Ranking as Entry } from '../../shared/model'
import { Loading, Notice } from '../components/UI'

const date = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

export function RankingTable({ ranking, highlight }: { ranking: Entry[]; highlight?: string }) {
  if (!ranking.length) return <div className="empty"><Trophy size={25}/><p>O ranking começa quando a primeira partida for concluída.</p></div>
  return <div className="table-scroll"><table>
    <thead><tr><th scope="col">Posição</th><th scope="col">Apelido</th><th scope="col">Acertos</th><th scope="col">Pontuação</th><th scope="col">Horário</th></tr></thead>
    <tbody>{ranking.map((row, i) => <tr key={row.id} className={row.nickname === highlight ? 'own' : ''}>
      <td><span className={`place place-${i + 1}`}>{i === 0 && <Crown size={16}/>} {i + 1}º</span></td>
      <th scope="row">{row.nickname}</th><td>{row.correct}/5</td><td className="points">{number(row.points)}</td>
      <td><time dateTime={new Date(row.completedAt).toISOString()}>{date.format(row.completedAt)}</time></td>
    </tr>)}</tbody>
  </table></div>
}

export function RankingPage({ ranking, highlight, error }: { ranking: Entry[] | null; highlight?: string; error: string }) {
  const section = useRef<HTMLElement>(null)
  const [projector, setProjector] = useState(false)
  const [fullscreenError, setFullscreenError] = useState('')
  useEffect(() => {
    const change = () => setProjector(document.fullscreenElement === section.current)
    document.addEventListener('fullscreenchange', change)
    return () => document.removeEventListener('fullscreenchange', change)
  }, [])
  async function toggle() {
    setFullscreenError('')
    try {
      if (projector) await document.exitFullscreen()
      else if (section.current?.requestFullscreen) await section.current.requestFullscreen()
      else setFullscreenError('O navegador não oferece tela cheia nesta janela.')
    } catch { setFullscreenError('O navegador não permitiu entrar em tela cheia.') }
  }
  return <section ref={section} className={`ranking-page ${projector ? 'projector' : ''}`}>
    <div className="wrap standalone">
      {!projector && <a className="text-link back" href="#inicio"><ArrowLeft size={16}/> Voltar ao início</a>}
      <div className="section-head"><div><span className="eyebrow"><Trophy size={16}/> CLASSIFICAÇÃO</span><h1>Ranking</h1><p>Melhor partida de cada apelido. Até 100 posições.</p></div>
        <button className="button secondary" onClick={() => void toggle()}>{projector ? <Minimize2 size={17}/> : <Maximize2 size={17}/>} {projector ? 'Sair da tela cheia' : 'Tela cheia'}</button></div>
      <Notice>{error || fullscreenError}</Notice>
      <div className="panel">{ranking ? <RankingTable ranking={ranking} highlight={highlight}/> : !error && <Loading/>}</div>
      <a className="text-link ranking-rules" href="#como-jogar">Regulamento e desempates</a>
    </div>
  </section>
}
