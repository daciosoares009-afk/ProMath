import { ArrowDown, ArrowRight, BookOpen, BrainCircuit, ChartNoAxesColumnIncreasing, CircleHelp, Coins, Gamepad2, Play, Trophy, Users } from 'lucide-react'
import type { PublicStats } from '../../shared/model'
import { number } from '../../shared/model'
import { Board } from '../components/Board'
import { Notice } from '../components/UI'

const steps = [
  { icon: BrainCircuit, title: 'Resolva o quiz', text: 'São cinco perguntas de matemática, com quatro alternativas e explicação para cada resposta.' },
  { icon: Coins, title: 'Conquiste fichas', text: 'Cada acerto rende uma ficha. Use suas fichas para lançar bolinhas na máquina.' },
  { icon: Trophy, title: 'Some pontos', text: 'A pontuação depende do compartimento onde cada bolinha cai. Veja sua colocação no ranking.' },
]
export function Instructions({ standalone = false, maxAttempts }: { standalone?: boolean; maxAttempts: number | null }) {
  return <section className={`wrap instructions ${standalone ? 'standalone' : ''}`} id="instrucoes">
    <div className="section-head"><div><span className="eyebrow"><BookOpen size={14}/> REGRAS DO JOGO</span>
      {standalone ? <h1>Como jogar</h1> : <h2>Como jogar</h2>}</div>
      {standalone ? <a className="button primary" href="#jogar">Jogar agora <ArrowRight size={17}/></a> : <a className="text-link" href="#como-jogar">Ver regulamento <ArrowRight size={16}/></a>}
    </div>
    <div className="step-grid">{steps.map(({ icon: Icon, title, text }, i) =>
      <article className="step panel" key={title}><div className="step-top"><span className={i === 1 ? 'gold icon-box' : 'icon-box'}><Icon size={23}/></span><span className="step-number">0{i + 1}</span></div><h3>{title}</h3><p>{text}</p></article>)}</div>
    {standalone && <div className="regulations panel">
      <h2>Regulamento da competição</h2>
      <ul>
        <li>Há {maxAttempts ? `até ${maxAttempts} tentativas` : 'um limite de tentativas definido pela organização'} por apelido. Variações de acentos, maiúsculas, espaços e pontuação contam para o mesmo apelido.</li>
        <li>Uma partida em andamento pode ser retomada no mesmo navegador por 30 minutos. Começar uma partida conta como tentativa, inclusive em caso de abandono.</li>
        <li>Cada acerto rende uma ficha e cada lançamento consome uma ficha. As fichas são virtuais, sem valor monetário e intransferíveis.</li>
        <li>O ranking mostra a melhor partida por apelido. A ordem é maior pontuação, mais acertos e conclusão mais antiga. Se os três critérios coincidirem, vale a ordem do identificador interno.</li>
        <li>A máquina toma quatro decisões independentes, cada uma com 50% de chance de seguir para cada lado. O total de desvios à direita determina um dos cinco compartimentos.</li>
      </ul>
    </div>}
  </section>
}

export function Home({ stats, error, maxAttempts }: { stats: PublicStats | null; error: string; maxAttempts: number | null }) {
  return <>
    <section className="hero">
      <div className="wrap hero-grid">
        <div className="hero-copy">
          <span className="event"><span/> FEIRA INTERDISCIPLINAR DE MATEMÁTICA</span>
          <h1>O desafio da<br/><em>probabilidade<span>.</span></em></h1>
          <p className="hero-slogan">Seu conhecimento conquista fichas.<br/>A Matemática explica as chances!</p>
          <div className="hero-actions"><a className="button primary" href="#jogar"><Play size={18} fill="currentColor"/> Jogar agora <ArrowRight className="arrow" size={17}/></a><a className="button secondary" href="#ranking"><Trophy size={18}/> Ver ranking</a></div>
          <a className="text-link hero-help" href="#como-jogar"><CircleHelp size={17}/> Como jogar <ArrowDown size={14}/></a>
        </div>
        <div className="hero-machine panel">
          <div className="machine-heading"><span className="mini-icon"><ChartNoAxesColumnIncreasing size={19}/></span><div><strong>Máquina da Probabilidade</strong><small>Máquina de Galton</small></div><span className="preview-label"><span/> Prévia animada</span></div>
          <Board preview />
        </div>
        <div className="stats-strip">
          <div><Users size={19}/><span><b>{stats ? number(stats.participants) : '—'}</b> participantes</span></div>
          <div><Gamepad2 size={19}/><span><b>{stats ? number(stats.games) : '—'}</b> partidas iniciadas</span></div>
        </div>
        <Notice>{error}</Notice>
      </div>
    </section>
    <Instructions maxAttempts={maxAttempts}/>
  </>
}
