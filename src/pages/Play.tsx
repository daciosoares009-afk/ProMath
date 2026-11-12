import { useEffect, useRef, useState, type FormEvent } from 'react'
import gsap from 'gsap'
import { ArrowLeft, ArrowRight, Check, CheckCircle2, CircleHelp, Coins, Crosshair, Gamepad2, Play as PlayIcon, Target, Trophy, UserRound, Volume2, VolumeX, X } from 'lucide-react'
import type { Ranking } from '../../shared/model'
import { number, QUESTION_COUNT } from '../../shared/model'
import { Board } from '../components/Board'
import { Loading, Notice } from '../components/UI'
import { useGame } from '../hooks/useGame'
import { api } from '../services/api'

type Controller = ReturnType<typeof useGame>

export function Play({ controller, ranking }: { controller: Controller; ranking: Ranking[] | null }) {
  const { game, screen, saved, busy, restoring, error, restore, start, reset, setScreen } = controller
  const [name, setName] = useState(saved?.nickname ?? '')
  const [result, setResult] = useState<{ position: number; rankedPoints: number } | null>(null)
  const [positionError, setPositionError] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const positionLive = ranking?.some(row => row.nickname === game?.nickname)
  useEffect(() => {
    if (!root.current || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const animation = gsap.fromTo(root.current, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.32, clearProps: 'opacity,transform' })
    return () => { animation.kill() }
  }, [screen, Boolean(game)])
  useEffect(() => {
    if (!game || screen !== 'complete' || !saved) return
    let active = true
    setResult(null)
    setPositionError(false)
    void api<{ position: number; rankedPoints: number }>('position', saved.session).then(
      value => { if (active) setResult(value) }, () => { if (active) setPositionError(true) },
    )
    return () => { active = false }
  }, [screen, game?.id])
  const retry = () => { setName(game?.nickname ?? saved?.nickname ?? ''); reset() }
  function submit(event: FormEvent) {
    event.preventDefault()
    void start(name.trim())
  }
  return <div className={`wrap play-page ${screen === 'machine' ? 'wide' : ''}`} ref={root}>
    <a className="text-link back" href="#inicio"><ArrowLeft size={16}/> Voltar ao início</a>
    {restoring ? <Loading>Recuperando partida…</Loading> : !game ?
      <section className="panel game-card identity">
        <span className="icon-box"><Gamepad2 size={27}/></span>
        <h1>Vamos jogar?</h1><p>Escolha o apelido que aparecerá no ranking.</p>
        <form onSubmit={submit}>
          <label htmlFor="nickname">Seu apelido</label>
          <div className="input-icon"><UserRound size={18}/><input id="nickname" autoComplete="off" placeholder="Digite seu apelido" minLength={3} maxLength={20} required value={name} onChange={event => setName(event.target.value)} disabled={busy}/></div>
          <small>De 3 a 20 caracteres.</small>
          <Notice>{error}</Notice>
          {saved && error && <button className="button secondary" type="button" onClick={() => void restore()} disabled={busy}>Recuperar partida</button>}
          <button className="button primary w-full justify-center" disabled={busy}>{busy ? 'Iniciando…' : 'Começar quiz'} <ArrowRight size={18}/></button>
        </form>
        <a className="text-link" href="#como-jogar"><CircleHelp size={17}/> Como jogar</a>
      </section>
    : screen === 'quiz' ? <Quiz controller={controller} key={game.question?.id}/>
    : screen === 'summary' ? <section className="panel game-card summary">
      <span className="icon-box gold"><Target size={27}/></span>
      <h1>Quiz concluído</h1>
      <p>{game.tokens ? 'Suas fichas estão prontas para a Máquina da Probabilidade.' : 'Você pode tentar novamente dentro do limite do regulamento.'}</p>
      <div className="metrics-grid">
        <Metric label="Acertos" value={game.correct}/><Metric label="Erros" value={QUESTION_COUNT - game.correct}/>
        <Metric label="Aproveitamento" value={`${game.correct * 20}%`}/><Metric label="Fichas" value={game.tokens} gold/>
      </div>
      <button className="button primary" onClick={() => setScreen(game.tokens ? 'machine' : 'complete')}>{game.tokens ? 'Ir para a máquina' : 'Ver resultado'} <ArrowRight size={18}/></button>
      {!game.tokens && <button className="button secondary" onClick={retry}>Tentar novamente</button>}
    </section>
    : screen === 'machine' ? <Machine controller={controller}/>
    : <section className="panel game-card summary">
      <span className="icon-box gold"><Trophy size={29}/></span>
      <h1>Partida concluída</h1><p>{game.nickname}, seu resultado foi registrado.</p>
      <div className="metrics-grid">
        <Metric label="Pontos da partida" value={number(game.points)} gold/>
        <Metric label="Acertos" value={`${game.correct} / ${QUESTION_COUNT}`}/>
        <Metric label="Posição do apelido" value={result ? `${number(result.position)}º` : positionError ? '—' : '…'}/>
      </div>
      {result && result.rankedPoints !== game.points && <p>Sua melhor partida no ranking tem {number(result.rankedPoints)} pontos.</p>}
      {result && !positionLive && result.position > 100 && <p>O ranking público mostra os 100 primeiros.</p>}
      <Notice>{positionError && 'A posição está temporariamente indisponível. Consulte o ranking.'}</Notice>
      <a className="button primary" href="#ranking">Ver ranking <ArrowRight size={17}/></a>
      <button className="button secondary" onClick={retry}>Jogar novamente</button>
    </section>}
  </div>
}
function Metric({ label, value, gold }: { label: string; value: string | number; gold?: boolean }) {
  return <div className={`metric ${gold ? 'gold' : ''}`}><strong>{value}</strong><span>{label}</span></div>
}

function Quiz({ controller }: { controller: Controller }) {
  const { game, answer, next, error, busy } = controller
  const [selected, select] = useState<number | null>(null)
  const coin = useRef<HTMLSpanElement>(null)
  const confirmed = game?.answer
  const won = Boolean(confirmed && confirmed.choice === confirmed.correct)
  useEffect(() => {
    if (won && coin.current && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const tween = gsap.fromTo(coin.current, { scale: 0.7, y: 7 }, { scale: 1, y: 0, duration: 0.55, ease: 'back.out(2.4)' })
      return () => { tween.kill() }
    }
  }, [won])
  if (!game?.question) return null
  const { question, index } = game
  const activeChoice = confirmed?.choice ?? selected
  return <section className="panel game-card quiz">
    <div className="game-top"><span><Crosshair size={17}/> Questão {index + 1} de {QUESTION_COUNT}</span><span className="flex gap-4"><span><CheckCircle2 size={16}/> {game.correct} acertos</span><span ref={coin} className="gold"><Coins size={17}/> {game.tokens} fichas</span></span></div>
    <div className="progress" role="progressbar" aria-label="Progresso do quiz" aria-valuenow={index + Number(Boolean(confirmed))} aria-valuemax={QUESTION_COUNT}>
      <div style={{ width: `${(index + Number(Boolean(confirmed))) / QUESTION_COUNT * 100}%` }}/>
    </div>
    <div className="question-meta"><span>{question.category}</span><span>{question.difficulty}</span></div>
    <h1>{question.prompt}</h1>
    <fieldset className="options" disabled={busy || Boolean(confirmed)}><legend className="sr-only">Escolha uma alternativa</legend>
      {question.options.map((option, i) => {
        const status = confirmed?.correct === i ? 'right' : confirmed?.choice === i ? 'wrong' : activeChoice === i ? 'selected' : ''
        return <label className={`option ${status}`} key={i}>
          <input type="radio" name="choice" checked={activeChoice === i} onChange={() => select(i)}/><span className="letter">{'ABCD'[i]}</span><span>{option}</span>
          {status === 'right' && <Check size={19}/>}
          {status === 'wrong' && <X size={19}/>}
        </label>
      })}
    </fieldset>
    {confirmed && <div className={`feedback ${won ? 'right' : 'wrong'}`} role="status"><strong>{won ? 'Resposta correta. Você ganhou uma ficha!' : 'Resposta incorreta.'}</strong><p>{confirmed.explanation}</p></div>}
    <Notice>{error}</Notice>
    <div className="game-actions">
      {confirmed ? <button className="button primary" disabled={busy} onClick={() => void next()}>{index === QUESTION_COUNT - 1 ? 'Ver resultado do quiz' : 'Próxima questão'} <ArrowRight size={17}/></button>
        : <button className="button primary" disabled={selected === null || busy} onClick={() => selected !== null && void answer(selected)}>{busy ? 'Confirmando…' : 'Confirmar resposta'} <Check size={17}/></button>}
    </div>
  </section>
}

function playChime(context: AudioContext, won: boolean) {
  if (context.state !== 'running') return
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  oscillator.type = 'sine'
  const t = context.currentTime
  oscillator.frequency.setValueAtTime(won ? 620 : 290, t)
  oscillator.frequency.exponentialRampToValueAtTime(won ? 960 : 210, t + 0.18)
  gain.gain.setValueAtTime(0.11, t)
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25)
  oscillator.connect(gain).connect(context.destination)
  oscillator.start()
  oscillator.stop(t + 0.26)
}
function Machine({ controller }: { controller: Controller }) {
  const { game, launch, drop, busy, saved, settle, animating, setScreen, error } = controller
  const [sound, setSound] = useState(false)
  const audio = useRef<AudioContext | null>(null)
  useEffect(() => () => { void audio.current?.close() }, [])
  function toggleSound() {
    if (!sound) {
      audio.current ??= new AudioContext()
      void audio.current.resume().catch(() => {})
    }
    setSound(!sound)
  }
  if (!game) return null
  const pending = Boolean(saved?.pending)
  const done = game.stage === 'complete' && !pending
  return <section className="machine-page">
    <div className="machine-page-header"><div><h1>Máquina da Probabilidade</h1><p>Quatro desvios, cinco compartimentos.</p></div><button type="button" className="button secondary" onClick={toggleSound} aria-pressed={sound}>{sound ? <Volume2 size={18}/> : <VolumeX size={18}/>} Som</button></div>
    <div className="machine-play-grid">
      <div className="hero-machine panel">
        <div className="machine-heading"><span className="mini-icon"><Crosshair size={20}/></span><div><strong>Máquina de Galton</strong><small>Pontos e probabilidades por compartimento</small></div></div>
        <Board drop={drop} onSettled={() => { if (sound && audio.current && drop) playChime(audio.current, drop.points > 0); settle() }}/>
      </div>
      <aside className="panel machine-side">
        <Metric label="Fichas restantes" value={game.tokens} gold/>
        <Metric label="Pontuação total" value={number(game.points)}/>
        {drop && !animating && <div className="feedback right" role="status"><strong>Compartimento {drop.bin + 1}</strong><p>+{drop.points} pontos</p><p>Trajetória: {drop.path.map(direction => direction === 1 ? 'direita' : 'esquerda').join(' → ')}</p></div>}
        <Notice>{error}</Notice>
        {done ? <button className="button primary" onClick={() => setScreen('complete')}>Ver resultado <ArrowRight size={18}/></button>
          : <button className="button primary" onClick={() => void launch()} disabled={busy || animating || (!game.tokens && !pending)}><PlayIcon size={17} fill="currentColor"/> {animating ? 'Bolinha em movimento…' : busy ? 'Preparando…' : pending ? 'Recuperar lançamento' : 'Lançar bolinha'}</button>}
      </aside>
    </div>
  </section>
}
